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

export function SecurityPage({ apps, alerts, events, errors, onAcknowledge, onViewAlert, busyAction }) {
  const [severity, setSeverity] = useState('all');
  const [type, setType] = useState('all');
  const [acknowledged, setAcknowledged] = useState('all');
  const [queriedAlerts, setQueriedAlerts] = useState(alerts);
  const [queryError, setQueryError] = useState(errors.alerts || null);
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
  const filtered = queriedAlerts;

  return (
    <>
      <PageHeader eyebrow="Threat signals" title="Security alerts" description="Review deterministic signals generated from simulated application behavior." />
      <div className="security-summary">
        <div><span>Rule coverage</span><strong>5</strong><small>R1–R5</small></div>
        <p>Alerts are produced by the backend security engine. This page never fabricates sample findings.</p>
      </div>
      <Panel title="Alert register" eyebrow={`${filtered.length} alerts`}>
        {queryError ? <ErrorBlock error={queryError} endpoint="Security alerts" /> : (
          <>
            <div className="filter-toolbar compact">
              <SelectField label="Severity" value={severity} onChange={setSeverity} options={[
                { value: 'all', label: 'All severities' },
                ...Object.values(ALERT_SEVERITY).map((value) => ({ value, label: humanize(value) })),
              ]} />
              <SelectField label="Alert type" value={type} onChange={setType} options={[
                { value: 'all', label: 'All alert types' },
                ...Object.entries(ALERT_LABELS).map(([value, label]) => ({ value, label })),
              ]} />
              <SelectField label="Acknowledgement" value={acknowledged} onChange={setAcknowledged} options={[
                { value: 'all', label: 'Any status' },
                { value: 'false', label: 'Needs review' },
                { value: 'true', label: 'Acknowledged' },
              ]} />
            </div>
            {filtered.length ? (
              <div className="alert-list">
                <AlertRows
                  alerts={filtered}
                  apps={apps}
                  events={events}
                  onAcknowledge={onAcknowledge}
                  onView={onViewAlert}
                  busyId={busyAction.replace('ack-', '')}
                />
              </div>
            ) : <EmptyState title="No alerts to show">Security alerts will appear here when the backend alert route is available.</EmptyState>}
          </>
        )}
      </Panel>
    </>
  );
}
