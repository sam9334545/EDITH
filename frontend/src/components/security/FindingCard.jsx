import { ArrowUpRight } from 'lucide-react';
import RiskBadge from '../common/RiskBadge.jsx';
import StatusBadge from '../common/StatusBadge.jsx';
import { formatDate, humanize } from '../../utils/formatters.js';

export default function FindingCard({ finding, onOpen, onAcknowledge, working = false }) {
  return (
    <article className={`intelligence-card severity-border-${finding.severity || 'low'}`}>
      <div className="intelligence-card-heading">
        <div>
          <span className="finding-type-label">{humanize(finding.findingType || 'security_finding')}</span>
          <h3>{finding.title}</h3>
          <span className="finding-app-name">{finding.applicationName || finding.appId}</span>
        </div>
        <RiskBadge level={finding.severity} />
      </div>
      <p>{finding.reason}</p>
      {finding.recommendedAction && (
        <div className="finding-remediation-hint">
          <strong>Remediation:</strong> {finding.recommendedAction}
        </div>
      )}
      <div className="intelligence-card-meta">
        <StatusBadge tone={finding.status === 'resolved' ? 'success' : finding.status === 'acknowledged' ? 'muted' : 'warning'}>
          {humanize(finding.status)}
        </StatusBadge>
        <time>{formatDate(finding.detectedAt)}</time>
        {finding.permissionResources?.map((resource) => (
          <span className="resource-tag-mini" key={resource}>{humanize(resource)}</span>
        ))}
      </div>
      <div className="intelligence-card-actions">
        {finding.status === 'open' && (
          <button className="button" type="button" disabled={working} onClick={onAcknowledge}>
            {working ? 'Saving…' : 'Acknowledge'}
          </button>
        )}
        <button className="button button-primary" type="button" onClick={onOpen}>
          Inspect evidence <ArrowUpRight size={14} aria-hidden="true" />
        </button>
      </div>
    </article>
  );
}
