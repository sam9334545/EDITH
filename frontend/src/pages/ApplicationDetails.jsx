import { useCallback, useEffect, useState } from 'react';
import { api } from '../services/api.js';
import { usePosture } from '../hooks/usePosture.js';
import { RESOURCE_TYPES } from '@shared/contracts.js';
import AppMark from '../components/common/AppMark.jsx';
import EmptyState from '../components/common/EmptyState.jsx';
import ErrorState from '../components/common/ErrorState.jsx';
import LoadingState from '../components/common/LoadingState.jsx';
import Panel from '../components/common/Panel.jsx';
import RiskBadge from '../components/common/RiskBadge.jsx';
import StatusBadge from '../components/common/StatusBadge.jsx';
import { formatDate, humanize } from '../utils/formatters.js';

export default function ApplicationDetails({ appId, onBack, onOpenFinding }) {
  const load = useCallback(() => api.getApplicationPosture(appId), [appId]);
  const { data: app, error, loading } = usePosture(load, [load]);
  const [incidents, setIncidents] = useState([]);
  const [incidentError, setIncidentError] = useState(null);

  useEffect(() => {
    let active = true;
    api.getPostureIncidents({ appId, limit: 20 })
      .then((result) => { if (active) setIncidents(result.items || []); })
      .catch((cause) => { if (active) setIncidentError(cause); });
    return () => { active = false; };
  }, [appId]);

  return (
    <>
      <header className="page-header">
        <div><span className="eyebrow">Persisted application posture</span><h1>{app?.name || 'Application details'}</h1>
          <p>Permission exposure, trust score, findings and recorded activity from the backend.</p></div>
        <button type="button" className="button" onClick={onBack}>Back to applications</button>
      </header>
      {loading && <LoadingState label="Loading application posture" />}
      <ErrorState error={error} title="Application posture could not be loaded" />
      {!loading && !error && !app && <EmptyState title="Application not found">The backend did not return this application.</EmptyState>}
      {app && (
        <>
          <section className="application-detail-summary">
            <AppMark name={app.name} /><div><strong>{app.name}</strong><span>{app.description}</span></div>
            <StatusBadge tone={app.status === 'active' ? 'success' : 'muted'}>{humanize(app.status)}</StatusBadge>
            <div className="detail-score-block"><span>Trust</span><strong>{Number.isFinite(app.trustScore) ? app.trustScore : 'Not recorded'}</strong></div>
            <div className="detail-score-block"><span>Posture</span><strong>{Number.isFinite(app.postureScore) ? app.postureScore : 'Not recorded'}</strong></div>
            <RiskBadge level={app.riskLevel} />
          </section>
          <div className="dashboard-grid">
            <Panel title="Permission inventory" eyebrow="Persisted configuration">
              <div className="detail-permissions">{RESOURCE_TYPES.map((resource) => (
                <div key={resource}><span>{humanize(resource)}</span><StatusBadge tone={app.permissions?.[resource]?.enabled ? 'success' : 'muted'}>{app.permissions?.[resource]?.enabled ? 'Enabled' : 'Disabled'}</StatusBadge><small>{app.permissionRisk?.usageDetails?.[resource]?.status ? humanize(app.permissionRisk.usageDetails[resource].status) : 'Usage not recorded'}</small></div>
              ))}</div>
              <p><strong>Declared:</strong> {app.expectedPermissions?.length ? app.expectedPermissions.map(humanize).join(', ') : 'Not recorded'}</p>
            </Panel>
            <Panel title="Risk explanation" eyebrow="Existing backend scoring">
              <p>Base trust score: {app.riskBreakdown?.baseTrustScore ?? 'Not recorded'}</p>
              {(app.riskBreakdown?.explanations || []).map((line, index) => <p key={`${index}-${line}`}>{line}</p>)}
              <p>Last activity: {formatDate(app.lastActivity)}</p>
            </Panel>
            <Panel title="Related findings" eyebrow={`${app.findings?.length || 0} persisted records`}>
              {app.findings?.length ? app.findings.map((finding) => (
                <article className="detail-line" key={finding.id}>
                  <div><strong>{finding.title}</strong><p>{finding.reason}</p></div>
                  <button type="button" className="button" onClick={() => onOpenFinding(finding)}>Explain</button>
                </article>
              )) : <EmptyState title="No findings returned">No posture findings are linked to this application.</EmptyState>}
            </Panel>
            <Panel title="Related incidents" eyebrow="Suspicious or blocked persisted events">
              <ErrorState error={incidentError} title="Incidents could not be loaded" />
              {!incidentError && incidents.length === 0 && <EmptyState title="No related incidents">No suspicious or blocked runtime records were returned.</EmptyState>}
              {incidents.map((incident) => (
                <div className="detail-line" key={incident.eventId}>
                  <strong>{humanize(incident.decision)} {humanize(incident.resource)} · {formatDate(incident.timestamp)}</strong>
                  <button type="button" className="button" onClick={() => onOpenFinding(null, incident.eventId)}>Explain</button>
                </div>
              ))}
            </Panel>
          </div>
        </>
      )}
    </>
  );
}
