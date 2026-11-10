import { useCallback, useEffect, useState } from 'react';
import { usePosture } from '../hooks/usePosture.js';
import { postureService } from '../services/postureService.js';
import { incidentService } from '../services/incidentService.js';
import { formatDate, humanize } from '../utils/formatters.js';
import EmptyState from '../components/common/EmptyState.jsx';
import ErrorState from '../components/common/ErrorState.jsx';
import LoadingState from '../components/common/LoadingState.jsx';
import StatusBadge from '../components/common/StatusBadge.jsx';
import FindingCard from '../components/security/FindingCard.jsx';

export default function SecurityFindings({ onOpenFinding, onOpenIncident, onNotify }) {
  const [status, setStatus] = useState('all');
  const [workingId, setWorkingId] = useState('');
  const [incidents, setIncidents] = useState([]);
  const [incidentError, setIncidentError] = useState(null);
  const loadFindings = useCallback(
    () => postureService.getFindings({ status: status === 'all' ? undefined : status, limit: 100 }),
    [status],
  );
  const { data: result, error, loading, setData } = usePosture(loadFindings, [loadFindings]);

  useEffect(() => {
    let active = true;
    incidentService.getIncidents()
      .then((incidentsResult) => incidentsResult.items || [])
      .then((items) => { if (active) setIncidents(items); })
      .catch((cause) => { if (active) setIncidentError(cause); });
    return () => { active = false; };
  }, []);

  async function acknowledge(finding) {
    setWorkingId(finding.id);
    try {
      await postureService.acknowledgeFinding(finding.id);
      onNotify('Finding acknowledged.');
      setData((current) => current && ({
        ...current,
        items: current.items.map((item) => item.id === finding.id ? { ...item, status: 'acknowledged' } : item),
      }));
    } catch (cause) {
      onNotify(cause.message, 'error');
    } finally {
      setWorkingId('');
    }
  }

  const findings = result?.items || [];
  return (
    <>
      <header className="page-header">
        <div><span className="eyebrow">Explainable security intelligence</span><h1>Security findings</h1>
          <p>Review persisted posture findings and recorded runtime incidents. Select a record to inspect its evidence and timeline.</p></div>
        <label className="field"><span>Finding status</span><select value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="all">All statuses</option>
          <option value="open">Open</option>
          <option value="acknowledged">Acknowledged</option>
          <option value="resolved">Resolved</option>
        </select></label>
      </header>
      {loading && <LoadingState label="Loading persisted security findings" />}
      <ErrorState error={error} title="Security findings could not be loaded" />
      <section className="intelligence-list">
        {findings.map((finding) => (
          <FindingCard
            key={finding.id}
            finding={finding}
            working={workingId === finding.id}
            onOpen={() => onOpenFinding(finding)}
            onAcknowledge={() => acknowledge(finding)}
          />
        ))}
        {!loading && !error && !findings.length && <EmptyState title="No findings match this status">The backend returned no matching posture findings.</EmptyState>}
      </section>
      <section className="panel">
        <div className="panel-heading"><div><span className="eyebrow">Persisted runtime evidence</span><h2>Incidents</h2></div></div>
        {incidentError && <ErrorState error={incidentError} title="Incidents could not be loaded" />}
        {!incidentError && incidents.length === 0 && <EmptyState title="No recorded incidents">Only suspicious or denied persisted access events are listed here.</EmptyState>}
        {incidents.length > 0 && (
          <div className="table-scroll">
            <table>
              <thead><tr><th>Application</th><th>Resource</th><th>Decision</th><th>Severity</th><th>Status</th><th>Timestamp</th><th /></tr></thead>
              <tbody>{incidents.map((incident) => (
                <tr key={incident.eventId}>
                  <td>{incident.applicationName} <small>{incident.appId}</small></td>
                  <td>{humanize(incident.resource)}</td>
                  <td>{humanize(incident.decision)}</td>
                  <td><StatusBadge tone={incident.severity}>{humanize(incident.severity)}</StatusBadge></td>
                  <td>{incident.status ? humanize(incident.status) : 'Not recorded'}</td>
                  <td>{formatDate(incident.timestamp)}</td>
                  <td><button className="button" type="button" onClick={() => onOpenIncident(incident.eventId)}>Explain</button></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
