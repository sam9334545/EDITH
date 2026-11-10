import RiskBadge from '../common/RiskBadge.jsx';

export default function PolicyRuleCard({ policy, values, onChange, onToggle, onSave, busy }) {
  return (
    <article className="policy-rule-card">
      <div className="policy-rule-heading">
        <div><h3>{policy.name}</h3><code>{policy.ruleId}</code></div>
        <RiskBadge level={policy.severity} />
      </div>
      <p>{policy.description}</p>
      <p className="panel-note"><strong>Condition:</strong> {policy.condition}</p>
      <div className="policy-rule-controls">
        <label className="field">
          <span>Threshold</span>
          <input type="number" min="1" max="1000" value={values.threshold}
            onChange={(event) => onChange('threshold', event.target.value)} />
        </label>
        <label className="field">
          <span>Score weight</span>
          <input type="number" min="0" max="100" value={values.weight}
            onChange={(event) => onChange('weight', event.target.value)} />
        </label>
      </div>
      <div className="policy-rule-actions">
        <button type="button" className="button" disabled={busy} onClick={onToggle}>
          {policy.enabled ? 'Disable policy' : 'Enable policy'}
        </button>
        <button type="button" className="button button-primary" disabled={busy} onClick={onSave}>
          Save configuration
        </button>
      </div>
    </article>
  );
}
