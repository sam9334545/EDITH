// E.D.I.T.H. Runtime Application Self-Protection (RASP) middleware.
//
// Inspects req.body, req.query, req.params and the request path inline, and blocks
// requests that carry runtime attack payloads:
//   - SQL injection            (UNION SELECT, tautologies, stacked/destructive queries, ...)
//   - Path traversal           (../, encoded variants, null bytes, sensitive files)
//   - Command / code execution (shell chaining, $(...), eval, child_process, template/JNDI, <script>)
//   - Parameter tampering      (prototype pollution, NoSQL operators, protected-field / role escalation,
//                               HTTP parameter pollution, abusive payload structure)
//
// On a violation it: responds 403 with fail('RASP_VIOLATION', ...), records the event in historyService
// (ACCESS_DENIED, plus ALERT_CREATED for high/critical), and lowers the app's trustScore when the request
// can be attributed to a real, known appId.
//
// Usage:
//   import raspMiddleware from './middleware/raspMiddleware.js';
//   app.use(express.json());
//   app.use(raspMiddleware);                       // global (mount AFTER body parsing)
//   router.param('id', raspParamGuard);            // optional: inspect route params as they resolve
//   const strict = createRaspMiddleware({ mode: 'block', penaltyCooldownMs: 0 });   // custom instance
//
// Environment:
//   RASP_ENABLED=false      disable inspection entirely (kill switch)
//   RASP_MODE=monitor       log violations but do not block or penalise (use to tune false positives)

import { randomUUID } from 'node:crypto';
import { fail, ACTIVITY_EVENT_TYPES } from '../../shared/contracts.js';
import { store } from '../store/index.js';
import { historyService } from '../services/historyService.js';
import { applyTrustPenalties } from '../services/securityService.js';

/* ------------------------------------------------------------------ */
/* Configuration                                                       */
/* ------------------------------------------------------------------ */

// Fields a client must never be able to set (parameter tampering / mass assignment).
// Override with createRaspMiddleware({ protectedKeys: [...] }); matching ignores case, '_' and '-'.
const DEFAULT_PROTECTED_KEYS = Object.freeze([
  'trustScore', 'trustLevel', 'isAdmin', 'isSuperuser', 'superuser', 'isSystem', 'sudo',
]);

const DEFAULTS = Object.freeze({
  enabled: process.env.RASP_ENABLED !== 'false',
  mode: process.env.RASP_MODE === 'monitor' ? 'monitor' : 'block', // 'block' | 'monitor'
  failOpen: false,                 // if the inspector itself crashes: false => 500, true => let request through
  maxDepth: 10,                    // max JSON nesting inspected
  maxNodes: 2000,                  // max values/keys inspected per request part
  maxFindings: 10,                 // stop scanning after this many findings
  maxHeadChars: 16384,             // inspect first N chars of a string ...
  maxTailChars: 4096,              // ... and last N chars (stops "pad the payload" evasion)
  penaltyCooldownMs: 30000,        // at most one trust penalty per app per window (limits abuse via spoofed appId)
  skipPaths: ['/api/health'],      // exact paths that are never inspected
  unattributedAppId: 'system',     // history bucket when no valid appId can be derived
  logger: console,                 // any object with .warn(); set null to silence
  protectedKeys: DEFAULT_PROTECTED_KEYS, // body/query keys a client may never send
});

const SEVERITY_RANK = Object.freeze({ low: 1, medium: 2, high: 3, critical: 4 });

// Role-like fields: only a violation when the value tries to elevate.
const ROLE_KEYS = new Set(['role', 'roles', 'userrole', 'accesslevel', 'permissionlevel', 'privilege', 'privileges']);
const ELEVATED_VALUE = /^(?:admin|administrator|root|superuser|super_admin|owner|system|sudo|\*)$/i;
// Query keys that must be scalar; an array means HTTP parameter pollution.
const SCALAR_QUERY_KEYS = new Set([
  'appId', 'resource', 'status', 'type', 'limit', 'suspicious', 'severity', 'acknowledged',
]);
const NOSQL_OPERATORS = new Set([
  '$where', '$ne', '$gt', '$gte', '$lt', '$lte', '$in', '$nin', '$regex', '$expr', '$or', '$and',
  '$not', '$nor', '$exists', '$function', '$accumulator', '$eq',
]);

