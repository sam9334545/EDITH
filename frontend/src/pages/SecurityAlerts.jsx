import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  CheckCircle2,
  Lock,
  Shield,
  ShieldAlert,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import {
  ACCESS_STATUS,
  ALERT_SEVERITY,
  GUARD_MODES,
  RUNTIME_POLICIES,
} from '@shared/contracts.js';
import { api } from '../services/api.js';
import EmptyState from '../components/common/EmptyState.jsx';
import PageHeader from '../components/common/PageHeader.jsx';
import Panel from '../components/common/Panel.jsx';
import ProductIllustration from '../components/common/ProductIllustration.jsx';
import StatCard from '../components/common/StatCard.jsx';
import StatusBadge from '../components/common/StatusBadge.jsx';
import {
  ALERT_LABELS,
  AlertRows,
  ErrorBlock,
  SelectField,
  appName,
  formatDate,
  humanize,
} from '../components/common/LegacyControls.jsx';

const GUARD_MODE_META = {
  [GUARD_MODES.MONITOR]: {
    label: 'Monitor',
    tone: 'info',
    summary: 'Logs policy violations without blocking rate/drift rules. Revoked permissions remain denied.',
  },
  [GUARD_MODES.PROTECT]: {
    label: 'Protect',
    tone: 'warning',
    summary: 'Blocks revoked permissions, location rate limits, and behavioral drift anomalies.',
  },
  [GUARD_MODES.STRICT]: {
    label: 'Strict',
    tone: 'success',
    summary: 'Enforces all policies including suspended-app blocking and multi-resource burst protection.',
  },
};

const POLICY_MATRIX = [
  { id: RUNTIME_POLICIES.PERMISSION_REVOKED, label: 'Permission Revoked', scope: 'All modes (mandatory)' },
  { id: RUNTIME_POLICIES.APP_SUSPENDED, label: 'Suspended App Block', scope: 'Strict mode' },
  { id: RUNTIME_POLICIES.LOCATION_RATE_LIMIT, label: 'Location Rate Limit (>10/60s)', scope: 'Protect & Strict' },
  { id: RUNTIME_POLICIES.BEHAVIOURAL_DRIFT, label: 'Behavioral Drift Gate (≥50)', scope: 'Protect & Strict' },
  { id: RUNTIME_POLICIES.SENSITIVE_COMBINATION_BURST, label: '3+ Sensitive Burst (30s)', scope: 'Strict mode' },
];

