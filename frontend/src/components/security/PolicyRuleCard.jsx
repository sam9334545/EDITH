import { SlidersHorizontal } from 'lucide-react';
import RiskBadge from '../common/RiskBadge.jsx';
import StatusBadge from '../common/StatusBadge.jsx';

export default function PolicyRuleCard({ policy, values, onChange, onToggle, onSave, busy, isDirty = false }) {
  return (
    <article className={`policy-rule-card ${!policy.enabled ? 'policy-card-disabled' : ''}`}>
      <div className="policy-rule-heading">
        <div className="policy-rule-title">
          <span className="policy-icon-badge" aria-hidden="true">
            <SlidersHorizontal size={16} />
          </span>
          <div>
            <h3>{policy.name}</h3>
            <code>{policy.ruleId}</code>
          </div>
        </div>
        <div className="policy-badges">
          <StatusBadge tone={policy.enabled ? 'success' : 'muted'}>
            {policy.enabled ? 'Enabled' : 'Disabled'}
          </StatusBadge>
          <RiskBadge level={policy.severity} />
        </div>
      </div>

      <p>{policy.description}</p>
      <p className="policy-condition-box">
        <strong>Condition:</strong> {policy.condition}
      </p>

      <div className="policy-rule-controls">
        <label className="field">
          <span>Threshold</span>
          <input
            type="number"
            min="1"
            max="1000"
            value={values.threshold}
            onChange={(event) => onChange('threshold', event.target.value)}
          />
        </label>
        <label className="field">
          <span>Score weight</span>
          <input
            type="number"
            min="0"
            max="100"
            value={values.weight}
            onChange={(event) => onChange('weight', event.target.value)}
          />
        </label>
      </div>

      <div className="policy-rule-actions">
        <button type="button" className="button" disabled={busy} onClick={onToggle}>
          {policy.enabled ? 'Disable rule' : 'Enable rule'}
        </button>
        <button
          type="button"
          className={`button ${isDirty ? 'button-primary' : ''}`}
          disabled={busy || !isDirty}
          onClick={onSave}
        >
          {isDirty ? 'Save changes' : 'Saved'}
        </button>
      </div>
    </article>
  );
}
