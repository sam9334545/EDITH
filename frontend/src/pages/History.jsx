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

export function HistoryPage({ apps, history, errors }) {
  const [appId, setAppId] = useState('all');
  const [type, setType] = useState('all');
  const [limit, setLimit] = useState('100');
  const [queriedHistory, setQueriedHistory] = useState(history);
  const [queryError, setQueryError] = useState(errors.history || null);
  useEffect(() => {
    let active = true;
    api.getHistory({
      appId: appId === 'all' ? undefined : appId,
      type: type === 'all' ? undefined : type,
      limit: Number(limit),
    }).then((data) => {
      if (!active) return;
      setQueriedHistory(data);
      setQueryError(null);
    }).catch((error) => {
      if (active) setQueryError(error);
    });
    return () => { active = false; };
  }, [appId, type, limit, history]);
  const filtered = queriedHistory;
  return (
    <>
      <PageHeader eyebrow="Audit trail" title="Activity history" description="A chronological record of access, permission, trust and response activity." />
      <Panel title="Activity log" eyebrow={`${filtered.length} records`}>
        {queryError ? <ErrorBlock error={queryError} endpoint="Activity history" /> : (
          <>
            <div className="filter-toolbar compact">
              <SelectField label="Application" value={appId} onChange={setAppId} options={[
                { value: 'all', label: 'All applications' },
                ...apps.map((app) => ({ value: app.id, label: app.name })),
              ]} />
              <SelectField label="Activity type" value={type} onChange={setType} options={[
                { value: 'all', label: 'All activity' },
                ...Object.values(ACTIVITY_EVENT_TYPES).map((item) => ({ value: item, label: EVENT_LABELS[item] })),
              ]} />
              <SelectField label="Records" value={limit} onChange={setLimit} options={[
                { value: '25', label: 'Last 25' },
                { value: '50', label: 'Last 50' },
                { value: '100', label: 'Last 100' },
                { value: '200', label: 'Last 200' },
              ]} />
            </div>
            {filtered.length ? (
              <div className="table-scroll">
                <table>
                  <thead><tr><th>Activity</th><th>Application</th><th>Description</th><th>Timestamp</th><th>Details</th></tr></thead>
                  <tbody>
                    {filtered.map((item) => (
                      <tr key={item.id}>
                        <td><StatusBadge tone={activityTone(item.eventType)}>{EVENT_LABELS[item.eventType] || humanize(item.eventType)}</StatusBadge></td>
                        <td>{appName(apps, item.appId)}</td>
                        <td>{item.description}</td>
                        <td>{formatDate(item.timestamp)}</td>
                        <td className="metadata-cell">{metadataLabel(item.metadata)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <EmptyState title="No history records">History will appear after the backend history route is connected.</EmptyState>}
          </>
        )}
      </Panel>
    </>
  );
}

function metadataLabel(metadata) {
  if (!metadata || !Object.keys(metadata).length) return '—';
  return Object.entries(metadata)
    .map(([key, value]) => `${humanize(key)}: ${typeof value === 'object' ? JSON.stringify(value) : value}`)
    .join(' · ');
}
