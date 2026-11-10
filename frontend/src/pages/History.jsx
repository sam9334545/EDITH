import { useEffect, useMemo, useState } from 'react';
import { History as HistoryIcon, KeyRound, ShieldAlert, Terminal } from 'lucide-react';
import { ACTIVITY_EVENT_TYPES } from '@shared/contracts.js';
import { api } from '../services/api.js';
import AppMark from '../components/common/AppMark.jsx';
import EmptyState from '../components/common/EmptyState.jsx';
import PageHeader from '../components/common/PageHeader.jsx';
import Panel from '../components/common/Panel.jsx';
import StatCard from '../components/common/StatCard.jsx';
import StatusBadge from '../components/common/StatusBadge.jsx';
import {
  EVENT_LABELS,
  ErrorBlock,
  SelectField,
  activityTone,
  appName,
  formatDate,
  humanize,
} from '../components/common/LegacyControls.jsx';

export function HistoryPage({ apps = [], history = [], errors = {} }) {
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

  const accessCount = useMemo(
    () => filtered.filter((i) => i.eventType?.startsWith('access_')).length,
    [filtered],
  );
  const alertCount = useMemo(
    () => filtered.filter((i) => i.eventType === ACTIVITY_EVENT_TYPES.ALERT_CREATED).length,
    [filtered],
  );
  const governanceCount = useMemo(
    () => filtered.filter((i) => (
      i.eventType?.includes('permission') || i.eventType?.includes('app_') || i.eventType?.includes('recommendation')
    )).length,
    [filtered],
  );

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Immutable compliance & audit ledger"
        title="Activity history"
        description="Chronological audit trail recording every access decision, permission change, trust adjustment, alert, and remediation."
      />

      <div className="kpi-grid kpi-grid-4">
        <StatCard label="Loaded records" value={filtered.length} detail={`Query limit: ${limit}`} icon={<HistoryIcon size={15} />} />
        <StatCard label="Access decisions" value={accessCount} detail="Allowed and denied requests" icon={<Terminal size={15} />} tone="info" />
        <StatCard label="Alert records" value={alertCount} detail="Threat alerts generated" icon={<ShieldAlert size={15} />} tone={alertCount > 0 ? 'warning' : 'neutral'} />
        <StatCard label="Governance actions" value={governanceCount} detail="Permissions, status, remediations" icon={<KeyRound size={15} />} tone="success" />
      </div>

      <Panel title="Audit event ledger" eyebrow={`${filtered.length} chronological entries`}>
        {queryError ? (
          <ErrorBlock error={queryError} endpoint="Activity history" />
        ) : (
          <>
            <div className="filter-toolbar compact">
              <SelectField
                label="Application"
                value={appId}
                onChange={setAppId}
                options={[
                  { value: 'all', label: 'All applications' },
                  ...apps.map((app) => ({ value: app.id, label: app.name })),
                ]}
              />
              <SelectField
                label="Activity type"
                value={type}
                onChange={setType}
                options={[
                  { value: 'all', label: 'All activity' },
                  ...Object.values(ACTIVITY_EVENT_TYPES).map((item) => ({ value: item, label: EVENT_LABELS[item] })),
                ]}
              />
              <SelectField
                label="Records"
                value={limit}
                onChange={setLimit}
                options={[
                  { value: '25', label: 'Last 25' },
                  { value: '50', label: 'Last 50' },
                  { value: '100', label: 'Last 100' },
                  { value: '200', label: 'Last 200' },
                ]}
              />
            </div>

            {filtered.length ? (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Activity</th>
                      <th>Application</th>
                      <th>Description</th>
                      <th>Timestamp</th>
                      <th>Audit Metadata</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <StatusBadge tone={activityTone(item.eventType)}>
                            {EVENT_LABELS[item.eventType] || humanize(item.eventType)}
                          </StatusBadge>
                        </td>
                        <td>
                          <span className="table-app">
                            <AppMark name={appName(apps, item.appId)} size="sm" />
                            {appName(apps, item.appId)}
                          </span>
                        </td>
                        <td>{item.description}</td>
                        <td className="mono-num">{formatDate(item.timestamp)}</td>
                        <td className="metadata-cell"><MetadataPills metadata={item.metadata} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState title="No history records">
                History will appear after the backend history route returns entries.
              </EmptyState>
            )}
          </>
        )}
      </Panel>
    </div>
  );
}

function MetadataPills({ metadata }) {
  if (!metadata || !Object.keys(metadata).length) {
    return <span className="muted-text">—</span>;
  }
  return (
    <div className="metadata-pills">
      {Object.entries(metadata).map(([key, value]) => (
        <span className="metadata-pill" key={key}>
          <strong>{humanize(key)}:</strong> {typeof value === 'object' ? JSON.stringify(value) : String(value)}
        </span>
      ))}
    </div>
  );
}
