import RiskBadge from '../common/RiskBadge.jsx';
import StatusBadge from '../common/StatusBadge.jsx';
import { formatDate } from '../../utils/formatters.js';

export default function FindingCard({ finding, onOpen, onAcknowledge, working = false }) {
  return (
    <article className="intelligence-card">
      <div className="intelligence-card-heading">
        <div><h3>{finding.title}</h3><span>{finding.applicationName || finding.appId}</span></div>
        <RiskBadge level={finding.severity} />
      </div>
      <p>{finding.reason}</p>
      <div className="intelligence-card-meta">
        <StatusBadge tone={finding.status}>{finding.status}</StatusBadge>
        <time>{formatDate(finding.detectedAt)}</time>
        {finding.permissionResources?.map((resource) => <span key={resource}>{resource}</span>)}
      </div>
      <div className="intelligence-card-actions">
        <button className="button" type="button" onClick={onOpen}>Explain finding</button>
        {finding.status === 'open' && (
          <button className="button" type="button" disabled={working} onClick={onAcknowledge}>
            Acknowledge
          </button>
        )}
      </div>
    </article>
  );
}
