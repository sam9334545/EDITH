import { useState } from 'react';
import { useIncidentDetails } from '../hooks/useIncidents.js';
import { incidentService } from '../services/incidentService.js';
import { formatDate, humanize } from '../utils/formatters.js';
import ErrorState from '../components/common/ErrorState.jsx';
import EmptyState from '../components/common/EmptyState.jsx';
import LoadingState from '../components/common/LoadingState.jsx';
import Panel from '../components/common/Panel.jsx';
import IncidentOverview from '../components/security/IncidentOverview.jsx';
import IncidentTimeline from '../components/security/IncidentTimeline.jsx';

const PERMISSION_FINDINGS = new Set(['excessive_permission', 'unused_permission', 'risky_combination']);

export default function IncidentDetails({ eventId, findingId, onBack, onNotify }) {
  const [reloadKey, setReloadKey] = useState(0);
  const [working, setWorking] = useState(false);
  const { incident, finding: selectedFinding, findings, policies, error, loading } = useIncidentDetails({
    eventId,
    findingId,
    reloadKey,
  });
  const finding = selectedFinding || findings.find((item) => (
    eventId && item.relatedEventIds?.includes(eventId)
  ));
  const activeRelatedFinding = incident?.findings?.find((item) => (
    finding ? item.id === finding.id : item.status !== 'resolved'
  ));
  const policyMap = new Map(policies.map((policy) => [policy.ruleId, policy]));
  const timeline = incident?.timeline || (finding?.history || []).map((item) => ({
    type: `finding_${item.status}`,
    timestamp: item.timestamp,
    description: item.note,
  }));
  const canAcknowledge = finding?.status === 'open'
    || activeRelatedFinding?.status === 'open'
    || incident?.alerts?.some((alert) => !alert.acknowledged);
  const canResolve = Boolean(finding)
    && finding.status !== 'resolved'
    && (!PERMISSION_FINDINGS.has(finding.findingType) || finding.conditionActive === false);

  async function updateStatus(action) {
    setWorking(true);
    try {
      if (finding) {
        if (action === 'acknowledge') await incidentService.acknowledgeFinding(finding.id);
        else await incidentService.resolveFinding(finding.id);
      } else {
        const alert = incident?.alerts?.find((item) => !item.acknowledged);
        if (!alert || action !== 'acknowledge') return;
        await incidentService.acknowledgeAlert(alert.id);
      }
      onNotify(action === 'acknowledge' ? 'Security record acknowledged.' : 'Finding resolved.');
      setReloadKey((key) => key + 1);
    } catch (cause) {
      onNotify(cause.message, 'error');
    } finally {
      setWorking(false);
    }
  }

  return (
    <>
      <header className="page-header">
        <div><span className="eyebrow">Evidence-led explanation</span><h1>Incident details</h1>
          <p>Incident and finding details are loaded from persisted events, alerts, findings, and trust history.</p></div>
        <button type="button" className="button" onClick={onBack}>Back to findings</button>
      </header>
      {loading && <LoadingState label="Loading persisted incident details" />}
      <ErrorState error={error} title="Incident details could not be loaded" />
      {!loading && !error && !incident && !finding && (
        <EmptyState title="Incident details unavailable">No incident or finding identifier was supplied.</EmptyState>
      )}
      {!loading && !error && finding && (
        <Panel title={finding.title} eyebrow={`Finding · ${finding.id}`}>
          <div className="incident-facts">
            <div><dt>Severity</dt><dd>{humanize(finding.severity)}</dd></div>
            <div><dt>Current status</dt><dd>{humanize(finding.status)}</dd></div>
            <div><dt>Application</dt><dd>{finding.applicationName || finding.appId} · {finding.appId}</dd></div>
            <div><dt>Detected</dt><dd>{formatDate(finding.detectedAt)}</dd></div>
            <div><dt>Evidence</dt><dd>{finding.reason}</dd></div>
            <div><dt>Security rule</dt><dd>{finding.ruleId ? humanize(finding.ruleId) : 'Not recorded'}</dd></div>
            <div><dt>Recommended remediation</dt><dd>{finding.recommendedAction}</dd></div>
          </div>
          {finding.ruleId && policyMap.has(finding.ruleId) && (
            <div className="incident-rule-explanations">
              <h3>Rule explanation</h3>
              <p>{policyMap.get(finding.ruleId).description}</p>
              <p><strong>Condition:</strong> {policyMap.get(finding.ruleId).condition}</p>
            </div>
          )}
          {canAcknowledge && <button className="button" disabled={working} onClick={() => updateStatus('acknowledge')}>Acknowledge finding</button>}
          {canResolve && <button className="button button-primary" disabled={working} onClick={() => updateStatus('resolve')}>Resolve finding</button>}
          {finding.relatedEventIds?.length > 0 && !incident && (
            <p className="panel-note">A related access event exists, but incident details could not be loaded from the available event identifier.</p>
          )}
        </Panel>
      )}
      {!loading && !error && incident && (
        <>
          <Panel title="Persisted incident" eyebrow={`Incident ID · ${incident.eventId}`}>
            <IncidentOverview incident={incident} />
            {incident.findings?.map((item) => {
              const policy = policyMap.get(item.ruleId);
              return policy ? (
                <div className="incident-rule-explanations" key={item.id}>
                  <h3>{policy.name}</h3>
                  <p>{policy.description}</p>
                  <p><strong>Rule condition:</strong> {policy.condition}</p>
                </div>
              ) : null;
            })}
            {canAcknowledge && <button className="button" disabled={working} onClick={() => updateStatus('acknowledge')}>Acknowledge linked record</button>}
            {canResolve && <button className="button button-primary" disabled={working} onClick={() => updateStatus('resolve')}>Resolve finding</button>}
          </Panel>
          <Panel title="Incident timeline" eyebrow="Persisted events in chronological order">
            <IncidentTimeline items={timeline} />
          </Panel>
        </>
      )}
      {!loading && !error && incident && !incident.findings?.length && !incident.alerts?.length && (
        <p className="panel-note">No persisted finding or alert is linked to this incident; acknowledgement and resolution are unavailable.</p>
      )}
    </>
  );
}
