import { useCallback, useEffect, useState } from 'react';
import { TRUST_LEVELS } from '@shared/contracts.js';
import { api } from '../services/api.js';
import PageHeader from '../components/common/PageHeader.jsx';
import Panel from '../components/common/Panel.jsx';
import StatusBadge from '../components/common/StatusBadge.jsx';
import TrustRing from '../components/common/TrustRing.jsx';
import EmptyState from '../components/common/EmptyState.jsx';
import LoadingState from '../components/common/LoadingState.jsx';
import ErrorState from '../components/common/ErrorState.jsx';
import { formatDate } from '../utils/formatters.js';

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

  // Recovery Form State
  const [recoveryPoints, setRecoveryPoints] = useState(5);
  const [recoveryReason, setRecoveryReason] = useState('Administrative compliance verification');

  // Sync selectedAppId when apps populate
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
      setConfig(configData);
    } catch (err) {
      setError(err.message || 'Failed to load adaptive trust data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData(selectedAppId);
  }, [loadData, selectedAppId]);

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
        `Successfully recovered ${result.pointsAwarded} points for ${profile?.appName || selectedAppId}!`,
        'success',
      );
      await loadData(selectedAppId);
    } catch (err) {
      onNotify?.(err.message || 'Recovery failed', 'danger');
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
        onNotify?.(result.message || 'Clean streak threshold not yet met.', 'neutral');
      }
      await loadData(selectedAppId);
    } catch (err) {
      onNotify?.(err.message || 'Streak check failed', 'danger');
    } finally {
      setActionBusy(false);
    }
  };

  const handleToggleEscalation = async () => {
    if (!config) return;
    setActionBusy(true);
    try {
      const updated = await api.updateAdaptiveConfig({
        escalationEnabled: !config.escalationEnabled,
      });
      setConfig(updated);
      onNotify?.(
        `Escalation multiplier ${updated.escalationEnabled ? 'Enabled' : 'Disabled'}`,
        'info',
      );
    } catch (err) {
      onNotify?.(err.message || 'Config update failed', 'danger');
    } finally {
      setActionBusy(false);
    }
  };

  const risk = RISK_BADGES[profile?.riskCategory] || RISK_BADGES.low_risk;

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="CLOSED-LOOP BEHAVIORAL GOVERNANCE"
        title="Adaptive Trust Engine"
        description="Continuous evaluation algorithm featuring repeated-violation escalation, clean usage streak bonuses, and administrative trust score recovery."
        actions={
          <div className="action-row">
            <button
              type="button"
              className="button button-secondary"
              onClick={() => loadData(selectedAppId)}
              disabled={loading || actionBusy}
            >
              ↻ Refresh
            </button>
            <button
              type="button"
              className="button button-secondary"
              onClick={handleCleanStreakAudit}
              disabled={loading || actionBusy}
            >
              ⚡ Audit Clean Streak
            </button>
            <button
              type="button"
              className="button button-primary"
              onClick={() => handleManualRecovery()}
              disabled={loading || actionBusy}
            >
              + Restore Points
            </button>
          </div>
        }
      />

      {/* KPI Overview Grid */}
      <div className="kpi-grid">
        <article className="kpi-card kpi-success">
          <div className="kpi-topline"><span>MAX SCORE CEILING</span><span className="kpi-icon">🎯</span></div>
          <div className="kpi-value">100<small>pts</small></div>
          <p>Strict deterministic scoring bounds [0 - 100]</p>
        </article>
        <article className="kpi-card kpi-warning">
          <div className="kpi-topline"><span>ESCALATION MULTIPLIER</span><span className="kpi-icon">📈</span></div>
          <div className="kpi-value">{config?.escalationMultiplier ?? 1.5}<small>x</small></div>
          <p>Compound penalty on repeated threat occurrences</p>
        </article>
        <article className="kpi-card kpi-info">
          <div className="kpi-topline"><span>CLEAN STREAK THRESHOLD</span><span className="kpi-icon">🛡️</span></div>
          <div className="kpi-value">{config?.cleanStreakThreshold ?? 10}<small>calls</small></div>
          <p>Permitted requests required for automatic streak bonus</p>
        </article>
        <article className="kpi-card kpi-neutral">
          <div className="kpi-topline"><span>STREAK BONUS</span><span className="kpi-icon">✨</span></div>
          <div className="kpi-value">+{config?.cleanStreakBonus ?? 2}<small>pts</small></div>
          <p>Progressive recovery awarded per clean evaluation</p>
        </article>
      </div>

      {/* Main Adaptive Layout */}
      <div className="dashboard-grid dashboard-grid-main">
        {/* Left Column: App Profile & Risk Factors */}
        <div className="stack">
          <Panel
            title="Application Risk Evaluation"
            action={
              <div className="select-wrap">
                <select
                  value={selectedAppId}
                  onChange={(e) => setSelectedAppId(e.target.value)}
                  className="select-field"
                  aria-label="Select Target Application"
                >
                  {apps.map((app) => (
                    <option key={app.id} value={app.id}>
                      {app.name} ({app.id})
                    </option>
                  ))}
                </select>
              </div>
            }
          >
            {loading ? (
              <LoadingState message="Computing adaptive trust matrix..." />
            ) : error ? (
              <ErrorState title="Adaptive Engine Offline" message={error} />
            ) : !profile ? (
              <EmptyState title="No Profile Found">Select an application to inspect its adaptive trust factors.</EmptyState>
            ) : (
              <div className="adaptive-profile-body">
                {/* Score & Risk Banner */}
                <div className={`risk-banner risk-banner-${risk.tone}`}>
                  <div className="risk-banner-content">
                    <span className="text-overline">ADAPTIVE RISK POSTURE</span>
                    <h3>{profile.appName}</h3>
                    <div className="chip-cluster" style={{ marginTop: '6px' }}>
                      <StatusBadge tone={risk.tone}>{risk.label}</StatusBadge>
                      <StatusBadge tone={profile.level === TRUST_LEVELS.HIGH ? 'success' : 'warning'}>
                        {profile.level?.toUpperCase()} TRUST
                      </StatusBadge>
                      <StatusBadge tone={profile.status === 'active' ? 'success' : 'danger'}>
                        {profile.status?.toUpperCase()}
                      </StatusBadge>
                    </div>
                  </div>
                  <div className="score-meter-wrap">
                    <TrustRing score={profile.currentScore ?? 100} size={88} />
                    <span className="score-label">Adaptive Score</span>
                  </div>
                </div>

                {/* Factors Matrix */}
                <div className="factors-overview-grid">
                  <div className="factor-box">
                    <span className="factor-title">Active Threat Alerts</span>
                    <span className={`factor-stat ${profile.factors?.activeAlertsCount > 0 ? 'text-danger' : 'text-success'}`}>
                      {profile.factors?.activeAlertsCount ?? 0}
                    </span>
                    <small>Unacknowledged risk signals</small>
                  </div>
                  <div className="factor-box">
                    <span className="factor-title">Total Lifetime Penalties</span>
                    <span className="factor-stat text-warning">
                      -{profile.factors?.totalPenalties ?? 0} pts
                    </span>
                    <small>Cumulative behavioral deductions</small>
                  </div>
                  <div className="factor-box">
                    <span className="factor-title">Recovered Trust</span>
                    <span className="factor-stat text-success">
                      +{profile.factors?.totalRecovered ?? 0} pts
                    </span>
                    <small>Corrective & administrative credits</small>
                  </div>
                </div>

                {/* Score Movement Ledger */}
                <div className="recent-adjustments-section" style={{ marginTop: '24px' }}>
                  <div className="section-title-row">
                    <h4>Recent Adaptive Score Adjustments</h4>
                    <span className="badge badge-neutral">Audit Trail</span>
                  </div>

                  {(!profile.recentAdjustments || profile.recentAdjustments.length === 0) ? (
                    <p className="text-subtle" style={{ margin: '16px 0' }}>No historical score penalties or recoveries recorded yet.</p>
                  ) : (
                    <div className="table-wrap" style={{ marginTop: '12px' }}>
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Adjustment</th>
                            <th>Points</th>
                            <th>Trigger Reason</th>
                            <th>Recorded At</th>
                          </tr>
                        </thead>
                        <tbody>
                          {profile.recentAdjustments.map((adj, idx) => {
                            const isPenalty = Number(adj.penalty) > 0;
                            return (
                              <tr key={adj.id || idx}>
                                <td>
                                  <strong>{adj.score}</strong>
                                  <small className="text-subtle"> ({adj.level})</small>
                                </td>
                                <td>
                                  <span className={`badge badge-${isPenalty ? 'danger' : 'success'}`}>
                                    {isPenalty ? `-${adj.penalty}` : `+${adj.appliedAdjustment || 0}`} pts
                                  </span>
                                </td>
                                <td>{adj.changeReason || adj.reason || 'Telemetry adjustment'}</td>
                                <td><small>{formatDate(adj.timestamp)}</small></td>
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

        {/* Right Column: Recovery Console & Engine Settings */}
        <div className="stack">
          <Panel title="Administrative Recovery Console">
            <form onSubmit={handleManualRecovery} className="recovery-form">
              <p className="text-subtle">
                Manually credit recovery points to an application following vulnerability remediation, code updates, or administrative verification.
              </p>

              <div className="form-group" style={{ marginTop: '14px' }}>
                <label className="form-label" htmlFor="recovery-pts">Points to Award (1 - 50)</label>
                <input
                  id="recovery-pts"
                  type="number"
                  min="1"
                  max="50"
                  value={recoveryPoints}
                  onChange={(e) => setRecoveryPoints(e.target.value)}
                  className="input-field"
                  required
                />
              </div>

              <div className="form-group" style={{ marginTop: '14px' }}>
                <label className="form-label" htmlFor="recovery-reason">Audit Verification Reason</label>
                <input
                  id="recovery-reason"
                  type="text"
                  value={recoveryReason}
                  onChange={(e) => setRecoveryReason(e.target.value)}
                  className="input-field"
                  placeholder="e.g. Patch validated; security review approved"
                  required
                />
              </div>

              <button
                type="submit"
                className="button button-primary"
                style={{ marginTop: '16px', width: '100%' }}
                disabled={actionBusy || loading}
              >
                {actionBusy ? 'Applying Credit...' : '✓ Award Trust Recovery'}
              </button>
            </form>
          </Panel>

          <Panel title="Adaptive Engine Policy Parameters">
            <div className="config-editor-list">
              <div className="config-row">
                <div className="config-meta">
                  <strong>Repeated-Violation Escalation</strong>
                  <small>Multiply penalties by 1.5x when same violation repeats within 5 mins</small>
                </div>
                <button
                  type="button"
                  className={`button button-${config?.escalationEnabled ? 'primary' : 'secondary'}`}
                  onClick={handleToggleEscalation}
                  disabled={actionBusy}
                >
                  {config?.escalationEnabled ? 'Enabled' : 'Disabled'}
                </button>
              </div>

              <div className="config-row">
                <div className="config-meta">
                  <strong>Auto-Recovery on Remediation</strong>
                  <small>Automatically award +5 points when admin applies recommendation</small>
                </div>
                <span className="badge badge-success">ACTIVE</span>
              </div>

              <div className="config-row">
                <div className="config-meta">
                  <strong>Clean Streak Recovery Window</strong>
                  <small>10 consecutive legitimate calls awards progressive +2 points</small>
                </div>
                <span className="badge badge-neutral">10 REQUESTS</span>
              </div>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

export default AdaptiveTrustPage;
