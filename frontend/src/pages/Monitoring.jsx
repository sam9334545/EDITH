import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Info,
  Terminal,
  XCircle,
} from 'lucide-react';
import { ACCESS_STATUS, RESOURCE_TYPES } from '@shared/contracts.js';
import { api } from '../services/api.js';
import AppMark from '../components/common/AppMark.jsx';
import EmptyState from '../components/common/EmptyState.jsx';
import PageHeader from '../components/common/PageHeader.jsx';
import Panel from '../components/common/Panel.jsx';
import StatCard from '../components/common/StatCard.jsx';
import StatusBadge from '../components/common/StatusBadge.jsx';
import { DecisionIcon, ResourceIcon } from '../components/common/AppIcon.jsx';
import {
  ALERT_LABELS,
  Button,
  ErrorBlock,
  Pagination,
  RESOURCE_LABELS,
  SelectField,
  TextField,
  appName,
  formatDate,
  humanize,
  levelLabel,
  usePagedRows,
} from '../components/common/LegacyControls.jsx';

export function MonitoringPage({ apps = [], events = [], errors = {}, onSimulate, busyAction, accessRequestResult }) {
  const [appFilter, setAppFilter] = useState('all');
  const [resourceFilter, setResourceFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [suspiciousFilter, setSuspiciousFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [queriedEvents, setQueriedEvents] = useState(events);
  const [queryError, setQueryError] = useState(errors.events || null);

  useEffect(() => {
    let active = true;
    api.getEvents({
      appId: appFilter === 'all' ? undefined : appFilter,
      resource: resourceFilter === 'all' ? undefined : resourceFilter,
      status: statusFilter === 'all' ? undefined : statusFilter,
      suspicious: suspiciousFilter === 'all' ? undefined : suspiciousFilter,
      limit: 200,
    }).then((data) => {
      if (!active) return;
      setQueriedEvents(data);
      setQueryError(null);
    }).catch((error) => {
      if (active) setQueryError(error);
    });
    return () => { active = false; };
  }, [appFilter, resourceFilter, statusFilter, suspiciousFilter, events]);

  const filtered = useMemo(
    () => queriedEvents.filter(
      (event) => `${event.reason} ${event.id} ${appName(apps, event.appId)}`.toLowerCase().includes(search.toLowerCase()),
    ),
    [queriedEvents, apps, search],
  );
  const pageData = usePagedRows(filtered, 10);

  const allowedCount = useMemo(() => filtered.filter((e) => e.status === ACCESS_STATUS.ALLOWED).length, [filtered]);
  const deniedCount = useMemo(() => filtered.filter((e) => e.status === ACCESS_STATUS.DENIED).length, [filtered]);
  const suspiciousCount = useMemo(() => filtered.filter((e) => e.suspicious).length, [filtered]);

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Simulated runtime activity telemetry"
        title="Access monitoring"
        description="Dispatch controlled test access requests through the E.D.I.T.H. backend pipeline and inspect real-time simulated allow/deny decisions."
        badge={(
          <span className="hero-sim-pill">
            <span className="status-dot-live" aria-hidden="true" />
            Simulated Stream
          </span>
        )}
      />

      <div className="kpi-grid kpi-grid-4">
        <StatCard label="Filtered events" value={filtered.length} detail="Returned by /api/events" icon={<Terminal size={15} />} />
        <StatCard label="Allowed" value={allowedCount} detail="Permitted by active permissions" icon={<CheckCircle2 size={15} />} tone="success" />
        <StatCard label="Denied" value={deniedCount} detail="Blocked by backend policies" icon={<XCircle size={15} />} tone={deniedCount > 0 ? 'danger' : 'neutral'} />
        <StatCard label="Suspicious signals" value={suspiciousCount} detail="Flagged by anomaly heuristics" icon={<AlertTriangle size={15} />} tone={suspiciousCount > 0 ? 'warning' : 'neutral'} />
      </div>

      <AccessRequestPanel apps={apps} onSubmit={onSimulate} busy={busyAction === 'simulate'} />
      {accessRequestResult && <AccessRequestResult result={accessRequestResult} />}

      <Panel title="Access event stream" eyebrow={`${filtered.length} matching records`}>
        {queryError ? (
          <ErrorBlock error={queryError} endpoint="Access events" />
        ) : (
          <>
            <div className="filter-toolbar">
              <TextField
                label="Search events"
                value={search}
                onChange={(value) => { setSearch(value); pageData.setPage(0); }}
                placeholder="Reason, app or event ID"
              />
              <SelectField
                label="Application"
                value={appFilter}
                onChange={(value) => { setAppFilter(value); pageData.setPage(0); }}
                options={[
                  { value: 'all', label: 'All applications' },
                  ...apps.map((app) => ({ value: app.id, label: app.name })),
                ]}
              />
              <SelectField
                label="Resource"
                value={resourceFilter}
                onChange={(value) => { setResourceFilter(value); pageData.setPage(0); }}
                options={[
                  { value: 'all', label: 'All resources' },
                  ...RESOURCE_TYPES.map((resource) => ({ value: resource, label: RESOURCE_LABELS[resource] })),
                ]}
              />
              <SelectField
                label="Decision"
                value={statusFilter}
                onChange={(value) => { setStatusFilter(value); pageData.setPage(0); }}
                options={[
                  { value: 'all', label: 'All decisions' },
                  { value: ACCESS_STATUS.ALLOWED, label: 'Allowed' },
                  { value: ACCESS_STATUS.DENIED, label: 'Denied' },
                ]}
              />
              <SelectField
                label="Suspicious"
                value={suspiciousFilter}
                onChange={(value) => { setSuspiciousFilter(value); pageData.setPage(0); }}
                options={[
                  { value: 'all', label: 'Any' },
                  { value: 'true', label: 'Suspicious only' },
                  { value: 'false', label: 'Normal only' },
                ]}
              />
            </div>

            {filtered.length ? (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Application</th>
                      <th>Resource</th>
                      <th>Reason</th>
                      <th>Timestamp</th>
                      <th>Decision</th>
                      <th>Signal</th>
                      <th>Alert Ref.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageData.visibleRows.map((event) => (
                      <tr key={event.id}>
                        <td>
                          <span className="table-app">
                            <AppMark name={appName(apps, event.appId)} size="sm" />
                            {appName(apps, event.appId)}
                          </span>
                        </td>
                        <td>
                          <span className="table-resource-cell">
                            <ResourceIcon resource={event.resource} size={14} />
                            {RESOURCE_LABELS[event.resource] || event.resource}
                          </span>
                        </td>
                        <td className="truncate-cell" title={event.reason}>{event.reason || '—'}</td>
                        <td className="mono-num">{formatDate(event.timestamp)}</td>
                        <td>
                          <StatusBadge tone={event.status === ACCESS_STATUS.ALLOWED ? 'success' : 'danger'}>
                            <DecisionIcon status={event.status} size={12} className="badge-icon-inline" />
                            {humanize(event.status)}
                          </StatusBadge>
                        </td>
                        <td>
                          {event.suspicious ? (
                            <StatusBadge tone="warning">Suspicious</StatusBadge>
                          ) : (
                            <span className="muted-text">Normal</span>
                          )}
                        </td>
                        <td>
                          {event.alertId ? <code className="id-chip">{event.alertId}</code> : <span className="muted-text">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState title="No matching events" icon={<Activity size={18} />}>
                Events will appear after a simulated request is submitted.
              </EmptyState>
            )}
            <Pagination page={pageData.page} pageCount={pageData.pageCount} total={filtered.length} onChange={pageData.setPage} />
          </>
        )}
      </Panel>
    </div>
  );
}

function AccessRequestResult({ result }) {
  const summary = result.summary || {};
  const createdAlerts = Array.isArray(result.alertsCreated) ? result.alertsCreated : [];
  return (
    <Panel title="Latest simulation result" eyebrow="Backend pipeline response" className="access-request-result">
      <div className="access-request-result-summary">
        <div><span>Total requests</span><strong>{summary.total ?? result.events?.length ?? '—'}</strong></div>
        <div><span>Allowed</span><strong className="text-success">{summary.allowed ?? '—'}</strong></div>
        <div><span>Denied</span><strong className="text-danger">{summary.denied ?? '—'}</strong></div>
        {result.trustScore && (
          <div>
            <span>Updated trust score</span>
            <strong>{result.trustScore.score ?? '—'} <small>{levelLabel(result.trustScore.level)}</small></strong>
          </div>
        )}
      </div>
      <div className="access-request-result-alerts">
        <strong>Triggered alerts</strong>
        {createdAlerts.length ? createdAlerts.map((alert) => (
          <div className="access-request-created-alert" key={alert.id}>
            <span className={`severity-mark severity-${alert.severity}`} />
            <span>{ALERT_LABELS[alert.type] || humanize(alert.type)}</span>
            <StatusBadge tone={alert.severity}>{humanize(alert.severity)}</StatusBadge>
            <code>{alert.id}</code>
          </div>
        )) : <span className="muted-text">No new heuristic alerts triggered by this batch.</span>}
      </div>
    </Panel>
  );
}

function AccessRequestPanel({ apps, onSubmit, busy }) {
  const [appId, setAppId] = useState('');
  const [resource, setResource] = useState(RESOURCE_TYPES[0]);
  const [reason, setReason] = useState('');
  const [count, setCount] = useState('1');

  useEffect(() => {
    if (!apps.some((app) => app.id === appId)) setAppId(apps[0]?.id || '');
  }, [apps, appId]);

  function submit(event) {
    event.preventDefault();
    onSubmit({ appId, resource, reason: reason.trim() || 'Simulated request', count: Number(count) });
  }

  return (
    <Panel title="Simulate an access request" eyebrow="Controlled test console" className="access-request-panel">
      <form className="access-request-form" onSubmit={submit}>
        <SelectField
          label="Application"
          value={appId}
          onChange={setAppId}
          options={apps.map((app) => ({ value: app.id, label: app.name }))}
        />
        <SelectField
          label="Resource"
          value={resource}
          onChange={setResource}
          options={RESOURCE_TYPES.map((item) => ({ value: item, label: RESOURCE_LABELS[item] }))}
        />
        <TextField
          label="Request reason"
          value={reason}
          onChange={setReason}
          placeholder="e.g. Workout route tracking"
          maxLength={160}
        />
        <TextField
          label="Count (1–100)"
          type="number"
          min="1"
          max="100"
          value={count}
          onChange={setCount}
          required
        />
        <Button type="submit" variant="primary" disabled={busy || !appId || Number(count) < 1 || Number(count) > 100}>
          {busy ? 'Generating…' : 'Generate requests'} <ArrowUpRight size={14} aria-hidden="true" />
        </Button>
      </form>
      <p className="form-note">
        <Info size={14} aria-hidden="true" />
        Requests execute against the simulated backend pipeline; the server remains the sole source of access decisions.
      </p>
    </Panel>
  );
}
