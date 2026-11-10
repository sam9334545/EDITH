import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Gauge,
  Plus,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { ADAPTIVE_TRUST_CONFIG, TRUST_LEVELS } from '@shared/contracts.js';
import { api } from '../services/api.js';
import AppMark from '../components/common/AppMark.jsx';
import EmptyState from '../components/common/EmptyState.jsx';
import ErrorState from '../components/common/ErrorState.jsx';
import LoadingState from '../components/common/LoadingState.jsx';
import PageHeader from '../components/common/PageHeader.jsx';
import Panel from '../components/common/Panel.jsx';
import ProductIllustration from '../components/common/ProductIllustration.jsx';
import StatCard from '../components/common/StatCard.jsx';
import StatusBadge from '../components/common/StatusBadge.jsx';
import TrustRing from '../components/common/TrustRing.jsx';
import { TrustTrajectoryChart } from '../components/charts/SecurityCharts.jsx';
import { formatDate, humanize } from '../utils/formatters.js';

const RISK_BADGES = {
  low_risk: { tone: 'success', label: 'Low Risk Profile' },
  moderate_risk: { tone: 'warning', label: 'Moderate Risk Profile' },
  elevated_risk: { tone: 'warning', label: 'Elevated Risk Profile' },
  high_risk: { tone: 'danger', label: 'High Risk Quarantine' },
};

