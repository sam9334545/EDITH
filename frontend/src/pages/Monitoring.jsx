import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ACCESS_STATUS, ACTIVITY_EVENT_TYPES, ALERT_SEVERITY, ALERT_TYPES, APPLICATION_STATUS,
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

export function MonitoringPage({ apps, events, errors, onSimulate, busyAction, accessRequestResult }) {
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
  const filtered = useMemo(() => queriedEvents
    .filter((event) => `${event.reason} ${event.id} ${appName(apps, event.appId)}`.toLowerCase().includes(search.toLowerCase())), [
    queriedEvents, apps, search,
  ]);
  const pageData = usePagedRows(filtered, 10);

  return (
    <>
      <PageHeader eyebrow="Simulated runtime activity" title="Access monitoring" description="Inspect requests as they pass through the E.D.I.T.H. backend and simulate new activity." />
      <AccessRequestPanel apps={apps} onSubmit={onSimulate} busy={busyAction === 'simulate'} />
      {accessRequestResult && <AccessRequestResult result={accessRequestResult} />}
      <Panel title="Access event stream" eyebrow={`${events.length} recent records`}>
        {queryError ? <ErrorBlock error={queryError} endpoint="Access events" /> : (
          <>
            <div className="filter-toolbar">
              <TextField label="Search events" value={search} onChange={(value) => { setSearch(value); pageData.setPage(0); }} placeholder="Reason, app or event ID" />
              <SelectField label="Application" value={appFilter} onChange={(value) => { setAppFilter(value); pageData.setPage(0); }} options={[
                { value: 'all', label: 'All applications' },
                ...apps.map((app) => ({ value: app.id, label: app.name })),
              ]} />
              <SelectField label="Resource" value={resourceFilter} onChange={(value) => { setResourceFilter(value); pageData.setPage(0); }} options={[
                { value: 'all', label: 'All resources' },
                ...RESOURCE_TYPES.map((resource) => ({ value: resource, label: RESOURCE_LABELS[resource] })),
              ]} />
              <SelectField label="Decision" value={statusFilter} onChange={(value) => { setStatusFilter(value); pageData.setPage(0); }} options={[
                { value: 'all', label: 'All decisions' },
                { value: ACCESS_STATUS.ALLOWED, label: 'Allowed' },
                { value: ACCESS_STATUS.DENIED, label: 'Denied' },
              ]} />
              <SelectField label="Suspicious" value={suspiciousFilter} onChange={(value) => { setSuspiciousFilter(value); pageData.setPage(0); }} options={[
                { value: 'all', label: 'Any' }, { value: 'true', label: 'Yes' }, { value: 'false', label: 'No' },
              ]} />
            </div>
            {filtered.length ? (
              <div className="table-scroll">
                <table>
                  <thead><tr><th>Application</th><th>Resource</th><th>Reason</th><th>Timestamp</th><th>Decision</th><th>Signal</th><th>Alert ref.</th></tr></thead>
                  <tbody>
                    {pageData.visibleRows.map((event) => (
                      <tr key={event.id}>
                        <td><span className="table-app"><AppMark name={appName(apps, event.appId)} />{appName(apps, event.appId)}</span></td>
                        <td>{RESOURCE_LABELS[event.resource] || event.resource}</td>
                        <td className="truncate-cell" title={event.reason}>{event.reason || '—'}</td>
                        <td>{formatDate(event.timestamp)}</td>
                        <td><StatusBadge tone={event.status === ACCESS_STATUS.ALLOWED ? 'success' : 'danger'}>{humanize(event.status)}</StatusBadge></td>
                        <td>{event.suspicious ? <StatusBadge tone="warning">Suspicious</StatusBadge> : <span className="muted-text">—</span>}</td>
                        <td>{event.alertId || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <EmptyState title="No matching events">Events will appear after a simulated request is submitted.</EmptyState>}
            <Pagination page={pageData.page} pageCount={pageData.pageCount} total={filtered.length} onChange={pageData.setPage} />
          </>
        )}
      </Panel>
    </>
  );
}

function AccessRequestResult({ result }) {
  const summary = result.summary || {};
  const createdAlerts = Array.isArray(result.alertsCreated) ? result.alertsCreated : [];
  return (
    <Panel title="Latest simulation result" eyebrow="Backend response" className="access-request-result">
      <div className="access-request-result-summary">
        <div><span>Total requests</span><strong>{summary.total ?? result.events?.length ?? '—'}</strong></div>
        <div><span>Allowed</span><strong>{summary.allowed ?? '—'}</strong></div>
        <div><span>Denied</span><strong>{summary.denied ?? '—'}</strong></div>
        {result.trustScore && <div><span>Trust score</span><strong>{result.trustScore.score ?? '—'} <small>{levelLabel(result.trustScore.level)}</small></strong></div>}
      </div>
      <div className="access-request-result-alerts">
        <strong>New alerts</strong>
        {createdAlerts.length ? createdAlerts.map((alert) => (
          <div className="access-request-created-alert" key={alert.id}>
            <span className={`severity-mark severity-${alert.severity}`} />
            <span>{ALERT_LABELS[alert.type] || humanize(alert.type)}</span>
            <StatusBadge tone={alert.severity}>{humanize(alert.severity)}</StatusBadge>
            <code>{alert.id}</code>
          </div>
        )) : <span className="muted-text">The backend returned no newly created alerts.</span>}
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
    <Panel title="Simulate an access request" eyebrow="Controlled test activity" className="access-request-panel">
      <form className="access-request-form" onSubmit={submit}>
        <SelectField label="Application" value={appId} onChange={setAppId} options={apps.map((app) => ({ value: app.id, label: app.name }))} />
        <SelectField label="Resource" value={resource} onChange={setResource} options={RESOURCE_TYPES.map((item) => ({ value: item, label: RESOURCE_LABELS[item] }))} />
        <TextField label="Request reason" value={reason} onChange={setReason} placeholder="e.g. Workout route tracking" maxLength={160} />
        <TextField label="Request count" type="number" min="1" max="100" value={count} onChange={setCount} required />
        <Button type="submit" variant="primary" disabled={busy || !appId || Number(count) < 1 || Number(count) > 100}>
          {busy ? 'Generating…' : 'Generate requests'} <Icon>↗</Icon>
        </Button>
      </form>
      <p className="form-note"><Icon>i</Icon> Requests are simulated through the backend. The backend decides whether each request is allowed.</p>
    </Panel>
  );
}