export function SecurityPage({
  apps = [],
  alerts = [],
  events = [],
  errors = {},
  onAcknowledge,
  onViewAlert,
  busyAction,
}) {
  const [severity, setSeverity] = useState('all');
  const [type, setType] = useState('all');
  const [acknowledged, setAcknowledged] = useState('all');
  const [queriedAlerts, setQueriedAlerts] = useState(alerts);
  const [queryError, setQueryError] = useState(errors.alerts || null);

  const [guardMode, setGuardMode] = useState('');
  const [guardDecisions, setGuardDecisions] = useState([]);
  const [guardBusy, setGuardBusy] = useState(false);
  const [guardError, setGuardError] = useState(null);

  const loadGuardState = useCallback(async () => {
    try {
      const [modeRes, decisionsRes] = await Promise.all([
        api.getGuardMode(),
        api.getGuardDecisions({ limit: 10 }),
      ]);
      setGuardMode(modeRes?.mode || GUARD_MODES.STRICT);
      setGuardDecisions(Array.isArray(decisionsRes) ? decisionsRes : []);
      setGuardError(null);
    } catch (err) {
      setGuardError(err);
    }
  }, []);

  useEffect(() => {
    loadGuardState();
  }, [loadGuardState, events]);

  useEffect(() => {
    let active = true;
    api.getAlerts({
      severity: severity === 'all' ? undefined : severity,
      type: type === 'all' ? undefined : type,
      acknowledged: acknowledged === 'all' ? undefined : acknowledged,
      limit: 200,
    }).then((data) => {
      if (!active) return;
      setQueriedAlerts(data);
      setQueryError(null);
    }).catch((error) => {
      if (active) setQueryError(error);
    });
    return () => { active = false; };
  }, [severity, type, acknowledged, alerts]);

  const handleModeChange = async (nextMode) => {
    if (guardBusy || nextMode === guardMode) return;
    setGuardBusy(true);
    try {
      const updated = await api.updateGuardMode(nextMode);
      setGuardMode(updated?.mode || nextMode);
      setGuardError(null);
    } catch (err) {
      setGuardError(err);
    } finally {
      setGuardBusy(false);
    }
  };

  const allowedCount = useMemo(() => events.filter((e) => e.status === ACCESS_STATUS.ALLOWED).length, [events]);
  const blockedCount = useMemo(() => events.filter((e) => e.status === ACCESS_STATUS.DENIED).length, [events]);
  const unackCount = useMemo(() => alerts.filter((a) => !a.acknowledged).length, [alerts]);
  const modeInfo = GUARD_MODE_META[guardMode] || GUARD_MODE_META[GUARD_MODES.STRICT];

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="RASP-inspired runtime guard & heuristic threat engine"
        title="Security & Runtime Protection"
        description="Inspect incoming simulated request enforcement, configure Runtime Guard protection modes, and triage backend-generated heuristic alerts (Rules R1–R5)."
        badge={guardMode && (
          <StatusBadge tone={modeInfo.tone}>
            Guard Mode: {modeInfo.label}
          </StatusBadge>
        )}
      />

      <div className="split-intro-banner">
        <div className="split-intro-copy">
          <span className="eyebrow">Inline Inspection Architecture</span>
          <h2>Simulated RASP Request Guard</h2>
          <p>
            Every simulated access request passes through the backend Runtime Guard pipeline before execution. Clean requests matching active permissions proceed, while violations (SQLi/RASP probes, rate spikes, suspended apps, or unauthorized resources) are blocked and generate auditable security alerts.
          </p>
          <div className="guard-mode-bar" role="group" aria-label="Runtime Guard enforcement mode">
            {Object.values(GUARD_MODES).map((mode) => {
              const active = guardMode === mode;
              return (
                <button
                  key={mode}
                  type="button"
                  disabled={guardBusy}
                  className={`guard-mode-pill ${active ? 'guard-mode-active' : ''}`}
                  onClick={() => handleModeChange(mode)}
                >
                  <Shield size={13} aria-hidden="true" />
                  {GUARD_MODE_META[mode].label}
                </button>
              );
            })}
          </div>
          <p className="guard-mode-caption">{modeInfo.summary}</p>
        </div>
        <ProductIllustration
          src="/assets/rasp-threat-detection.webp"
          alt="Request packets passing through a frosted-mint RASP inspection shield where clean requests continue and malicious packets trigger an alert beacon"
          variant="compact"
        />
      </div>

      <div className="kpi-grid kpi-grid-4">
        <StatCard
          label="Protection mode"
          value={guardMode ? modeInfo.label : '—'}
          detail="Switchable via /api/guard/mode"
          icon={<Lock size={15} />}
          tone="info"
        />
        <StatCard
          label="Clean requests"
          value={allowedCount}
          detail="Permitted in latest 200 events"
          icon={<CheckCircle2 size={15} />}
          tone="success"
        />
        <StatCard
          label="Blocked requests"
          value={blockedCount}
          detail="Denied by policy or guard"
          icon={<XCircle size={15} />}
          tone={blockedCount > 0 ? 'warning' : 'neutral'}
        />
        <StatCard
          label="Unacknowledged alerts"
          value={unackCount}
          detail="5 heuristic rules (R1–R5)"
          icon={<ShieldAlert size={15} />}
          tone={unackCount > 0 ? 'danger' : 'success'}
        />
      </div>

      <div className="dashboard-grid posture-grid">
        <Panel title="Runtime Guard policy matrix" eyebrow="RASP-inspired enforcement scope">
          {guardError && <ErrorBlock error={guardError} endpoint="Runtime Guard" />}
          <div className="guard-policy-list">
            {POLICY_MATRIX.map((item) => {
              const enforced = item.id === RUNTIME_POLICIES.PERMISSION_REVOKED
                || (guardMode === GUARD_MODES.STRICT)
                || (guardMode === GUARD_MODES.PROTECT && (
                  item.id === RUNTIME_POLICIES.LOCATION_RATE_LIMIT || item.id === RUNTIME_POLICIES.BEHAVIOURAL_DRIFT
                ));
              return (
                <div className="guard-policy-row" key={item.id}>
                  <div>
                    <strong>{item.label}</strong>
                    <small>{item.scope}</small>
                  </div>
                  <StatusBadge tone={enforced ? 'success' : 'muted'}>
                    {enforced ? 'Enforced' : 'Monitor Only'}
                  </StatusBadge>
                </div>
              );
            })}
          </div>
        </Panel>

        <Panel title="Recent guard decisions" eyebrow={`${guardDecisions.length} in-memory runtime log entries`}>
          {guardDecisions.length ? (
            <div className="guard-decision-list">
              {guardDecisions.slice(0, 6).map((item, idx) => (
                <div className="guard-decision-row" key={item.decisionId || idx}>
                  <StatusBadge tone={item.decision === 'BLOCK' ? 'danger' : 'success'}>
                    {item.decision}
                  </StatusBadge>
                  <div className="guard-decision-copy">
                    <strong>{appName(apps, item.appId)} · {humanize(item.resource)}</strong>
                    <span>{item.reason || item.policy || 'Policy evaluation'}</span>
                  </div>
                  <time>{formatDate(item.timestamp)}</time>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="No guard decisions logged in this session" icon={<Activity size={18} />}>
              Simulate requests on the Access Monitoring page to observe real-time Runtime Guard allow/block evaluations.
            </EmptyState>
          )}
        </Panel>
      </div>

      <Panel title="Heuristic alert register" eyebrow={`${queriedAlerts.length} alerts from rules R1–R5`}>
        {queryError ? (
          <ErrorBlock error={queryError} endpoint="Security alerts" />
        ) : (
          <>
            <div className="filter-toolbar compact">
              <SelectField
                label="Severity"
                value={severity}
                onChange={setSeverity}
                options={[
                  { value: 'all', label: 'All severities' },
                  ...Object.values(ALERT_SEVERITY).map((value) => ({ value, label: humanize(value) })),
                ]}
              />
              <SelectField
                label="Alert type"
                value={type}
                onChange={setType}
                options={[
                  { value: 'all', label: 'All alert types' },
                  ...Object.entries(ALERT_LABELS).map(([value, label]) => ({ value, label })),
                ]}
              />
              <SelectField
                label="Acknowledgement"
                value={acknowledged}
                onChange={setAcknowledged}
                options={[
                  { value: 'all', label: 'Any status' },
                  { value: 'false', label: 'Needs review' },
                  { value: 'true', label: 'Acknowledged' },
                ]}
              />
            </div>

            {queriedAlerts.length ? (
              <div className="alert-list">
                <AlertRows
                  alerts={queriedAlerts}
                  apps={apps}
                  events={events}
                  onAcknowledge={onAcknowledge}
                  onView={onViewAlert}
                  busyId={busyAction.replace('ack-', '')}
                />
              </div>
            ) : (
              <EmptyState title="No matching alerts" icon={<ShieldCheck size={18} />}>
                Security alerts produced by the backend rule engine will appear here when triggered.
              </EmptyState>
            )}
          </>
        )}
      </Panel>
    </div>
  );
}
