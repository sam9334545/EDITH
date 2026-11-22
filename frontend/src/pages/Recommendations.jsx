import { useState } from 'react';
import { CheckCircle2, ClipboardCheck, Clock, ShieldAlert } from 'lucide-react';
import { RECOMMENDATION_STATUS, SUGGESTED_ACTIONS } from '@shared/contracts.js';
import AppMark from '../components/common/AppMark.jsx';
import EmptyState from '../components/common/EmptyState.jsx';
import PageHeader from '../components/common/PageHeader.jsx';
import Panel from '../components/common/Panel.jsx';
import StatCard from '../components/common/StatCard.jsx';
import StatusBadge from '../components/common/StatusBadge.jsx';
import { ResourceIcon } from '../components/common/AppIcon.jsx';
import {
  Button,
  ErrorBlock,
  RESOURCE_LABELS,
  SUGGESTED_ACTION_LABELS,
  SelectField,
  appName,
  humanize,
} from '../components/common/LegacyControls.jsx';

export function RecommendationsPage({ apps = [], recommendations = [], errors = {}, onApplyRecommendation, busyAction }) {
  const [status, setStatus] = useState('all');
  const filtered = recommendations.filter((item) => status === 'all' || item.status === status);

  const pendingCount = recommendations.filter((r) => r.status === RECOMMENDATION_STATUS.PENDING).length;
  const appliedCount = recommendations.filter((r) => r.status === RECOMMENDATION_STATUS.APPLIED).length;
  const highImpactCount = recommendations.filter(
    (r) => r.status === RECOMMENDATION_STATUS.PENDING && (
      r.suggestedAction === SUGGESTED_ACTIONS.SUSPEND_APP || r.suggestedAction === SUGGESTED_ACTIONS.REVOKE_PERMISSION
    ),
  ).length;

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Guided idempotent remediation"
        title="Recommendations"
        description="Review corrective policies synthesized by the backend from security alerts and permission anomalies."
      />

      <div className="kpi-grid kpi-grid-4">
        <StatCard label="Total generated" value={recommendations.length} detail="Across all applications" icon={<ClipboardCheck size={15} />} />
        <StatCard label="Pending review" value={pendingCount} detail="Awaiting administrator action" icon={<Clock size={15} />} tone={pendingCount > 0 ? 'warning' : 'success'} />
        <StatCard label="Applied" value={appliedCount} detail="Idempotently enforced" icon={<CheckCircle2 size={15} />} tone="success" />
        <StatCard label="High-impact pending" value={highImpactCount} detail="Revoke or suspend actions" icon={<ShieldAlert size={15} />} tone={highImpactCount > 0 ? 'danger' : 'neutral'} />
      </div>

      <Panel
        title="Recommendation queue"
        eyebrow={`${filtered.length} matching records`}
        action={(
          <SelectField
            label="Filter status"
            value={status}
            onChange={setStatus}
            options={[
              { value: 'all', label: 'All statuses' },
              { value: RECOMMENDATION_STATUS.PENDING, label: 'Pending' },
              { value: RECOMMENDATION_STATUS.APPLIED, label: 'Applied' },
              { value: RECOMMENDATION_STATUS.DISMISSED, label: 'Dismissed' },
            ]}
          />
        )}
      >
        {errors.recommendations ? (
          <ErrorBlock error={errors.recommendations} endpoint="Recommendations" />
        ) : filtered.length ? (
          <div className="recommendation-grid">
            {filtered.map((item) => {
              const actionLabel = SUGGESTED_ACTION_LABELS[item.suggestedAction] || humanize(item.suggestedAction || 'review');
              const isHighImpact = item.suggestedAction === SUGGESTED_ACTIONS.SUSPEND_APP
                || item.suggestedAction === SUGGESTED_ACTIONS.REVOKE_PERMISSION;
              return (
                <article
                  className={`recommendation-card ${item.status === RECOMMENDATION_STATUS.PENDING ? 'recommendation-pending' : ''}`}
                  key={item.id}
                >
                  <div className="recommendation-card-head">
                    <div className="recommendation-app-chip">
                      <AppMark name={appName(apps, item.appId)} size="sm" />
                      <div>
                        <span className="eyebrow">{humanize(item.type)}</span>
                        <strong>{appName(apps, item.appId)}</strong>
                      </div>
                    </div>
                    <StatusBadge tone={item.status === RECOMMENDATION_STATUS.PENDING ? 'warning' : item.status === RECOMMENDATION_STATUS.APPLIED ? 'success' : 'muted'}>
                      {humanize(item.status)}
                    </StatusBadge>
                  </div>

                  <h3>{item.title}</h3>
                  <p>{item.description}</p>

                  <dl>
                    <div>
                      <dt>Resource</dt>
                      <dd className="rec-dd-icon">
                        {item.resource && <ResourceIcon resource={item.resource} size={12} />}
                        {RESOURCE_LABELS[item.resource] || item.resource || 'Application-wide'}
                      </dd>
                    </div>
                    <div>
                      <dt>Linked Alert</dt>
                      <dd>{item.alertId ? <code className="id-chip">{item.alertId}</code> : 'Not linked'}</dd>
                    </div>
                    <div>
                      <dt>Enforcement</dt>
                      <dd>{isHighImpact ? 'Policy Mutation' : 'Advisory'}</dd>
                    </div>
                  </dl>

                  <div className="recommendation-footer">
                    <span className="rec-action-label">{actionLabel}</span>
                    {item.status === RECOMMENDATION_STATUS.PENDING && (
                      <Button
                        variant={item.suggestedAction === SUGGESTED_ACTIONS.SUSPEND_APP ? 'danger' : 'primary'}
                        disabled={Boolean(busyAction)}
                        onClick={() => onApplyRecommendation(item)}
                      >
                        Apply recommendation
                      </Button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <EmptyState title="No recommendations available">
            Recommendations appear here when generated by the backend threat engine.
          </EmptyState>
        )}
      </Panel>

      <p className="data-note">
        Applying a recommendation can revoke permissions or suspend an application. Actions are idempotent and persisted by the backend.
      </p>
    </div>
  );
}