/* ------------------------------------------------------------------ */
/* Detection rules                                                     */
/* ------------------------------------------------------------------ */

const CMDS = [
  'cat', 'ls', 'id', 'whoami', 'uname', 'curl', 'wget', 'nc', 'ncat', 'netcat', 'bash', 'sh', 'zsh', 'ksh',
  'powershell', 'pwsh', 'cmd', 'python3?', 'perl', 'ruby', 'php', 'node', 'chmod', 'chown', 'rm', 'mv', 'cp',
  'ping', 'nslookup', 'dig', 'telnet', 'ssh', 'scp', 'sudo', 'env', 'printenv', 'touch', 'kill', 'killall',
  'ifconfig', 'ipconfig', 'netstat', 'tasklist', 'systeminfo', 'certutil', 'bitsadmin', 'mkfifo', 'base64',
  'xargs', 'echo',
].join('|');
// A command only counts when followed by something argument-like (flag, path, $var, file, URL) or end of
// input. This keeps ordinary prose such as "dogs; cat owners" from matching.
const ARG = '(?:\\s+(?:-{1,2}[a-z0-9]|[\\/~$.]|[\\w.-]+\\.[a-z]{2,4}\\b|https?:)|\\s*$)';

// on: 'norm'    -> decoded + NFKC + SQL comments stripped + whitespace collapsed
//     'decoded' -> decoded only (keeps control characters such as NUL)
const RULES = [
  // ---- SQL injection ----
  { id: 'sqli_union', category: 'sql_injection', severity: 'high', on: 'norm',
    re: /\bunion\b(?:\s+(?:all|distinct))?\s+select\b/i },
  { id: 'sqli_tautology_quoted', category: 'sql_injection', severity: 'high', on: 'norm',
    re: /['"`]\s*(?:or|and|\|\||&&)\s*['"`]?(\w+)['"`]?\s*(?:=|like)\s*['"`]?\1\b/i },
  { id: 'sqli_tautology_numeric', category: 'sql_injection', severity: 'high', on: 'norm',
    re: /\b(?:or|and)\s+(\d{1,6})\s*=\s*\1\b/i },
  { id: 'sqli_stacked_query', category: 'sql_injection', severity: 'critical', on: 'norm',
    re: /;\s*(?:drop|alter|truncate|create|grant|revoke|shutdown|exec(?:ute)?|declare|delete\s+from|insert\s+into|update\s+\w+\s+set)\b/i },
  { id: 'sqli_destructive', category: 'sql_injection', severity: 'critical', on: 'norm',
    re: /\b(?:drop|truncate)\s+(?:table|database|schema|view|index|user)\b/i },
  { id: 'sqli_comment_terminator', category: 'sql_injection', severity: 'high', on: 'norm',
    re: /\w['"`]\s*(?:--(?:\s|$)|#\s*$)|\w\)\s*--\s*$/ },
  { id: 'sqli_function_probe', category: 'sql_injection', severity: 'high', on: 'norm',
    re: /\b(?:sleep|benchmark|pg_sleep|load_file|extractvalue|updatexml|dbms_pipe\.receive_message)\s*\(|\bwaitfor\s+delay\b/i },
  { id: 'sqli_schema_probe', category: 'sql_injection', severity: 'high', on: 'norm',
    re: /\b(?:information_schema|pg_catalog|sqlite_master|sys\.(?:tables|objects|columns)|mysql\.user|xp_cmdshell|sp_executesql)\b/i },
  { id: 'sqli_subquery', category: 'sql_injection', severity: 'high', on: 'norm',
    re: /\(\s*select\b[^)]{0,200}\bfrom\b/i },
  { id: 'sqli_outfile', category: 'sql_injection', severity: 'critical', on: 'norm',
    re: /\binto\s+(?:out|dump)file\b/i },

  // ---- Path traversal ----
  { id: 'path_dotdot', category: 'path_traversal', severity: 'high', on: 'norm',
    re: /\.\.[\\/]|[\\/]\.\.$|^\.\.$/ },
  { id: 'path_null_byte', category: 'path_traversal', severity: 'high', on: 'decoded',
    re: /\0|\\(?:x00|u0000)/i },
  { id: 'path_sensitive_file', category: 'path_traversal', severity: 'high', on: 'norm',
    re: /(?:^|[^\w])(?:\/etc\/(?:passwd|shadow|group|hosts|sudoers)|\/proc\/(?:self|\d+)\/|\/root\/\.ssh|\.ssh\/id_rsa|c:\\windows\\(?:system32|win\.ini)|\\windows\\system32|boot\.ini|web\.config|\.git\/config)|(?:^|[\\/])\.env(?:\.\w+)?$/i },
  { id: 'path_dangerous_scheme', category: 'path_traversal', severity: 'medium', on: 'norm',
    re: /\b(?:file|gopher|dict|php|expect|phar|jar):\/\//i },

  // ---- Command injection ----
  { id: 'cmd_chain', category: 'command_injection', severity: 'critical', on: 'norm',
    re: new RegExp(`(?:;|&&|\\|\\||\\||\`)\\s*(?:${CMDS})${ARG}`, 'i') },
  { id: 'cmd_substitution', category: 'command_injection', severity: 'critical', on: 'norm',
    re: new RegExp(`\\$\\(\\s*(?:${CMDS})\\b|\\$\\{IFS\\}`, 'i') },
  { id: 'cmd_dangerous_binary', category: 'command_injection', severity: 'critical', on: 'norm',
    re: /\brm\s+-[a-z]*[rf][a-z]*\s|\/bin\/(?:ba|z|da|k)?sh\b|\/dev\/(?:tcp|udp)\/|\bnc(?:at)?\s+-[a-z]*[elp]|\bbash\s+-[ci]\b|\bpowershell(?:\.exe)?\s+-|\bcmd(?:\.exe)?\s+\/[ck]\b|\bmkfifo\b|\bchmod\s+(?:[+-]x|[0-7]{3,4})\s/i },
  { id: 'cmd_download_exec', category: 'command_injection', severity: 'critical', on: 'norm',
    re: /\b(?:curl|wget)\b[^|;&]{0,200}\|\s*(?:sudo\s+)?(?:ba|z|k)?sh\b/i },

  // ---- Code execution ----
  { id: 'code_js_eval', category: 'code_execution', severity: 'critical', on: 'norm',
    re: /\beval\s*\(|\bnew\s+Function\s*\(|\b(?:child_process|execSync|spawnSync|execFileSync)\b|\brequire\s*\(\s*['"`]|\bprocess\s*\.\s*(?:mainModule|binding|dlopen)\b|\bconstructor\s*\.\s*constructor\b|\bimport\s*\(\s*['"`]|__proto__/i },
  { id: 'code_template_injection', category: 'code_execution', severity: 'critical', on: 'norm',
    re: /\$\{\s*(?:jndi|env|sys|lower|upper):|\{\{[^}]{0,200}(?:constructor|__proto__|process|require|__class__)[^}]{0,200}\}\}|<%[=-]?[^%]{0,200}(?:process|require)/i },
  { id: 'code_script_markup', category: 'code_execution', severity: 'high', on: 'norm',
    re: /<\s*script\b|\bjavascript\s*:|<\s*(?:iframe|object|embed)\b|\bon(?:error|load|mouseover|focus)\s*=/i },
  { id: 'code_php_python_exec', category: 'code_execution', severity: 'critical', on: 'norm',
    re: /<\?(?:php|=)|\b(?:passthru|shell_exec|proc_open|popen)\s*\(|\bos\.system\b|\bsubprocess\.(?:run|call|popen)\b/i },
];

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

/** Escape control/non-ASCII chars and truncate, so attacker text is safe to log and store. */
function safe(text, max = 120) {
  return String(text)
    .slice(0, max)
    .replace(/[^\x20-\x7E]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);
}

/** Percent-decode (up to 3 passes, never throws), NFKC-normalise, strip SQL comments, collapse whitespace. */
function normalize(input) {
  let decoded = input;
  for (let i = 0; i < 3; i += 1) {
    const next = decoded.replace(/%([0-9a-f]{2})/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
    if (next === decoded) break;
    decoded = next;
  }
  let norm = decoded;
  try {
    norm = norm.normalize('NFKC'); // folds full-width / compatibility chars (e.g. ＵＮＩＯＮ)
  } catch {
    /* keep un-normalised */
  }
  norm = norm.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\s+/g, ' ');
  return { decoded, norm };
}

function pushFinding(findings, limits, finding) {
  if (findings.length < limits.maxFindings) findings.push(finding);
}

function scanString(value, location, findings, limits) {
  if (value.length < 2 || findings.length >= limits.maxFindings) return;
  const sample = value.length > limits.maxHeadChars + limits.maxTailChars
    ? `${value.slice(0, limits.maxHeadChars)} ${value.slice(-limits.maxTailChars)}`
    : value;
  const { decoded, norm } = normalize(sample);

  for (const rule of RULES) {
    const match = rule.re.exec(rule.on === 'decoded' ? decoded : norm);
    if (match) {
      pushFinding(findings, limits, {
        ruleId: rule.id,
        category: rule.category,
        severity: rule.severity,
        location,
        excerpt: safe(match[0], 80),
      });
    }
  }
}

function inspectKey(key, value, location, root, findings, limits) {
  const lower = key.toLowerCase();
  const compact = lower.replace(/[_\-\s]/g, '');

  if (key === '__proto__' || (key === 'constructor' && value !== null && typeof value === 'object')) {
    pushFinding(findings, limits, {
      ruleId: 'tamper_prototype_pollution', category: 'prototype_pollution', severity: 'high',
      location, excerpt: safe(key, 40),
    });
  }
  if (key.startsWith('$') && NOSQL_OPERATORS.has(lower)) {
    pushFinding(findings, limits, {
      ruleId: 'tamper_nosql_operator', category: 'parameter_tampering', severity: 'high',
      location, excerpt: safe(key, 40),
    });
  }
  if (root === 'body' || root === 'query') {
    if (limits.protectedKeys.has(compact)) {
      pushFinding(findings, limits, {
        ruleId: 'tamper_protected_field', category: 'privilege_escalation', severity: 'high',
        location, excerpt: safe(key, 40),
      });
    } else if (ROLE_KEYS.has(compact)) {
      const values = Array.isArray(value) ? value : [value];
      if (values.some((v) => typeof v === 'string' && ELEVATED_VALUE.test(v.trim()))) {
        pushFinding(findings, limits, {
          ruleId: 'tamper_role_escalation', category: 'privilege_escalation', severity: 'high',
          location, excerpt: safe(`${key}=${values.filter((v) => typeof v === 'string').join(',')}`, 60),
        });
      }
    }
  }
  if (root === 'query' && Array.isArray(value) && SCALAR_QUERY_KEYS.has(key)) {
    pushFinding(findings, limits, {
      ruleId: 'tamper_parameter_pollution', category: 'parameter_tampering', severity: 'medium',
      location, excerpt: safe(key, 40),
    });
  }
  // Key names can carry payloads too (e.g. {"a' OR 1=1--": 1}).
  scanString(key, `${location}(key)`, findings, limits);
}

/** Iteratively walks a value (no recursion => no stack overflow on hostile nesting). */
function inspectTarget(rootValue, root, limits, findings) {
  if (rootValue === null || rootValue === undefined) return;
  const stack = [{ value: rootValue, location: root, depth: 0 }];
  let nodes = 0;

  while (stack.length > 0 && findings.length < limits.maxFindings) {
    const { value, location, depth } = stack.pop();
    if (value === null || value === undefined) continue;

    nodes += 1;
    if (nodes > limits.maxNodes) {
      pushFinding(findings, limits, {
        ruleId: 'structure_node_limit', category: 'anomalous_structure', severity: 'medium',
        location, excerpt: `>${limits.maxNodes} nodes`,
      });
      return;
    }
    if (typeof value === 'string') {
      scanString(value, location, findings, limits);
      continue;
    }
    if (typeof value !== 'object') continue; // numbers, booleans

    if (depth >= limits.maxDepth) {
      pushFinding(findings, limits, {
        ruleId: 'structure_depth_limit', category: 'anomalous_structure', severity: 'medium',
        location, excerpt: `depth>=${limits.maxDepth}`,
      });
      continue;
    }
    if (Array.isArray(value)) {
      if (value.length > limits.maxNodes) {
        pushFinding(findings, limits, {
          ruleId: 'structure_node_limit', category: 'anomalous_structure', severity: 'medium',
          location, excerpt: `array length ${value.length}`,
        });
        return;
      }
      for (let i = 0; i < value.length; i += 1) {
        stack.push({ value: value[i], location: `${location}[${i}]`, depth: depth + 1 });
      }
      continue;
    }
    for (const key of Object.keys(value)) {
      const childLocation = `${location}.${safe(key, 40)}`;
      inspectKey(key, value[key], childLocation, root, findings, limits);
      stack.push({ value: value[key], location: childLocation, depth: depth + 1 });
    }
  }
}

function topFinding(findings) {
  return findings.reduce((best, f) => (
    !best || SEVERITY_RANK[f.severity] > SEVERITY_RANK[best.severity] ? f : best
  ), null);
}

/** Derives a trustworthy appId: must look like an id AND exist in the store. Otherwise null. */
function resolveAppId(req) {
  const fromPath = /^\/(?:api\/)?apps\/([^/?#]+)/.exec(req.path || '');
  const candidates = [
    req.params?.appId, req.params?.id,
    req.body?.appId, req.query?.appId,
    req.get?.('x-app-id'),
    fromPath?.[1],
  ];
  for (const c of candidates) {
    if (typeof c === 'string' && /^[\w-]{1,64}$/.test(c) && store.findAppById(c)) return c;
  }
  return null;
}

/** Safely decoded path (without query string) for inspection. */
function requestPath(req) {
  return String(req.originalUrl || req.url || '').split('?')[0];
}

/* ------------------------------------------------------------------ */
/* Factory                                                             */
/* ------------------------------------------------------------------ */

export function createRaspMiddleware(options = {}) {
  const cfg = { ...DEFAULTS, ...options };
  const limits = {
    maxDepth: cfg.maxDepth, maxNodes: cfg.maxNodes, maxFindings: cfg.maxFindings,
    maxHeadChars: cfg.maxHeadChars, maxTailChars: cfg.maxTailChars,
    protectedKeys: new Set(cfg.protectedKeys.map((k) => String(k).toLowerCase().replace(/[_\-\s]/g, ''))),
  };
  const skip = new Set(cfg.skipPaths);
  const penaltyClock = new Map(); // appId -> last penalty epoch ms

  function logWarn(payload) {
    try {
      cfg.logger?.warn?.(JSON.stringify({ level: 'warn', source: 'rasp', ...payload }));
    } catch {
      /* logging must never break the request */
    }
  }

  function tryPenalty(appId, alert) {
    const now = Date.now();
    if (now - (penaltyClock.get(appId) ?? 0) < cfg.penaltyCooldownMs) return { applied: false, reason: 'cooldown' };
    const result = applyTrustPenalties(appId, [alert]);
    penaltyClock.set(appId, now);
    if (penaltyClock.size > 1000) penaltyClock.delete(penaltyClock.keys().next().value);
    return { applied: Boolean(result), score: result?.score };
  }

  /** Records the violation (history + trust score). Never throws. */
  function recordViolation(req, findings, top, blocked) {
    const violationId = `rasp_${randomUUID().slice(0, 12)}`;
    const appId = resolveAppId(req);
    const path = safe(requestPath(req), 120);
    const metadata = {
      source: 'rasp',
      violationId,
      eventId: violationId, // unique key => historyService never de-duplicates distinct violations
      category: top.category,
      ruleId: top.ruleId,
      severity: top.severity,
      ruleIds: [...new Set(findings.map((f) => f.ruleId))],
      locations: findings.slice(0, 5).map((f) => f.location),
      excerpt: top.excerpt,
      method: req.method,
      path,
      ip: safe(req.ip || '', 64),
      attributed: Boolean(appId),
      mode: blocked ? 'block' : 'monitor',
    };
    const historyAppId = appId || cfg.unattributedAppId;
    const prefix = blocked ? 'RASP blocked' : 'RASP detected (monitor)';

    try {
      historyService.recordActivity({
        appId: historyAppId,
        eventType: ACTIVITY_EVENT_TYPES.ACCESS_DENIED,
        description: `${prefix} ${req.method} ${path}: ${top.category} (${top.ruleId}) in ${top.location}`,
        metadata,
      });
      if (SEVERITY_RANK[top.severity] >= SEVERITY_RANK.high) {
        historyService.recordActivity({
          appId: historyAppId,
          eventType: ACTIVITY_EVENT_TYPES.ALERT_CREATED,
          description: `RASP alert: ${top.category} (${top.severity}) on ${req.method} ${path}`,
          metadata: { ...metadata, alertId: violationId },
        });
      }
    } catch (err) {
      logWarn({ msg: 'failed to record history', error: err.message, violationId });
    }

    let trust = { applied: false, reason: appId ? 'monitor_mode' : 'unattributed' };
    if (blocked && appId) {
      try {
        trust = tryPenalty(appId, {
          id: violationId,
          appId,
          type: `rasp_${top.category}`,
          severity: top.severity,
          timestamp: store.clock.now(),
        });
      } catch (err) {
        trust = { applied: false, reason: 'error' };
        logWarn({ msg: 'failed to apply trust penalty', error: err.message, violationId });
      }
    }

    logWarn({ msg: blocked ? 'request blocked' : 'violation detected', ...metadata, appId, trust });
    return violationId;
  }

  function handleFindings(req, res, next, findings) {
    if (findings.length === 0) return next();
    const top = topFinding(findings);
    const blocked = cfg.mode === 'block';
    const violationId = recordViolation(req, findings, top, blocked);
    if (!blocked) return next();
    if (res.headersSent) return undefined;
    res.set('X-RASP-Violation-Id', violationId);
    // Deliberately generic: never echo the payload or the matched rule back to the client.
    return res.status(403).json(fail('RASP_VIOLATION', 'Request blocked by runtime application self-protection policy'));
  }

  function onInspectorError(err, res, next) {
    logWarn({ msg: 'inspector error', error: err?.message });
    if (cfg.failOpen) return next();
    if (res.headersSent) return undefined;
    return res.status(500).json(fail('INTERNAL_ERROR', 'Request could not be inspected'));
  }

  /** Global / route-level middleware. Mount after express.json(). */
  function raspMiddleware(req, res, next) {
    if (!cfg.enabled || skip.has(req.path)) return next();
    try {
      const findings = [];
      inspectTarget(requestPath(req), 'path', limits, findings);
      inspectTarget(req.params, 'params', limits, findings);
      inspectTarget(req.query, 'query', limits, findings);
      inspectTarget(req.body, 'body', limits, findings);
      return handleFindings(req, res, next, findings);
    } catch (err) {
      return onInspectorError(err, res, next);
    }
  }

  /** router.param('id', raspParamGuard): params are not populated yet at app.use() level. */
  raspMiddleware.paramGuard = function raspParamGuard(req, res, next, value, name) {
    if (!cfg.enabled) return next();
    try {
      const findings = [];
      inspectTarget({ [name]: value }, 'params', limits, findings);
      return handleFindings(req, res, next, findings);
    } catch (err) {
      return onInspectorError(err, res, next);
    }
  };

  return raspMiddleware;
}

/* ------------------------------------------------------------------ */
/* Default instance                                                    */
/* ------------------------------------------------------------------ */

export const raspMiddleware = createRaspMiddleware();
export const raspParamGuard = raspMiddleware.paramGuard;
export default raspMiddleware;