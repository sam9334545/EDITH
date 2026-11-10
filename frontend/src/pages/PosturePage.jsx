import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  AppWindow,
  Radar,
  ShieldAlert,
  X,
  XCircle,
} from 'lucide-react';
import {
  ALERT_SEVERITY,
  FINDING_STATUS,
  POSTURE_FINDING_TYPES,
  POSTURE_RISK_LEVELS,
  RESOURCE_TYPES,
} from '@shared/contracts.js';
import { api } from '../services/api.js';
import AppMark from '../components/common/AppMark.jsx';
import EmptyState from '../components/common/EmptyState.jsx';
import PageHeader from '../components/common/PageHeader.jsx';
import Panel from '../components/common/Panel.jsx';
import StatCard from '../components/common/StatCard.jsx';
import StatusBadge from '../components/common/StatusBadge.jsx';
import { PostureTrendChart, RiskDonutChart } from '../components/charts/SecurityCharts.jsx';
import {
  Button,
  ErrorBlock,
  SelectField,
  TextField,
  appName,
  formatDate,
  humanize,
  levelLabel,
} from '../components/common/LegacyControls.jsx';

export function PosturePage({ apps = [], refreshKey, onNotify }) {
  const [days, setDays] = useState('7');
  const [appId, setAppId] = useState('');
  const [riskLevel, setRiskLevel] = useState('all');
  const [severity, setSeverity] = useState('all');
  const [findingType, setFindingType] = useState('all');
  const [findingStatus, setFindingStatus] = useState('all');
  const [resource, setResource] = useState('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [overview, setOverview] = useState(null);
  const [applicationRows, setApplicationRows] = useState([]);
  const [findings, setFindings] = useState([]);
  const [trends, setTrends] = useState(null);
  const [incidents, setIncidents] = useState([]);
  const [policies, setPolicies] = useState([]);
  const [policyEdits, setPolicyEdits] = useState({});
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState('');
  const [selectedFinding, setSelectedFinding] = useState(null);
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [selectedPostureApp, setSelectedPostureApp] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    const nextErrors = {};

    // Run overview first so backend posture/finding sync completes before parallel reads.
    try {
      const overviewData = await api.getPostureOverview({ days });
      setOverview(overviewData);
    } catch (error) {
      nextErrors.overview = error;
    }

    const [appResult, findingResult, trendResult, incidentResult, policyResult] = await Promise.allSettled([
      api.getPostureApplications({ riskLevel: riskLevel === 'all' ? undefined : riskLevel }),
      api.getPostureFindings({
        appId: appId || undefined,
        severity: severity === 'all' ? undefined : severity,
        findingType: findingType === 'all' ? undefined : findingType,
        status: findingStatus === 'all' ? undefined : findingStatus,
        resource: resource === 'all' ? undefined : resource,
        from: from || undefined,
        to: to || undefined,
        limit: 100,
      }),
      api.getPostureTrends({ days }),
      api.getPostureIncidents({
        appId: appId || undefined,
        from: from || undefined,
        to: to || undefined,
        limit: 12,
      }),
      api.getPosturePolicies(),
    ]);

    if (appResult.status === 'fulfilled') setApplicationRows(appResult.value);
    else nextErrors.applications = appResult.reason;
    if (findingResult.status === 'fulfilled') setFindings(findingResult.value.items || []);
    else nextErrors.findings = findingResult.reason;
    if (trendResult.status === 'fulfilled') setTrends(trendResult.value);
    else nextErrors.trends = trendResult.reason;
    if (incidentResult.status === 'fulfilled') setIncidents(incidentResult.value.items || []);
    else nextErrors.incidents = incidentResult.reason;
    if (policyResult.status === 'fulfilled') setPolicies(policyResult.value);
    else nextErrors.policies = policyResult.reason;
    setErrors(nextErrors);
    setLoading(false);
  }, [appId, days, findingStatus, findingType, from, resource, riskLevel, severity, to]);

  useEffect(() => {
    loadData();
  }, [loadData, refreshKey]);

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === 'Escape') {
        setSelectedFinding(null);
        setSelectedIncident(null);
        setSelectedPostureApp(null);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  async function changeFinding(finding, action) {
    setWorkingId(`${action}-${finding.id}`);
    try {
      if (action === 'acknowledge') await api.acknowledgeFinding(finding.id);
      else await api.resolveFinding(finding.id);
      onNotify(action === 'acknowledge' ? 'Finding acknowledged.' : 'Finding resolved.');
      setSelectedFinding(null);
      await loadData();
    } catch (error) {
      onNotify(error.message, 'error');
    } finally {
      setWorkingId('');
    }
  }

  async function changePolicy(policy) {
    setWorkingId(`policy-${policy.ruleId}`);
    try {
      await api.updatePosturePolicy(policy.ruleId, { enabled: !policy.enabled });
      onNotify(`${policy.name} ${policy.enabled ? 'disabled' : 'enabled'}.`);
      await loadData();
    } catch (error) {
      onNotify(error.message, 'error');
    } finally {
      setWorkingId('');
    }
  }

  async function savePolicy(policy) {
    const edits = policyEdits[policy.ruleId] || {};
    const updates = {};
    if (edits.threshold !== undefined) updates.threshold = Number(edits.threshold);
    if (edits.weight !== undefined) updates.weight = Number(edits.weight);
    if (!Object.keys(updates).length) return;
    setWorkingId(`policy-save-${policy.ruleId}`);
    try {
      await api.updatePosturePolicy(policy.ruleId, updates);
      onNotify(`${policy.name} configuration saved.`);
      await loadData();
    } catch (error) {
      onNotify(error.message, 'error');
    } finally {
      setWorkingId('');
    }
  }

  async function openFinding(finding) {
    try {
      setSelectedFinding(await api.getPostureFinding(finding.id));
    } catch (error) {
      onNotify(error.message, 'error');
    }
  }

  async function openIncident(incident) {
    try {
      setSelectedIncident(await api.getPostureIncident(incident.eventId));
    } catch (error) {
      onNotify(error.message, 'error');
    }
  }

  async function openApplication(app) {
    try {
      setSelectedPostureApp(await api.getApplicationPosture(app.id));
    } catch (error) {
      onNotify(error.message, 'error');
    }
  }

  const summary = overview?.summary || {};
  const scoreRows = overview?.trustScoreDistribution || [];
  const distributionMax = Math.max(1, ...scoreRows.map((row) => row.count));
  const trendRows = trends?.points || [];
  const riskDonutItems = (overview?.riskDistribution || []).map((item) => ({
    key: item.riskLevel,
    label: `${humanize(item.riskLevel)} Risk`,
    count: item.count,
  }));

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="CNAPP-inspired simulated posture view"
        title="Security posture"
        description="Backend-derived overview of permission exposure, recorded runtime activity, posture findings, and risk trends. No cloud or OS-level scanning is implied."
        actions={(
          <SelectField
            label="Trend range"
            value={days}
            onChange={setDays}
            options={[
              { value: '7', label: 'Last 7 days' },
              { value: '30', label: 'Last 30 days' },
            ]}
          />
        )}
      />

      {loading && <div className="refresh-indicator"><span className="spinner" />Refreshing posture records</div>}
      {errors.overview && <ErrorBlock error={errors.overview} endpoint="Posture overview" />}

      <section className="kpi-grid posture-kpi-grid" aria-label="Security posture summary">
        <StatCard label="Monitored apps" value={summary.totalApplications ?? '—'} detail="In API registry" icon={<AppWindow size={15} />} />
        <StatCard label="Critical risk" value={summary.criticalRiskApplications ?? '—'} detail="Posture score < 40" icon={<ShieldAlert size={15} />} tone="danger" />
        <StatCard label="High risk" value={summary.highRiskApplications ?? '—'} detail="Posture score 40–59" icon={<AlertTriangle size={15} />} tone="warning" />
        <StatCard label="Open findings" value={summary.openFindings ?? '—'} detail="Unresolved findings" icon={<Radar size={15} />} tone="info" />
        <StatCard label="Critical alerts" value={summary.unacknowledgedCriticalAlerts ?? '—'} detail="Unacknowledged" icon={<ShieldAlert size={15} />} tone="danger" />
        <StatCard label="Blocked events" value={summary.blockedRuntimeEvents ?? '—'} detail={`Last ${days} days`} icon={<XCircle size={15} />} tone="warning" />
      </section>

      <div className="dashboard-grid posture-grid">
        <Panel title="Application risk overview" eyebrow="Trust-based prioritization" className="span-two">
          {errors.applications ? (
            <ErrorBlock error={errors.applications} endpoint="Application posture" />
          ) : applicationRows.length ? (
            <div className="posture-table-wrap">
              <table className="posture-table">
                <thead>
                  <tr>
                    <th>Application</th>
                    <th>Trust</th>
                    <th>Risk</th>
                    <th>Findings</th>
                    <th>Last activity</th>
                    <th>Trend</th>
                  </tr>
                </thead>
                <tbody>
                  {applicationRows.map((app) => (
                    <tr key={app.id}>
                      <td>
                        <button type="button" className="posture-app-cell posture-detail-link" onClick={() => openApplication(app)}>
                          <AppMark name={app.name} size="sm" />
                          <span>
                            <strong>{app.name}</strong>
                            <small>{app.category} · {app.isDemo ? 'simulated demo' : 'recorded app'}</small>
                          </span>
                        </button>
                      </td>
                      <td>
                        <strong className="mono-num">{app.trustScore}</strong>
                        <small className="posture-score-caption">posture {app.postureScore}</small>
                      </td>
                      <td><StatusBadge tone={app.riskLevel}>{levelLabel(app.riskLevel)}</StatusBadge></td>
                      <td className="mono-num">{app.unresolvedFindings}</td>
                      <td className="mono-num">{formatDate(app.lastActivity)}</td>
                      <td>
                        <StatusBadge tone={app.trend === 'improving' ? 'success' : app.trend === 'deteriorating' ? 'danger' : 'muted'}>
                          {humanize(app.trend)}
                        </StatusBadge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title="No application posture records">
              Application posture will appear after the API returns records.
            </EmptyState>
          )}
        </Panel>

        <Panel title="Posture risk & score distribution" eyebrow="Risk-adjusted workspace profile">
          {riskDonutItems.length > 0 && (
            <div style={{ marginBottom: '18px' }}>
              <RiskDonutChart items={riskDonutItems} centerLabel="Apps" />
            </div>
          )}
          <div className="posture-bars">
            {scoreRows.map((row) => (
              <div className="posture-bar-row" key={row.range}>
                <span className="mono-num">{row.range}</span>
                <div className="posture-bar-track"><i style={{ width: `${(row.count / distributionMax) * 100}%` }} /></div>
                <strong className="mono-num">{row.count}</strong>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Runtime & permission risk" eyebrow={`Last ${days} days`}>
          {overview?.runtime ? (
            <>
              <div className="runtime-summary">
                <div><strong>{overview.runtime.allowed}</strong><span>Allowed</span></div>
                <div><strong>{overview.runtime.blocked}</strong><span>Blocked</span></div>
                <div><strong>{overview.runtime.suspicious}</strong><span>Suspicious</span></div>
              </div>
              <p className="panel-note" style={{ marginTop: '10px', marginBottom: '14px' }}>
                Source: {overview.runtime.demoEvents} simulated demo events and {overview.runtime.recordedEvents} recorded events (API telemetry, not OS monitoring).
              </p>
            </>
          ) : (
            <EmptyState title="Runtime data unavailable">Recorded events are provided by the backend.</EmptyState>
          )}

          <div className="permission-risk-grid">
            <div><strong>{overview?.permissionAnalytics?.excessive ?? '—'}</strong><span>Excessive</span></div>
            <div><strong>{overview?.permissionAnalytics?.unused ?? '—'}</strong><span>Unused</span></div>
            <div><strong>{overview?.permissionAnalytics?.riskyCombinations ?? '—'}</strong><span>Risky combos</span></div>
          </div>
          <div className="resource-distribution">
            {(overview?.permissionAnalytics?.sensitiveResources || []).map((item) => (
              <div key={item.resource}>
                <span>{humanize(item.resource)}</span>
                <strong>{item.enabled} enabled</strong>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Security posture trend" eyebrow={`Daily allowed vs. blocked (${days}d)`} className="span-two">
          {errors.trends ? (
            <ErrorBlock error={errors.trends} endpoint="Posture trends" />
          ) : (
            <PostureTrendChart points={trendRows} />
          )}
          <div className="posture-legend">
            <span>Findings status: <strong>{trends?.findingStatus?.resolved ?? '—'} resolved</strong> · <strong>{trends?.findingStatus?.unresolved ?? '—'} unresolved</strong></span>
          </div>
        </Panel>
      </div>

      <Panel title="Security findings" eyebrow="Filterable posture findings">
        <div className="filter-toolbar posture-filters">
          <SelectField
            label="Application"
            value={appId}
            onChange={setAppId}
            options={[{ value: '', label: 'All applications' }, ...apps.map((app) => ({ value: app.id, label: app.name }))]}
          />
          <SelectField
            label="Risk level"
            value={riskLevel}
            onChange={setRiskLevel}
            options={[{ value: 'all', label: 'All risk levels' }, ...Object.values(POSTURE_RISK_LEVELS).map((value) => ({ value, label: humanize(value) }))]}
          />
          <SelectField
            label="Severity"
            value={severity}
            onChange={setSeverity}
            options={[{ value: 'all', label: 'All severities' }, ...Object.values(ALERT_SEVERITY).map((value) => ({ value, label: humanize(value) }))]}
          />
          <SelectField
            label="Finding type"
            value={findingType}
            onChange={setFindingType}
            options={[{ value: 'all', label: 'All finding types' }, ...Object.values(POSTURE_FINDING_TYPES).map((value) => ({ value, label: humanize(value) }))]}
          />
          <SelectField
            label="Status"
            value={findingStatus}
            onChange={setFindingStatus}
            options={[{ value: 'all', label: 'Any status' }, ...Object.values(FINDING_STATUS).map((value) => ({ value, label: humanize(value) }))]}
          />
          <SelectField
            label="Resource"
            value={resource}
            onChange={setResource}
            options={[{ value: 'all', label: 'All resources' }, ...RESOURCE_TYPES.map((value) => ({ value, label: humanize(value) }))]}
          />
          <TextField label="From" type="date" value={from} onChange={setFrom} />
          <TextField label="To" type="date" value={to} onChange={setTo} />
        </div>

        {errors.findings ? (
          <ErrorBlock error={errors.findings} endpoint="Security findings" />
        ) : findings.length ? (
          <div className="posture-table-wrap">
            <table className="posture-table">
              <thead>
                <tr>
                  <th>Finding</th>
                  <th>Application</th>
                  <th>Severity</th>
                  <th>Resource</th>
                  <th>Status</th>
                  <th>Detected</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {findings.map((finding) => (
                  <tr key={finding.id}>
                    <td>
                      <button type="button" className="posture-detail-link" onClick={() => openFinding(finding)}>
                        {finding.title}
                      </button>
                      <small>{finding.reason}</small>
                    </td>
                    <td>{appName(apps, finding.appId)}</td>
                    <td><StatusBadge tone={finding.severity}>{humanize(finding.severity)}</StatusBadge></td>
                    <td>{finding.permissionResources.map(humanize).join(', ') || '—'}</td>
                    <td>
                      <StatusBadge tone={finding.status === FINDING_STATUS.RESOLVED ? 'success' : finding.status === FINDING_STATUS.ACKNOWLEDGED ? 'muted' : 'warning'}>
                        {humanize(finding.status)}
                      </StatusBadge>
                    </td>
                    <td className="mono-num">{formatDate(finding.detectedAt)}</td>
                    <td className="posture-actions">
                      {finding.status !== FINDING_STATUS.ACKNOWLEDGED && finding.status !== FINDING_STATUS.RESOLVED && (
                        <Button disabled={Boolean(workingId)} onClick={() => changeFinding(finding, 'acknowledge')}>
                          {workingId === `acknowledge-${finding.id}` ? 'Saving…' : 'Acknowledge'}
                        </Button>
                      )}
                      {finding.status !== FINDING_STATUS.RESOLVED && finding.findingType === POSTURE_FINDING_TYPES.POLICY_VIOLATION && (
                        <Button disabled={Boolean(workingId)} onClick={() => changeFinding(finding, 'resolve')}>
                          {workingId === `resolve-${finding.id}` ? 'Saving…' : 'Resolve'}
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="No findings match these filters">
            Try another application, severity, status, resource, or date range.
          </EmptyState>
        )}
      </Panel>

      <div className="dashboard-grid posture-grid">
        <Panel title="Incident timeline" eyebrow="One record per underlying event">
          {errors.incidents ? (
            <ErrorBlock error={errors.incidents} endpoint="Incident intelligence" />
          ) : incidents.length ? (
            <div className="incident-list">
              {incidents.map((incident) => (
                <button type="button" className="incident-row" key={incident.eventId} onClick={() => openIncident(incident)}>
                  <span className={`severity-mark severity-${incident.severity}`} />
                  <span>
                    <strong>{incident.applicationName} · {humanize(incident.resource)}</strong>
                    <small>{incident.observed}</small>
                  </span>
                  <StatusBadge tone={incident.decision === 'blocked' ? 'danger' : 'muted'}>
                    {humanize(incident.decision)}
                  </StatusBadge>
                </button>
              ))}
            </div>
          ) : (
            <EmptyState title="No incidents in range">
              Incidents are derived from recorded denied or suspicious access events.
            </EmptyState>
          )}
        </Panel>

        <Panel title="Security policies" eyebrow="Quick threshold tuning">
          {errors.policies ? (
            <ErrorBlock error={errors.policies} endpoint="Security policies" />
          ) : policies.length ? (
            <div className="policy-list">
              {policies.map((policy) => (
                <article className="policy-row" key={policy.ruleId}>
                  <div>
                    <strong>{policy.name}</strong>
                    <small>{policy.description} Threshold: {policy.threshold} · {humanize(policy.severity)}</small>
                  </div>
                  <label className="policy-number-field">
                    <span>Threshold</span>
                    <input
                      type="number"
                      min="1"
                      max="1000"
                      value={policyEdits[policy.ruleId]?.threshold ?? policy.threshold}
                      onChange={(event) => setPolicyEdits((current) => ({ ...current, [policy.ruleId]: { ...current[policy.ruleId], threshold: event.target.value } }))}
                    />
                  </label>
                  <label className="policy-number-field">
                    <span>Weight</span>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={policyEdits[policy.ruleId]?.weight ?? policy.weight}
                      onChange={(event) => setPolicyEdits((current) => ({ ...current, [policy.ruleId]: { ...current[policy.ruleId], weight: event.target.value } }))}
                    />
                  </label>
                  <div className="policy-actions">
                    <Button disabled={Boolean(workingId)} onClick={() => savePolicy(policy)}>
                      {workingId === `policy-save-${policy.ruleId}` ? 'Saving…' : 'Save'}
                    </Button>
                    <Button disabled={Boolean(workingId)} onClick={() => changePolicy(policy)}>
                      {workingId === `policy-${policy.ruleId}` ? 'Saving…' : policy.enabled ? 'Disable' : 'Enable'}
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState title="No policies configured">
              Security rules are loaded by the backend seed.
            </EmptyState>
          )}
        </Panel>
      </div>

      {selectedFinding && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setSelectedFinding(null); }}>
          <div className="modal detail-modal" role="dialog" aria-modal="true" aria-label="Finding details">
            <div className="modal-heading">
              <div><span className="eyebrow">Finding details</span><h2>{selectedFinding.title}</h2></div>
              <button type="button" className="icon-button" aria-label="Close" onClick={() => setSelectedFinding(null)}><X size={16} /></button>
            </div>
            <p style={{ marginTop: '14px' }}>{selectedFinding.reason}</p>
            <p><strong>Affected resources:</strong> {selectedFinding.permissionResources.map(humanize).join(', ') || 'No direct permission'}</p>
            <p><strong>Recommended action:</strong> {selectedFinding.recommendedAction}</p>
            <p><strong>Rule:</strong> {selectedFinding.ruleId || 'Permission profile assessment'} · <strong>Last observed:</strong> {formatDate(selectedFinding.lastObservedAt)}</p>
            <ol className="finding-history">
              {selectedFinding.history.map((item, index) => (
                <li key={`${item.timestamp}-${index}`}>
                  <strong>{humanize(item.status)}</strong>
                  <time>{formatDate(item.timestamp)}</time>
                  <span>{item.note}</span>
                </li>
              ))}
            </ol>
            <div className="modal-actions"><Button onClick={() => setSelectedFinding(null)}>Close</Button></div>
          </div>
        </div>
      )}

      {selectedPostureApp && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setSelectedPostureApp(null); }}>
          <div className="modal detail-modal" role="dialog" aria-modal="true" aria-label="Application security posture">
            <div className="modal-heading">
              <div><span className="eyebrow">Application security posture</span><h2>{selectedPostureApp.name}</h2></div>
              <button type="button" className="icon-button" aria-label="Close" onClick={() => setSelectedPostureApp(null)}><X size={16} /></button>
            </div>
            <p style={{ marginTop: '12px' }}>{selectedPostureApp.description}</p>
            <p style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <StatusBadge tone={selectedPostureApp.riskLevel}>{humanize(selectedPostureApp.riskLevel)} risk</StatusBadge>
              <strong>Trust {selectedPostureApp.trustScore}/100 · Posture {selectedPostureApp.postureScore}/100</strong>
            </p>
            <ul className="explanation-list">
              {selectedPostureApp.riskBreakdown.explanations.map((line, index) => <li key={`${index}-${line}`}>{line}</li>)}
            </ul>
            <p><strong>Enabled permissions:</strong> {RESOURCE_TYPES.filter((item) => selectedPostureApp.permissions[item]?.enabled).map(humanize).join(', ') || 'None'}</p>
            <p><strong>Declared permissions:</strong> {selectedPostureApp.expectedPermissions.map(humanize).join(', ') || 'None declared'}</p>
            <p><strong>Permission usage:</strong> {RESOURCE_TYPES.map((item) => `${humanize(item)}: ${humanize(selectedPostureApp.permissionRisk.usageDetails[item].status)}`).join(' · ')}</p>
            <p><strong>Recommended actions:</strong> {selectedPostureApp.recommendedActions.join(' · ') || 'No open actions'}</p>
            <ol className="finding-history">
              {selectedPostureApp.recentEvents.map((item) => (
                <li key={item.id}>
                  <strong>{humanize(item.status)} · {humanize(item.resource)}</strong>
                  <time>{formatDate(item.timestamp)}</time>
                  <span>{item.reason}{item.isDemo ? ' (simulated demo)' : ''}</span>
                </li>
              ))}
            </ol>
            <div className="modal-actions"><Button onClick={() => setSelectedPostureApp(null)}>Close</Button></div>
          </div>
        </div>
      )}

      {selectedIncident && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setSelectedIncident(null); }}>
          <div className="modal detail-modal" role="dialog" aria-modal="true" aria-label="Incident details">
            <div className="modal-heading">
              <div>
                <span className="eyebrow">Incident · {selectedIncident.simulated ? 'Simulated demo record' : 'Recorded event'}</span>
                <h2>{selectedIncident.applicationName} · {humanize(selectedIncident.resource)}</h2>
              </div>
              <button type="button" className="icon-button" aria-label="Close" onClick={() => setSelectedIncident(null)}><X size={16} /></button>
            </div>
            <div className="incident-explanation-grid" style={{ marginTop: '14px' }}>
              <div><strong>What happened?</strong><span>{selectedIncident.whatHappened}</span></div>
              <div><strong>Expected</strong><span>{selectedIncident.expected}</span></div>
              <div><strong>Observed</strong><span>{selectedIncident.observed}</span></div>
              <div><strong>Rule and decision</strong><span>{selectedIncident.ruleTriggered.join(', ') || 'Permission evaluation'} · {humanize(selectedIncident.decision)}</span></div>
              <div><strong>Trust score impact</strong><span>{selectedIncident.trustScoreImpact ? `-${selectedIncident.trustScoreImpact}` : 'No linked score adjustment'}</span></div>
              <div><strong>Next step</strong><span>{selectedIncident.nextAction}</span></div>
            </div>
            <ol className="finding-history">
              {selectedIncident.timeline.map((item, index) => (
                <li key={`${item.timestamp}-${index}`}>
                  <strong>{humanize(item.type)}</strong>
                  <time>{formatDate(item.timestamp)}</time>
                  <span>{item.description}</span>
                </li>
              ))}
            </ol>
            <div className="modal-actions"><Button onClick={() => setSelectedIncident(null)}>Close</Button></div>
          </div>
        </div>
      )}
    </div>
  );
}
