import { useCallback, useState } from 'react';
import { usePosture } from '../hooks/usePosture.js';
import { postureService } from '../services/postureService.js';
import PolicyRuleCard from '../components/security/PolicyRuleCard.jsx';
import EmptyState from '../components/common/EmptyState.jsx';
import ErrorState from '../components/common/ErrorState.jsx';
import LoadingState from '../components/common/LoadingState.jsx';

export default function PolicyManagement({ onNotify }) {
  const [edits, setEdits] = useState({});
  const [workingId, setWorkingId] = useState('');
  const loadPolicies = useCallback(() => postureService.getPolicies(), []);
  const { data, error, loading, setData } = usePosture(loadPolicies, [loadPolicies]);
  const policies = data || [];

  function setEdit(policy, field, value) {
    setEdits((current) => ({
      ...current,
      [policy.ruleId]: {
        threshold: current[policy.ruleId]?.threshold ?? String(policy.threshold),
        weight: current[policy.ruleId]?.weight ?? String(policy.weight),
        [field]: value,
      },
    }));
  }

  async function save(policy) {
    const values = edits[policy.ruleId];
    if (!values) return;
    setWorkingId(policy.ruleId);
    try {
      const updated = await postureService.updatePolicy(policy.ruleId, {
        threshold: Number(values.threshold),
        weight: Number(values.weight),
      });
      setData((current) => current.map((item) => item.ruleId === policy.ruleId ? updated : item));
      setEdits((current) => { const next = { ...current }; delete next[policy.ruleId]; return next; });
      onNotify(`${policy.name} configuration saved.`);
    } catch (cause) {
      onNotify(cause.message, 'error');
    } finally {
      setWorkingId('');
    }
  }

  async function toggle(policy) {
    setWorkingId(policy.ruleId);
    try {
      const updated = await postureService.updatePolicy(policy.ruleId, { enabled: !policy.enabled });
      setData((current) => current.map((item) => item.ruleId === policy.ruleId ? updated : item));
      onNotify(`${policy.name} ${updated.enabled ? 'enabled' : 'disabled'}.`);
    } catch (cause) {
      onNotify(cause.message, 'error');
    } finally {
      setWorkingId('');
    }
  }

  return (
    <>
      <header className="page-header">
        <div><span className="eyebrow">Backend-managed rule configuration</span><h1>Policy management</h1>
          <p>Thresholds, severity, and weights are persisted by the posture policy API.</p></div>
      </header>
      {loading && <LoadingState label="Loading persisted security policies" />}
      <ErrorState error={error} title="Security policies could not be loaded" />
      {!loading && !error && !policies.length && <EmptyState title="No policies configured">The policy endpoint returned no records.</EmptyState>}
      <section className="policy-rule-list">
        {policies.map((policy) => (
          <PolicyRuleCard
            key={policy.ruleId}
            policy={policy}
            values={edits[policy.ruleId] || { threshold: policy.threshold, weight: policy.weight }}
            onChange={(field, value) => setEdit(policy, field, value)}
            onToggle={() => toggle(policy)}
            onSave={() => save(policy)}
            busy={workingId === policy.ruleId}
          />
        ))}
      </section>
    </>
  );
}
