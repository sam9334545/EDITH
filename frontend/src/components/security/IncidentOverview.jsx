import RiskBadge from '../common/RiskBadge.jsx';
import { formatDate, humanize, knownValue } from '../../utils/formatters.js';
import ScoreImpact from './ScoreImpact.jsx';

export default function IncidentOverview({ incident }) {
  if (!incident) return null;
  const title = `${humanize(incident.decision)} ${incident.resource} access`;
  return (
    <div className="incident-overview">
      <div className="incident-overview-heading">
        <div><span className="eyebrow">Persisted access event</span><h2>{title}</h2></div>
        <RiskBadge level={incident.severity} />
      </div>
      <dl className="incident-facts">
        <div><dt>Incident / event ID</dt><dd>{incident.eventId || incident.id}</dd></div>
        <div><dt>Current finding status</dt><dd>{incident.status ? humanize(incident.status) : 'Not recorded'}</dd></div>
        <div><dt>Timestamp</dt><dd>{formatDate(incident.timestamp)}</dd></div>
        <div><dt>Application</dt><dd>{knownValue(incident.applicationName)} · {knownValue(incident.appId)}</dd></div>
        <div><dt>Affected resource</dt><dd>{knownValue(incident.resource, humanize)}</dd></div>
        <div><dt>Decision</dt><dd>{knownValue(incident.decision, humanize)}</dd></div>
        <div><dt>What happened</dt><dd>{knownValue(incident.whatHappened)}</dd></div>
        <div><dt>Expected behaviour</dt><dd>{knownValue(incident.expected)}</dd></div>
        <div><dt>Observed behaviour</dt><dd>{knownValue(incident.observed)}</dd></div>
        <div><dt>Security rules</dt><dd>{incident.findings?.length
          ? incident.findings.map((item) => item.ruleId).filter(Boolean).map(humanize).join(', ') || 'No rule ID recorded'
          : incident.ruleTriggered?.length ? incident.ruleTriggered.map(humanize).join(', ') : 'Not recorded'}</dd></div>
        <div><dt>Recommended remediation</dt><dd>{knownValue(incident.nextAction)}</dd></div>
      </dl>
      {incident.findings?.length > 0 && (
        <div className="incident-rule-explanations">
          <h3>Rule explanations</h3>
          {incident.findings.map((finding) => (
            <article key={finding.id}>
              <strong>{finding.title}</strong>
              <p>{finding.reason}</p>
              <small>{finding.recommendedAction}</small>
            </article>
          ))}
        </div>
      )}
      {incident.alerts?.length > 0 && (
        <div className="incident-rule-explanations">
          <h3>Linked persisted alerts</h3>
          {incident.alerts.map((alert) => (
            <article key={alert.id}>
              <strong>{humanize(alert.type)} · {humanize(alert.severity)}</strong>
              <p>{alert.message}</p>
              <small>{alert.acknowledged ? 'Acknowledged' : 'Not acknowledged'}</small>
            </article>
          ))}
        </div>
      )}
      <ScoreImpact
        before={incident.trustScoreBefore}
        impact={incident.trustScoreChange}
        after={incident.trustScoreAfter}
      />
      <p className="panel-note">
        {Number.isFinite(incident.trustScoreImpact)
          ? `Persisted trust-history penalty: ${incident.trustScoreImpact} points.`
          : 'No linked persisted trust-score adjustment is available; score impact is not inferred.'}
      </p>
    </div>
  );
}
