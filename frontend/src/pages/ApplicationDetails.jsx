import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, ArrowUpRight } from 'lucide-react';
import { api } from '../services/api.js';
import { usePosture } from '../hooks/usePosture.js';
import { RESOURCE_TYPES } from '@shared/contracts.js';
import AppMark from '../components/common/AppMark.jsx';
import EmptyState from '../components/common/EmptyState.jsx';
import ErrorState from '../components/common/ErrorState.jsx';
import LoadingState from '../components/common/LoadingState.jsx';
import PageHeader from '../components/common/PageHeader.jsx';
import Panel from '../components/common/Panel.jsx';
import RiskBadge from '../components/common/RiskBadge.jsx';
import StatusBadge from '../components/common/StatusBadge.jsx';
import TrustRing from '../components/common/TrustRing.jsx';
import { ResourceIcon } from '../components/common/AppIcon.jsx';
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
    <div className="page-stack">
      <PageHeader
        eyebrow={`Persisted application posture · ${appId}`}
        title={app?.name || 'Application details'}
        description="Permission exposure, dynamic trust score, posture score, findings, and recorded runtime incidents from the backend."
        actions={(
          <button type="button" className="button" onClick={onBack}>
            <ArrowLeft size={14} aria-hidden="true" /> Back to applications
          </button>
        )}
      />

      {loading && <LoadingState label="Loading application posture" />}
      <ErrorState error={error} title="Application posture could not be loaded" />
      {!loading && !error && !app && (
        <EmptyState title="Application not found">
          The backend did not return this application.
        </EmptyState>
      )}

      {app && (
        <>
          <section className="application-detail-summary">
            <AppMark name={app.name} size="lg" />
            <div className="app-detail-identity">
              <div className="app-detail-badges">
                <StatusBadge tone={app.status === 'active' ? 'success' : 'danger'}>{humanize(app.status)}</StatusBadge>
                <RiskBadge level={app.riskLevel} />
                {app.category && <StatusBadge tone="neutral">{humanize(app.category)}</StatusBadge>}
              </div>
              <strong>{app.name}</strong>
              <span>{app.description}</span>
            </div>
            <div className="app-detail-gauges">
              <div className="detail-gauge-box">
                <TrustRing score={app.trustScore} size="small" />
                <span>Trust Score</span>
              </div>
              <div className="detail-gauge-box">
                <TrustRing score={app.postureScore} size="small" />
                <span>Posture Score</span>
              </div>
            </div>
          </section>

          <div className="dashboard-grid posture-grid">
            <Panel title="Permission inventory" eyebrow="Persisted resource flags">
              <div className="detail-permissions-v2">
                {RESOURCE_TYPES.map((resource) => {
                  const enabled = app.permissions?.[resource]?.enabled;
                  const usage = app.permissionRisk?.usageDetails?.[resource]?.status;
                  return (
                    <div className="detail-perm-row" key={resource}>
                      <span className="detail-perm-left">
                        <ResourceIcon resource={resource} size={15} />
                        <strong>{humanize(resource)}</strong>
                      </span>
                      <span className="detail-perm-usage">{usage ? humanize(usage) : 'Not recorded'}</span>
                      <StatusBadge tone={enabled ? 'success' : 'muted'}>
                        {enabled ? 'Enabled' : 'Disabled'}
                      </StatusBadge>
                    </div>
                  );
                })}
              </div>
              <p className="panel-note" style={{ marginTop: '14px' }}>
                <strong>Declared expected permissions:</strong>{' '}
                {app.expectedPermissions?.length ? app.expectedPermissions.map(humanize).join(', ') : 'Not recorded'}
              </p>
            </Panel>

            <Panel title="Risk explanation" eyebrow="Backend scoring breakdown">
              <div className="risk-breakdown-box">
                <div className="risk-base-row">
                  <span>Base trust score</span>
                  <strong>{app.riskBreakdown?.baseTrustScore ?? 'Not recorded'}</strong>
                </div>
                <div className="risk-base-row">
                  <span>Last recorded activity</span>
                  <strong>{formatDate(app.lastActivity)}</strong>
                </div>
              </div>
              <ul className="explanation-list" style={{ marginTop: '14px' }}>
                {(app.riskBreakdown?.explanations || []).map((line, index) => (
                  <li key={`${index}-${line}`}>{line}</li>
                ))}
              </ul>
            </Panel>

            <Panel title="Related findings" eyebrow={`${app.findings?.length || 0} persisted records`}>
              {app.findings?.length ? (
                <div className="detail-items-list">
                  {app.findings.map((finding) => (
                    <article className="detail-line" key={finding.id}>
                      <div>
                        <strong>{finding.title}</strong>
                        <p className="detail-line-sub">{finding.reason}</p>
                      </div>
                      <button type="button" className="button button-xs" onClick={() => onOpenFinding(finding)}>
                        Explain <ArrowUpRight size={12} />
                      </button>
                    </article>
                  ))}
                </div>
              ) : (
                <EmptyState title="No findings returned">
                  No posture findings are linked to this application.
                </EmptyState>
              )}
            </Panel>

            <Panel title="Related incidents" eyebrow="Suspicious or blocked persisted events">
              <ErrorState error={incidentError} title="Incidents could not be loaded" />
              {!incidentError && incidents.length === 0 && (
                <EmptyState title="No related incidents">
                  No suspicious or blocked runtime records were returned.
                </EmptyState>
              )}
              {incidents.length > 0 && (
                <div className="detail-items-list">
                  {incidents.map((incident) => (
                    <div className="detail-line" key={incident.eventId}>
                      <div>
                        <strong>{humanize(incident.decision)} · {humanize(incident.resource)}</strong>
                        <p className="detail-line-sub">{formatDate(incident.timestamp)}</p>
                      </div>
                      <button type="button" className="button button-xs" onClick={() => onOpenFinding(null, incident.eventId)}>
                        Explain <ArrowUpRight size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}
