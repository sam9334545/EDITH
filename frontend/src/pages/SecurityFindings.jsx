import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowUpRight, CheckCircle2, Radar, ShieldAlert } from 'lucide-react';
import { usePosture } from '../hooks/usePosture.js';
import { postureService } from '../services/postureService.js';
import { incidentService } from '../services/incidentService.js';
import { formatDate, humanize } from '../utils/formatters.js';
import EmptyState from '../components/common/EmptyState.jsx';
import ErrorState from '../components/common/ErrorState.jsx';
import LoadingState from '../components/common/LoadingState.jsx';
import PageHeader from '../components/common/PageHeader.jsx';
import Panel from '../components/common/Panel.jsx';
import StatCard from '../components/common/StatCard.jsx';
import StatusBadge from '../components/common/StatusBadge.jsx';
import FindingCard from '../components/security/FindingCard.jsx';
import { RiskDonutChart } from '../components/charts/SecurityCharts.jsx';

export default function SecurityFindings({ onOpenFinding, onOpenIncident, onNotify }) {
  const [status, setStatus] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');
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

  const allFindings = result?.items || [];
  const findings = useMemo(
    () => allFindings.filter((item) => severityFilter === 'all' || item.severity === severityFilter),
    [allFindings, severityFilter],
  );

  const openCount = allFindings.filter((f) => f.status === 'open').length;
  const criticalHighCount = allFindings.filter((f) => f.severity === 'critical' || f.severity === 'high').length;
  const resolvedCount = allFindings.filter((f) => f.status === 'resolved').length;

  const severityDistribution = useMemo(
    () => [
      { key: 'critical', label: 'Critical', count: allFindings.filter((f) => f.severity === 'critical').length, color: '#C94B4B' },
      { key: 'high', label: 'High', count: allFindings.filter((f) => f.severity === 'high').length, color: '#D97706' },
      { key: 'medium', label: 'Medium', count: allFindings.filter((f) => f.severity === 'medium').length, color: '#D99A32' },
      { key: 'low', label: 'Low', count: allFindings.filter((f) => f.severity === 'low').length, color: '#26745C' },
    ],
    [allFindings],
  );

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Explainable threat & posture intelligence"
        title="Security findings"
        description="Inspect persisted posture findings and denied runtime incidents. Open any finding to examine rule triggers, score impact, and chronological evidence."
        actions={(
          <div className="header-filter-pair">
            <label className="field">
              <span>Status</span>
              <select value={status} onChange={(event) => setStatus(event.target.value)}>
                <option value="all">All statuses</option>
                <option value="open">Open</option>
                <option value="acknowledged">Acknowledged</option>
                <option value="resolved">Resolved</option>
              </select>
            </label>
            <label className="field">
              <span>Severity</span>
              <select value={severityFilter} onChange={(event) => setSeverityFilter(event.target.value)}>
                <option value="all">All severities</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </label>
          </div>
        )}
      />

      <div className="kpi-grid kpi-grid-4">
        <StatCard label="Returned findings" value={allFindings.length} detail="Matching status query" icon={<Radar size={15} />} />
        <StatCard label="Open findings" value={openCount} detail="Requiring review" icon={<AlertTriangle size={15} />} tone={openCount > 0 ? 'warning' : 'success'} />
        <StatCard label="Critical & high" value={criticalHighCount} detail="Elevated priority exposure" icon={<ShieldAlert size={15} />} tone={criticalHighCount > 0 ? 'danger' : 'neutral'} />
        <StatCard label="Resolved" value={resolvedCount} detail="Closed posture records" icon={<CheckCircle2 size={15} />} tone="success" />
      </div>

      {allFindings.length > 0 && (
        <div className="findings-overview-strip">
          <Panel title="Finding severity breakdown" eyebrow="Persisted posture distribution">
            <RiskDonutChart items={severityDistribution} centerLabel="Findings" />
          </Panel>
          <Panel title="Incident evidence queue" eyebrow={`${incidents.length} recorded access incidents`}>
            <p className="panel-note">
              Every denied or suspicious runtime access event produces a forensic incident record linking rules, alerts, and trust score impact. Select any card below or incident row in the ledger to trace full evidence.
            </p>
            <div className="findings-summary-badges">
              <StatusBadge tone="danger">{incidents.filter((i) => i.decision === 'blocked').length} Blocked Events</StatusBadge>
              <StatusBadge tone="warning">{incidents.filter((i) => i.severity === 'high' || i.severity === 'critical').length} High/Critical Incidents</StatusBadge>
            </div>
          </Panel>
        </div>
      )}

      {loading && <LoadingState label="Loading persisted security findings" />}
      <ErrorState error={error} title="Security findings could not be loaded" />

      {findings.length ? (
        <section className="intelligence-grid" aria-label="Security findings">
          {findings.map((finding) => (
            <FindingCard
              key={finding.id}
              finding={finding}
              working={workingId === finding.id}
              onOpen={() => onOpenFinding(finding)}
              onAcknowledge={() => acknowledge(finding)}
            />
          ))}
        </section>
      ) : !loading && !error && (
        <EmptyState title="No findings match these filters">
          The backend returned no matching posture findings.
        </EmptyState>
      )}

      <Panel title="Persisted runtime incidents" eyebrow={`${incidents.length} suspicious or denied access events`}>
        <ErrorState error={incidentError} title="Incidents could not be loaded" />
        {!incidentError && incidents.length === 0 && (
          <EmptyState title="No recorded incidents">
            Only suspicious or denied persisted access events are listed here.
          </EmptyState>
        )}
        {incidents.length > 0 && (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Application</th>
                  <th>Resource</th>
                  <th>Decision</th>
                  <th>Severity</th>
                  <th>Status</th>
                  <th>Timestamp</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {incidents.map((incident) => (
                  <tr key={incident.eventId}>
                    <td>
                      <strong>{incident.applicationName}</strong>{' '}
                      <small className="table-sub-id">{incident.appId}</small>
                    </td>
                    <td>{humanize(incident.resource)}</td>
                    <td>
                      <StatusBadge tone={incident.decision === 'blocked' || incident.decision === 'denied' ? 'danger' : 'neutral'}>
                        {humanize(incident.decision)}
                      </StatusBadge>
                    </td>
                    <td><StatusBadge tone={incident.severity}>{humanize(incident.severity)}</StatusBadge></td>
                    <td>{incident.status ? humanize(incident.status) : 'Not recorded'}</td>
                    <td>{formatDate(incident.timestamp)}</td>
                    <td>
                      <button className="button button-xs" type="button" onClick={() => onOpenIncident(incident.eventId)}>
                        Explain <ArrowUpRight size={12} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
