import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ACCESS_STATUS, ACTIVITY_EVENT_TYPES, ALERT_SEVERITY, ALERT_TYPES,
  FINDING_STATUS, POSTURE_FINDING_TYPES, POSTURE_RISK_LEVELS, RECOMMENDATION_STATUS, RESOURCE_TYPES,
} from '@shared/contracts.js';
import { api } from '../services/api.js';
import AppMark from '../components/common/AppMark.jsx';
import EmptyState from '../components/common/EmptyState.jsx';
import LoadingState from '../components/common/LoadingState.jsx';
import PageHeader from '../components/common/PageHeader.jsx';
import Panel from '../components/common/Panel.jsx';
import StatusBadge from '../components/common/StatusBadge.jsx';
import TrustRing from '../components/common/TrustRing.jsx';
import PermissionGrid from '../components/security/PermissionGrid.jsx';
import {
  ALERT_LABELS, EVENT_LABELS, RESOURCE_LABELS, AlertRows, ApiUnavailable, Button, ErrorBlock,
  Icon, Pagination, SelectField, TextField, activityTone, appName, formatDate, humanize,
  levelLabel, usePagedRows,
} from '../components/common/LegacyControls.jsx';

export function KpiCard({ label, value, suffix = '', detail, icon, tone = 'neutral' }) {
  return (
    <article className={`kpi-card kpi-${tone}`}>
      <div className="kpi-topline"><span>{label}</span><span className="kpi-icon">{icon}</span></div>
      <div className="kpi-value">{value}<small>{suffix}</small></div>
      <p>{detail}</p>
    </article>
  );
}