export function AdaptiveTrustPage({ apps = [], onNotify }) {
  const [selectedAppId, setSelectedAppId] = useState(() => apps[0]?.id || 'app_01');
  const [profile, setProfile] = useState(null);
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionBusy, setActionBusy] = useState(false);

  const [recoveryPoints, setRecoveryPoints] = useState(5);
  const [recoveryReason, setRecoveryReason] = useState('Administrative compliance verification');

  useEffect(() => {
    if (!selectedAppId && apps.length > 0) {
      setSelectedAppId(apps[0].id);
    }
  }, [apps, selectedAppId]);

  const loadData = useCallback(async (appId) => {
    if (!appId) return;
    setLoading(true);
    setError(null);
    try {
      const [profileData, configData] = await Promise.all([
        api.getAdaptiveProfile(appId),
        api.getAdaptiveConfig(),
      ]);
      setProfile(profileData);
      setConfig(configData || {});
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData(selectedAppId);
  }, [loadData, selectedAppId]);

  const effectiveConfig = useMemo(() => ({
    escalationEnabled: Boolean(config?.escalationEnabled),
    escalationMultiplier: config?.escalationMultiplier ?? ADAPTIVE_TRUST_CONFIG.REPEATED_VIOLATION.ESCALATION_MULTIPLIER,
    cleanStreakThreshold: config?.cleanStreakThreshold ?? ADAPTIVE_TRUST_CONFIG.RECOVERY.CLEAN_STREAK_THRESHOLD,
    cleanStreakBonus: config?.cleanStreakBonus ?? ADAPTIVE_TRUST_CONFIG.RECOVERY.CLEAN_STREAK_BONUS,
    maxRecoveryCeiling: config?.maxRecoveryCeiling ?? ADAPTIVE_TRUST_CONFIG.RECOVERY.MAX_RECOVERY_CEILING,
    autoRecoveryOnRecommendation: Boolean(config?.autoRecoveryOnRecommendation),
  }), [config]);

  const handleManualRecovery = async (e) => {
    e?.preventDefault();
    if (!selectedAppId) return;
    setActionBusy(true);
    try {
      const result = await api.recoverAdaptiveTrust(selectedAppId, {
        points: Number(recoveryPoints),
        reason: recoveryReason,
      });
      onNotify?.(
        `Recovered ${result.pointsAwarded} points for ${profile?.appName || selectedAppId}. New score: ${result.newScore}.`,
        'success',
      );
      await loadData(selectedAppId);
    } catch (err) {
      onNotify?.(err.message || 'Recovery failed', 'error');
    } finally {
      setActionBusy(false);
    }
  };

  const handleCleanStreakAudit = async () => {
    if (!selectedAppId) return;
    setActionBusy(true);
    try {
      const result = await api.checkCleanStreak(selectedAppId);
      if (result.streakAwarded) {
        onNotify?.(`Clean streak verified! Awarded bonus points. New score: ${result.newScore}`, 'success');
      } else {
        onNotify?.(result.message || 'Clean streak threshold not yet met.', 'info');
      }
      await loadData(selectedAppId);
    } catch (err) {
      onNotify?.(err.message || 'Streak check failed', 'error');
    } finally {
      setActionBusy(false);
    }
  };

  const handleToggleEscalation = async () => {
    setActionBusy(true);
    try {
      const updated = await api.updateAdaptiveConfig({
        escalationEnabled: !effectiveConfig.escalationEnabled,
      });
      setConfig(updated);
      onNotify?.(
        `Escalation multiplier ${updated.escalationEnabled ? 'enabled' : 'disabled'}.`,
        'info',
      );
    } catch (err) {
      onNotify?.(err.message || 'Adaptive configuration update is not writable in this backend store.', 'error');
    } finally {
      setActionBusy(false);
    }
  };

  const risk = RISK_BADGES[profile?.riskCategory] || RISK_BADGES.low_risk;
  const comparedApps = useMemo(
    () => apps.slice().sort((a, b) => (a.trustScore ?? 101) - (b.trustScore ?? 101)).slice(0, 8),
    [apps],
  );

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Closed-loop behavioral governance"
        title="Adaptive Trust Engine"
        description="Dynamic evaluation model integrating repeated-violation penalty escalation, clean usage streak rewards, and audit-logged administrative recovery."
        actions={(
          <>
            <button
              type="button"
              className="button"
              onClick={() => loadData(selectedAppId)}
              disabled={loading || actionBusy}
            >
              <RefreshCw size={14} aria-hidden="true" /> Refresh
            </button>
            <button
              type="button"
              className="button"
              onClick={handleCleanStreakAudit}
              disabled={loading || actionBusy}
            >
              <Zap size={14} aria-hidden="true" /> Audit Clean Streak
            </button>
            <button
              type="button"
              className="button button-primary"
              onClick={() => handleManualRecovery()}
              disabled={loading || actionBusy}
            >
              <Plus size={14} aria-hidden="true" /> Restore Points
            </button>
          </>
        )}
      />

      <div className="split-intro-banner">
        <div className="split-intro-copy">
          <span className="eyebrow">Continuous Trust Calibration</span>
          <h2>Escalation &amp; Recovery Mechanics</h2>
          <p>
            Every security signal deducts deterministic severity points bounded between 0 and {effectiveConfig.maxRecoveryCeiling}. Repeated alerts within a 5-minute window trigger escalation weighting, while {effectiveConfig.cleanStreakThreshold} consecutive permitted operations or verified remediation credits progressively rebuild trust.
          </p>
        </div>
        <ProductIllustration
          src="/assets/adaptive-trust-engine.webp"
          alt="Central circular trust gauge receiving positive green recovery trajectories and negative stepped amber-crimson escalation penalties"
          variant="compact"
        />
      </div>

      <div className="kpi-grid kpi-grid-4">
        <StatCard
          label="Score ceiling"
          value={effectiveConfig.maxRecoveryCeiling}
          suffix="pts"
          detail="Deterministic score bounds [0–100]"
          icon={<Target size={15} />}
          tone="success"
        />
        <StatCard
          label="Escalation multiplier"
          value={effectiveConfig.escalationMultiplier}
          suffix="x"
          detail="Penalty multiplier on repeated violations"
          icon={<TrendingUp size={15} />}
          tone="warning"
        />
        <StatCard
          label="Clean streak gate"
          value={effectiveConfig.cleanStreakThreshold}
          suffix="calls"
          detail="Consecutive clean requests for bonus"
          icon={<ShieldCheck size={15} />}
          tone="info"
        />
        <StatCard
          label="Streak bonus"
          value={`+${effectiveConfig.cleanStreakBonus}`}
          suffix="pts"
          detail="Awarded per verified clean streak"
          icon={<Sparkles size={15} />}
          tone="neutral"
        />
      </div>

      <div className="dashboard-grid dashboard-grid-main">
        <div className="stack">
          <Panel
            title="Application risk evaluation"
            eyebrow="Backend adaptive trust state"
            action={(
              <label className="field inline-select-field">
                <span>Target Application</span>
                <select
                  value={selectedAppId}
                  onChange={(e) => setSelectedAppId(e.target.value)}
                  aria-label="Select Target Application"
                >
                  {apps.map((app) => (
                    <option key={app.id} value={app.id}>
                      {app.name} ({app.id})
                    </option>
                  ))}
                </select>
              </label>
            )}
          >
            {loading ? (
              <LoadingState label="Computing adaptive trust profile" />
            ) : error ? (
              <ErrorState title="Adaptive engine unavailable" error={error} />
            ) : !profile ? (
              <EmptyState title="No profile found">
                Select an application to inspect its adaptive trust factors.
              </EmptyState>
            ) : (
              <div className="adaptive-profile-body">
                <div className={`risk-banner risk-banner-${risk.tone}`}>
                  <div className="risk-banner-content">
                    <span className="eyebrow">Adaptive risk posture</span>
                    <h3>{profile.appName}</h3>
                    <div className="chip-cluster">
                      <StatusBadge tone={risk.tone}>{risk.label}</StatusBadge>
                      <StatusBadge tone={profile.level === TRUST_LEVELS.HIGH ? 'success' : 'warning'}>
                        {humanize(profile.level)} Trust
                      </StatusBadge>
                      <StatusBadge tone={profile.status === 'active' ? 'success' : 'danger'}>
                        {humanize(profile.status)}
                      </StatusBadge>
                    </div>
                  </div>
                  <div className="score-meter-wrap">
                    <TrustRing score={profile.currentScore ?? 0} level={profile.level} size="medium" />
                    <span className="score-label">Adaptive Score</span>
                  </div>
                </div>

                <div className="factors-overview-grid">
                  <div className="factor-box">
                    <span className="factor-title">Active threat alerts</span>
                    <span className={`factor-stat ${profile.factors?.activeAlertsCount > 0 ? 'text-danger' : 'text-success'}`}>
                      {profile.factors?.activeAlertsCount ?? 0}
                    </span>
                    <small>Unacknowledged risk signals</small>
                  </div>
                  <div className="factor-box">
                    <span className="factor-title">Total lifetime penalties</span>
                    <span className="factor-stat text-warning">
                      -{profile.factors?.totalPenalties ?? 0} pts
                    </span>
                    <small>Cumulative behavioral deductions</small>
                  </div>
                  <div className="factor-box">
                    <span className="factor-title">Recovered trust</span>
                    <span className="factor-stat text-success">
                      +{profile.factors?.totalRecovered ?? 0} pts
                    </span>
                    <small>Corrective &amp; administrative credits</small>
                  </div>
                </div>

                <div className="adaptive-trajectory-block">
                  <div className="section-title-row">
                    <h4>Trust score trajectory</h4>
                    <span className="badge badge-neutral">Persisted History</span>
                  </div>
                  <TrustTrajectoryChart records={profile.recentAdjustments || []} />
                </div>

                <div className="recent-adjustments-section">
                  <div className="section-title-row">
                    <h4>Recent adaptive score adjustments</h4>
                    <span className="badge badge-neutral">Audit Ledger</span>
                  </div>

                  {(!profile.recentAdjustments || profile.recentAdjustments.length === 0) ? (
                    <EmptyState title="No adjustments recorded">
                      No historical penalties or trust recoveries have been recorded for this app yet.
                    </EmptyState>
                  ) : (
                    <div className="table-scroll">
                      <table>
                        <thead>
                          <tr>
                            <th>Transition</th>
                            <th>Delta</th>
                            <th>Trigger Reason</th>
                            <th>Recorded At</th>
                          </tr>
                        </thead>
                        <tbody>
                          {profile.recentAdjustments.map((adj, idx) => {
                            const prev = Number.isFinite(adj.previousScore) ? adj.previousScore : null;
                            const next = Number.isFinite(adj.newScore)
                              ? adj.newScore
                              : Number.isFinite(adj.score)
                                ? adj.score
                                : null;
                            const explicitDelta = Number.isFinite(adj.appliedAdjustment)
                              ? adj.appliedAdjustment
                              : Number.isFinite(adj.penalty)
                                ? -adj.penalty
                                : null;
                            const delta = explicitDelta !== null
                              ? explicitDelta
                              : (prev !== null && next !== null ? next - prev : 0);
                            const isNegative = delta < 0;

                            return (
                              <tr key={adj.id || idx}>
                                <td className="mono-num">
                                  <strong>{prev !== null ? `${prev} → ${next}` : (next ?? '—')}</strong>
                                </td>
                                <td>
                                  <StatusBadge tone={isNegative ? 'danger' : delta > 0 ? 'success' : 'neutral'}>
                                    {delta > 0 ? `+${delta}` : delta} pts
                                  </StatusBadge>
                                </td>
                                <td>{adj.changeReason || adj.reason || 'Telemetry adjustment'}</td>
                                <td><time>{formatDate(adj.timestamp)}</time></td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}
          </Panel>
        </div>

        <div className="stack">
          <Panel title="Administrative recovery console" eyebrow="Manual trust credit">
            <form onSubmit={handleManualRecovery} className="recovery-form">
              <p className="panel-note">
                Credit recovery points after vulnerability remediation, code updates, or administrative review. Every recovery writes an immutable history entry.
              </p>

              <label className="field" htmlFor="recovery-pts">
                <span>Points to award (1 – 50)</span>
                <input
                  id="recovery-pts"
                  type="number"
                  min="1"
                  max="50"
                  value={recoveryPoints}
                  onChange={(e) => setRecoveryPoints(e.target.value)}
                  required
                />
              </label>

              <label className="field" htmlFor="recovery-reason">
                <span>Audit verification reason</span>
                <input
                  id="recovery-reason"
                  type="text"
                  value={recoveryReason}
                  onChange={(e) => setRecoveryReason(e.target.value)}
                  placeholder="e.g. Patch validated; security review approved"
                  required
                />
              </label>

              <button
                type="submit"
                className="button button-primary"
                style={{ width: '100%' }}
                disabled={actionBusy || loading}
              >
                <CheckCircle2 size={15} aria-hidden="true" />
                {actionBusy ? 'Applying Credit…' : 'Award Trust Recovery'}
              </button>
            </form>
          </Panel>

          <Panel title="Adaptive engine policy parameters" eyebrow="Runtime behavior rules">
            <div className="config-editor-list">
              <div className="config-row">
                <div className="config-meta">
                  <strong>Repeated-Violation Escalation</strong>
                  <small>Applies {effectiveConfig.escalationMultiplier}x multiplier within 5-minute repeat window</small>
                </div>
                <button
                  type="button"
                  className={`button button-xs ${effectiveConfig.escalationEnabled ? 'button-primary' : ''}`}
                  onClick={handleToggleEscalation}
                  disabled={actionBusy}
                >
                  {effectiveConfig.escalationEnabled ? 'Enabled' : 'Disabled'}
                </button>
              </div>

              <div className="config-row">
                <div className="config-meta">
                  <strong>Remediation Auto-Recovery</strong>
                  <small>Configured +{ADAPTIVE_TRUST_CONFIG.RECOVERY.ON_CORRECTIVE_ACTION} pts recovery when corrective policy applied</small>
                </div>
                <StatusBadge tone={effectiveConfig.autoRecoveryOnRecommendation ? 'success' : 'muted'}>
                  {effectiveConfig.autoRecoveryOnRecommendation ? 'Active' : 'Standard'}
                </StatusBadge>
              </div>

              <div className="config-row">
                <div className="config-meta">
                  <strong>Clean Streak Recovery Window</strong>
                  <small>{effectiveConfig.cleanStreakThreshold} consecutive permitted calls award +{effectiveConfig.cleanStreakBonus} pts</small>
                </div>
                <StatusBadge tone="neutral">{effectiveConfig.cleanStreakThreshold} calls</StatusBadge>
              </div>
            </div>
          </Panel>

          <Panel title="Workspace trust comparison" eyebrow="Lowest-scoring apps first">
            <div className="adaptive-compare-list">
              {comparedApps.map((app) => (
                <button
                  type="button"
                  key={app.id}
                  className={`adaptive-compare-row ${app.id === selectedAppId ? 'is-selected' : ''}`}
                  onClick={() => setSelectedAppId(app.id)}
                >
                  <AppMark name={app.name} size="sm" />
                  <div className="adaptive-compare-copy">
                    <strong>{app.name}</strong>
                    <div className="score-track">
                      <i
                        className={`trust-fill-${app.trustLevel || 'unknown'}`}
                        style={{ width: `${app.trustScore ?? 0}%` }}
                      />
                    </div>
                  </div>
                  <span className="mono-num adaptive-compare-score">{app.trustScore ?? '—'}</span>
                </button>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

export default AdaptiveTrustPage;
