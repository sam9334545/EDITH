import { useCallback, useState } from 'react';
import { CheckCircle2, ShieldAlert, SlidersHorizontal, XCircle } from 'lucide-react';
import { usePosture } from '../hooks/usePosture.js';
import { postureService } from '../services/postureService.js';
import EmptyState from '../components/common/EmptyState.jsx';
import ErrorState from '../components/common/ErrorState.jsx';
import LoadingState from '../components/common/LoadingState.jsx';
import PageHeader from '../components/common/PageHeader.jsx';
import StatCard from '../components/common/StatCard.jsx';
import PolicyRuleCard from '../components/security/PolicyRuleCard.jsx';

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
      setEdits((current) => {
        const next = { ...current };
        delete next[policy.ruleId];
        return next;
      });
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

  const enabledCount = policies.filter((p) => p.enabled).length;
  const disabledCount = policies.filter((p) => !p.enabled).length;
  const highSeverityCount = policies.filter((p) => p.severity === 'critical' || p.severity === 'high').length;

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Backend-managed governance rules"
        title="Policy management"
        description="Tune detection thresholds, severity weights, and active enforcement toggles persisted by the posture policy API."
      />

      <div className="kpi-grid kpi-grid-4">
        <StatCard label="Configured rules" value={policies.length} detail="Persisted detection policies" icon={<SlidersHorizontal size={15} />} />
        <StatCard label="Active policies" value={enabledCount} detail="Evaluating runtime telemetry" icon={<CheckCircle2 size={15} />} tone="success" />
        <StatCard label="Disabled policies" value={disabledCount} detail="Paused evaluation rules" icon={<XCircle size={15} />} tone="neutral" />
        <StatCard label="High / Critical rules" value={highSeverityCount} detail="Elevated posture impact" icon={<ShieldAlert size={15} />} tone={highSeverityCount > 0 ? 'warning' : 'neutral'} />
      </div>

      {loading && <LoadingState label="Loading persisted security policies" />}
      <ErrorState error={error} title="Security policies could not be loaded" />
      {!loading && !error && !policies.length && (
        <EmptyState title="No policies configured">
          The policy endpoint returned no records.
        </EmptyState>
      )}

      <section className="policy-rule-grid" aria-label="Security policies">
        {policies.map((policy) => {
          const edit = edits[policy.ruleId];
          const isDirty = Boolean(
            edit && (Number(edit.threshold) !== policy.threshold || Number(edit.weight) !== policy.weight),
          );
          return (
            <PolicyRuleCard
              key={policy.ruleId}
              policy={policy}
              values={edit || { threshold: policy.threshold, weight: policy.weight }}
              isDirty={isDirty}
              onChange={(field, value) => setEdit(policy, field, value)}
              onToggle={() => toggle(policy)}
              onSave={() => save(policy)}
              busy={workingId === policy.ruleId}
            />
          );
        })}
      </section>
    </div>
  );
}