export function PosturePage({ apps, refreshKey, onNotify }) {
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
    const [overviewResult, appResult, findingResult, trendResult, incidentResult, policyResult] = await Promise.allSettled([
      api.getPostureOverview({ days }),
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

    const nextErrors = {};
    if (overviewResult.status === 'fulfilled') setOverview(overviewResult.value);
    else nextErrors.overview = overviewResult.reason;
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
  const trendMax = Math.max(1, ...trendRows.map((row) => row.allowed + row.blocked));

  return (
    <>
      <PageHeader
        eyebrow="Simulated application security"
        title="Security posture"
        description="A backend-derived view of permission exposure, recorded runtime activity, findings, and trust trends. No cloud or operating-system scanning is implied."
        actions={(
          <SelectField label="Trend range" value={days} onChange={setDays} options={[
            { value: '7', label: 'Last 7 days' },
            { value: '30', label: 'Last 30 days' },
          ]} />
        )}
      />

      {loading && <div className="refresh-indicator"><span className="spinner" />Refreshing posture records</div>}
      {errors.overview && <ErrorBlock error={errors.overview} endpoint="Posture overview" />}

      <section className="kpi-grid posture-kpi-grid" aria-label="Security posture summary">
        <KpiCard label="Monitored applications" value={summary.totalApplications ?? '—'} detail="Applications in the API database" icon="▦" />
        <KpiCard label="Critical risk" value={summary.criticalRiskApplications ?? '—'} detail="Posture risk score below 40" icon="!" tone="danger" />
        <KpiCard label="High risk" value={summary.highRiskApplications ?? '—'} detail="Posture risk score from 40 to 59" icon="◇" tone="warning" />
        <KpiCard label="Open findings" value={summary.openFindings ?? '—'} detail="Unresolved posture findings" icon="⌕" tone="espresso" />
        <KpiCard label="Critical alerts" value={summary.unacknowledgedCriticalAlerts ?? '—'} detail="Unacknowledged critical alerts" icon="!" tone="danger" />
        <KpiCard label="Blocked runtime events" value={summary.blockedRuntimeEvents ?? '—'} detail={`Recorded in the last ${days} days`} icon="×" tone="warning" />
      </section>

      <div className="dashboard-grid posture-grid">
        <Panel title="Application risk overview" eyebrow="Trust-based prioritization" className="span-two">
          {errors.applications ? <ErrorBlock error={errors.applications} endpoint="Application posture" /> : applicationRows.length ? (
            <div className="posture-table-wrap">
              <table className="posture-table">
                <thead><tr><th>Application</th><th>Trust</th><th>Risk</th><th>Findings</th><th>Last activity</th><th>Trend</th></tr></thead>
                <tbody>
                  {applicationRows.map((app) => (
                    <tr key={app.id}>
                      <td><button className="posture-app-cell posture-detail-link" onClick={() => openApplication(app)}><AppMark name={app.name} /><span><strong>{app.name}</strong><small>{app.category} · {app.isDemo ? 'simulated demo' : 'recorded app'}</small></span></button></td>
                      <td><strong>{app.trustScore}</strong><small className="posture-score-caption">posture {app.postureScore}</small></td>
                      <td><StatusBadge tone={app.riskLevel}>{levelLabel(app.riskLevel)}</StatusBadge></td>
                      <td>{app.unresolvedFindings}</td>
                      <td>{formatDate(app.lastActivity)}</td>
                      <td><StatusBadge tone={app.trend === 'improving' ? 'success' : app.trend === 'deteriorating' ? 'danger' : 'muted'}>{humanize(app.trend)}</StatusBadge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <EmptyState title="No application posture records">Application posture will appear after the API returns records.</EmptyState>}
        </Panel>

        <Panel title="Trust score distribution" eyebrow="Risk-adjusted posture score">
          <div className="posture-bars">
            {scoreRows.map((row) => (
              <div className="posture-bar-row" key={row.range}>
                <span>{row.range}</span>
                <div className="posture-bar-track"><i style={{ width: `${(row.count / distributionMax) * 100}%` }} /></div>
                <strong>{row.count}</strong>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Runtime security" eyebrow={`Last ${days} days`}>
          {overview?.runtime ? (
            <>
              <div className="runtime-summary">
                <div><strong>{overview.runtime.allowed}</strong><span>Allowed</span></div>
                <div><strong>{overview.runtime.blocked}</strong><span>Blocked</span></div>
                <div><strong>{overview.runtime.suspicious}</strong><span>Suspicious</span></div>
              </div>
              <p className="panel-note">Source: {overview.runtime.demoEvents} simulated demo events and {overview.runtime.recordedEvents} other recorded events. These are API records, not device monitoring.</p>
            </>
          ) : <EmptyState title="Runtime data unavailable">Recorded events are provided by the backend.</EmptyState>}
        </Panel>

        <Panel title="Security posture trend" eyebrow="Daily event volume" className="span-two">
          {errors.trends ? <ErrorBlock error={errors.trends} endpoint="Posture trends" /> : (
            <div className="posture-trend">
              {trendRows.map((row) => (
                <div className="posture-trend-day" key={row.date} title={`${row.date}: ${row.allowed} allowed, ${row.blocked} blocked`}>
                  <div className="posture-trend-columns">
                    <i className="trend-allowed" style={{ height: `${Math.max(3, (row.allowed / trendMax) * 100)}%` }} />
                    <i className="trend-blocked" style={{ height: `${Math.max(3, (row.blocked / trendMax) * 100)}%` }} />
                  </div>
                  <small>{row.date.slice(5)}</small>
                </div>
              ))}
            </div>
          )}
          <div className="posture-legend"><span><i className="trend-allowed" />Allowed</span><span><i className="trend-blocked" />Blocked</span><span>Resolved {trends?.findingStatus?.resolved ?? '—'} · Unresolved {trends?.findingStatus?.unresolved ?? '—'}</span></div>
        </Panel>

        <Panel title="Permission risk analytics" eyebrow="Declared vs enabled profile">
          <div className="permission-risk-grid">
            <div><strong>{overview?.permissionAnalytics?.excessive ?? '—'}</strong><span>Excessive permissions</span></div>
            <div><strong>{overview?.permissionAnalytics?.unused ?? '—'}</strong><span>Unused permissions</span></div>
            <div><strong>{overview?.permissionAnalytics?.riskyCombinations ?? '—'}</strong><span>Risky combinations</span></div>
          </div>
          <div className="resource-distribution">
            {(overview?.permissionAnalytics?.sensitiveResources || []).map((item) => (
              <div key={item.resource}><span>{humanize(item.resource)}</span><strong>{item.enabled}</strong></div>
            ))}
          </div>
        </Panel>
      </div>

      <Panel title="Security findings" eyebrow="Explainable posture signals">
        <div className="filter-toolbar posture-filters">
          <SelectField label="Application" value={appId} onChange={setAppId} options={[
            { value: '', label: 'All applications' },
            ...apps.map((app) => ({ value: app.id, label: app.name })),
          ]} />
          <SelectField label="Risk level" value={riskLevel} onChange={setRiskLevel} options={[
            { value: 'all', label: 'All risk levels' },
            ...Object.values(POSTURE_RISK_LEVELS).map((value) => ({ value, label: humanize(value) })),
          ]} />
          <SelectField label="Severity" value={severity} onChange={setSeverity} options={[
            { value: 'all', label: 'All severities' },
            ...Object.values(ALERT_SEVERITY).map((value) => ({ value, label: humanize(value) })),
          ]} />
          <SelectField label="Finding type" value={findingType} onChange={setFindingType} options={[
            { value: 'all', label: 'All finding types' },
            ...Object.values(POSTURE_FINDING_TYPES).map((value) => ({ value, label: humanize(value) })),
          ]} />
          <SelectField label="Status" value={findingStatus} onChange={setFindingStatus} options={[
            { value: 'all', label: 'Any status' },
            ...Object.values(FINDING_STATUS).map((value) => ({ value, label: humanize(value) })),
          ]} />
          <SelectField label="Resource" value={resource} onChange={setResource} options={[
            { value: 'all', label: 'All resources' },
            ...RESOURCE_TYPES.map((value) => ({ value, label: humanize(value) })),
          ]} />
          <TextField label="From" type="date" value={from} onChange={setFrom} />
          <TextField label="To" type="date" value={to} onChange={setTo} />
        </div>
        {errors.findings ? <ErrorBlock error={errors.findings} endpoint="Security findings" /> : findings.length ? (
          <div className="posture-table-wrap">
            <table className="posture-table">
              <thead><tr><th>Finding</th><th>Application</th><th>Severity</th><th>Resource</th><th>Status</th><th>Detected</th><th>Actions</th></tr></thead>
              <tbody>
                {findings.map((finding) => (
                  <tr key={finding.id}>
                    <td><button className="posture-detail-link" onClick={() => openFinding(finding)}>{finding.title}</button><small>{finding.reason}</small></td>
                    <td>{appName(apps, finding.appId)}</td>
                    <td><StatusBadge tone={finding.severity}>{humanize(finding.severity)}</StatusBadge></td>
                    <td>{finding.permissionResources.map(humanize).join(', ') || '—'}</td>
                    <td><StatusBadge tone={finding.status === FINDING_STATUS.RESOLVED ? 'success' : finding.status === FINDING_STATUS.ACKNOWLEDGED ? 'muted' : 'warning'}>{humanize(finding.status)}</StatusBadge></td>
                    <td>{formatDate(finding.detectedAt)}</td>
                    <td className="posture-actions">
                      {finding.status !== FINDING_STATUS.ACKNOWLEDGED && finding.status !== FINDING_STATUS.RESOLVED && (
                        <Button disabled={Boolean(workingId)} onClick={() => changeFinding(finding, 'acknowledge')}>{workingId === `acknowledge-${finding.id}` ? 'Saving…' : 'Acknowledge'}</Button>
                      )}
                      {finding.status !== FINDING_STATUS.RESOLVED && finding.findingType === POSTURE_FINDING_TYPES.POLICY_VIOLATION && (
                        <Button disabled={Boolean(workingId)} onClick={() => changeFinding(finding, 'resolve')}>{workingId === `resolve-${finding.id}` ? 'Saving…' : 'Resolve'}</Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <EmptyState title="No findings match these filters">Try another application, severity, status, resource, or date range.</EmptyState>}
      </Panel>

      <div className="dashboard-grid posture-grid">
        <Panel title="Incident timeline" eyebrow="One record per underlying event">
          {errors.incidents ? <ErrorBlock error={errors.incidents} endpoint="Incident intelligence" /> : incidents.length ? (
            <div className="incident-list">
              {incidents.map((incident) => (
                <button className="incident-row" key={incident.eventId} onClick={() => openIncident(incident)}>
                  <span className={`severity-mark severity-${incident.severity}`} />
                  <span><strong>{incident.applicationName} · {humanize(incident.resource)}</strong><small>{incident.observed}</small></span>
                  <StatusBadge tone={incident.decision === 'blocked' ? 'danger' : 'muted'}>{humanize(incident.decision)}</StatusBadge>
                </button>
              ))}
            </div>
          ) : <EmptyState title="No incidents in range">Incidents are derived from recorded denied or suspicious access events.</EmptyState>}
        </Panel>

        <Panel title="Security policies" eyebrow="Configuration posture">
          {errors.policies ? <ErrorBlock error={errors.policies} endpoint="Security policies" /> : policies.length ? (
            <div className="policy-list">
              {policies.map((policy) => (
                <article className="policy-row" key={policy.ruleId}>
                  <div><strong>{policy.name}</strong><small>{policy.description} Threshold: {policy.threshold} · {humanize(policy.severity)}</small></div>
                  <label className="policy-number-field"><span>Threshold</span><input type="number" min="1" max="1000" value={policyEdits[policy.ruleId]?.threshold ?? policy.threshold} onChange={(event) => setPolicyEdits((current) => ({ ...current, [policy.ruleId]: { ...current[policy.ruleId], threshold: event.target.value } }))} /></label>
                  <label className="policy-number-field"><span>Weight</span><input type="number" min="0" max="100" value={policyEdits[policy.ruleId]?.weight ?? policy.weight} onChange={(event) => setPolicyEdits((current) => ({ ...current, [policy.ruleId]: { ...current[policy.ruleId], weight: event.target.value } }))} /></label>
                  <div className="policy-actions">
                    <Button disabled={Boolean(workingId)} onClick={() => savePolicy(policy)}>{workingId === `policy-save-${policy.ruleId}` ? 'Saving…' : 'Save'}</Button>
                    <Button disabled={Boolean(workingId)} onClick={() => changePolicy(policy)}>{workingId === `policy-${policy.ruleId}` ? 'Saving…' : policy.enabled ? 'Disable' : 'Enable'}</Button>
                  </div>
                </article>
              ))}
            </div>
          ) : <EmptyState title="No policies configured">Security rules are loaded by the backend seed.</EmptyState>}
        </Panel>
      </div>

      {selectedFinding && (
        <div className="posture-detail-card" role="dialog" aria-modal="true" aria-label="Finding details">
          <div className="posture-detail-header"><div><span className="eyebrow">Finding details</span><h2>{selectedFinding.title}</h2></div><Button onClick={() => setSelectedFinding(null)}>Close</Button></div>
          <p>{selectedFinding.reason}</p>
          <p><strong>Affected resources:</strong> {selectedFinding.permissionResources.map(humanize).join(', ') || 'No direct permission'}</p>
          <p><strong>Recommended action:</strong> {selectedFinding.recommendedAction}</p>
          <p><strong>Rule:</strong> {selectedFinding.ruleId || 'Permission profile assessment'} · <strong>Last observed:</strong> {formatDate(selectedFinding.lastObservedAt)}</p>
          <ol className="finding-history">{selectedFinding.history.map((item, index) => <li key={`${item.timestamp}-${index}`}><strong>{humanize(item.status)}</strong><time>{formatDate(item.timestamp)}</time><span>{item.note}</span></li>)}</ol>
        </div>
      )}

      {selectedPostureApp && (
        <div className="posture-detail-card" role="dialog" aria-modal="true" aria-label="Application security posture">
          <div className="posture-detail-header"><div><span className="eyebrow">Application security posture</span><h2>{selectedPostureApp.name}</h2></div><Button onClick={() => setSelectedPostureApp(null)}>Close</Button></div>
          <p>{selectedPostureApp.description}</p>
          <p><StatusBadge tone={selectedPostureApp.riskLevel}>{humanize(selectedPostureApp.riskLevel)} risk</StatusBadge> <strong>Trust {selectedPostureApp.trustScore}/100 · posture {selectedPostureApp.postureScore}/100</strong></p>
          <ul className="explanation-list">{selectedPostureApp.riskBreakdown.explanations.map((line, index) => <li key={`${index}-${line}`}>{line}</li>)}</ul>
          <p><strong>Enabled permissions:</strong> {RESOURCE_TYPES.filter((item) => selectedPostureApp.permissions[item]?.enabled).map(humanize).join(', ') || 'None'}</p>
          <p><strong>Declared permissions:</strong> {selectedPostureApp.expectedPermissions.map(humanize).join(', ') || 'None declared'}</p>
          <p><strong>Permission usage:</strong> {RESOURCE_TYPES.map((item) => `${humanize(item)}: ${humanize(selectedPostureApp.permissionRisk.usageDetails[item].status)}`).join(' · ')}</p>
          <p><strong>Recommended actions:</strong> {selectedPostureApp.recommendedActions.join(' · ') || 'No open actions'}</p>
          <ol className="finding-history">{selectedPostureApp.recentEvents.map((item) => <li key={item.id}><strong>{humanize(item.status)} · {humanize(item.resource)}</strong><time>{formatDate(item.timestamp)}</time><span>{item.reason}{item.isDemo ? ' (simulated demo)' : ''}</span></li>)}</ol>
        </div>
      )}

      {selectedIncident && (
        <div className="posture-detail-card" role="dialog" aria-modal="true" aria-label="Incident details">
          <div className="posture-detail-header"><div><span className="eyebrow">Incident · {selectedIncident.simulated ? 'Simulated demo record' : 'Recorded event'}</span><h2>{selectedIncident.applicationName} · {humanize(selectedIncident.resource)}</h2></div><Button onClick={() => setSelectedIncident(null)}>Close</Button></div>
          <div className="incident-explanation-grid">
            <div><strong>What happened?</strong><span>{selectedIncident.whatHappened}</span></div>
            <div><strong>Expected</strong><span>{selectedIncident.expected}</span></div>
            <div><strong>Observed</strong><span>{selectedIncident.observed}</span></div>
            <div><strong>Rule and decision</strong><span>{selectedIncident.ruleTriggered.join(', ') || 'Permission evaluation'} · {humanize(selectedIncident.decision)}</span></div>
            <div><strong>Trust score impact</strong><span>{selectedIncident.trustScoreImpact ? `-${selectedIncident.trustScoreImpact}` : 'No linked score adjustment'}</span></div>
            <div><strong>Next step</strong><span>{selectedIncident.nextAction}</span></div>
          </div>
          <ol className="finding-history">{selectedIncident.timeline.map((item, index) => <li key={`${item.timestamp}-${index}`}><strong>{humanize(item.type)}</strong><time>{formatDate(item.timestamp)}</time><span>{item.description}</span></li>)}</ol>
        </div>
      )}
    </>
  );
}
