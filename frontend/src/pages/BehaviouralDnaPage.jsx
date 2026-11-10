import { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  AppWindow,
  Calendar,
  CircleDot,
  RefreshCw,
  Zap,
} from 'lucide-react';
import {
  BEHAVIOURAL_DNA_CONFIG,
  RESOURCE_TYPES,
  SENSITIVE_RESOURCES,
  USAGE_PATTERNS,
} from '@shared/contracts.js';
import { api } from '../services/api.js';
import EmptyState from '../components/common/EmptyState.jsx';
import ErrorState from '../components/common/ErrorState.jsx';
import LoadingState from '../components/common/LoadingState.jsx';
import PageHeader from '../components/common/PageHeader.jsx';
import Panel from '../components/common/Panel.jsx';
import ProductIllustration from '../components/common/ProductIllustration.jsx';
import StatCard from '../components/common/StatCard.jsx';
import StatusBadge from '../components/common/StatusBadge.jsx';
import TrustRing from '../components/common/TrustRing.jsx';
import { ResourceIcon } from '../components/common/AppIcon.jsx';
import { ResourceBaselineChart } from '../components/charts/SecurityCharts.jsx';
import { formatDate } from '../utils/formatters.js';

const PATTERN_META = {
  [USAGE_PATTERNS.ROUTINE_PERIODIC]: { tone: 'success', label: 'Routine Periodic', Icon: RefreshCw },
  [USAGE_PATTERNS.SPORADIC]: { tone: 'neutral', label: 'Sporadic Access', Icon: Activity },
  [USAGE_PATTERNS.BURST_EXPECTED]: { tone: 'warning', label: 'Burst Expected', Icon: Zap },
  [USAGE_PATTERNS.DORMANT]: { tone: 'muted', label: 'Dormant', Icon: CircleDot },
};

const RESOURCE_LABELS = {
  location: 'Device Location',
  contacts: 'Contact Directory',
  camera: 'Camera Optical Stream',
  microphone: 'Audio Microphone',
  files: 'Storage & Document Files',
};

export function BehaviouralDnaPage({ apps = [], onNotify }) {
  const [selectedAppId, setSelectedAppId] = useState(() => apps[0]?.id || 'app_01');
  const [dnaProfile, setDnaProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [recalculating, setRecalculating] = useState(false);

  useEffect(() => {
    if (!selectedAppId && apps.length > 0) {
      setSelectedAppId(apps[0].id);
    }
  }, [apps, selectedAppId]);

  const loadProfile = useCallback(async (appId) => {
    if (!appId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.getDnaProfile(appId);
      setDnaProfile(data);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfile(selectedAppId);
  }, [loadProfile, selectedAppId]);

  const handleRecalculate = async () => {
    if (!selectedAppId) return;
    setRecalculating(true);
    try {
      const result = await api.recalculateBaselines(selectedAppId);
      onNotify?.(result.message || 'Baselines recalculated successfully.', 'success');
      await loadProfile(selectedAppId);
    } catch (err) {
      onNotify?.(err.message || 'Recalculation failed', 'error');
    } finally {
      setRecalculating(false);
    }
  };

  const selectedApp = apps.find((a) => a.id === selectedAppId);
  const baselines = dnaProfile?.baselines || [];
  const fullBaselines = RESOURCE_TYPES.map((resource) => baselines.find((b) => b.resource === resource) || {
    resource,
    averageAccessFrequency: 0,
    expectedUsagePattern: USAGE_PATTERNS.DORMANT,
    accessCount: 0,
    typicalIntervalMs: null,
    lastAccessTimestamp: null,
  });

  const weights = BEHAVIOURAL_DNA_CONFIG.WEIGHTS;

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Continuous heuristic application profiling"
        title="Behavioral DNA Engine"
        description="Deterministic telemetry profiling engine tracking per-resource frequency baselines, typical invocation intervals, and multi-factor behavioral drift."
        actions={(
          <>
            <button
              type="button"
              className="button"
              onClick={() => loadProfile(selectedAppId)}
              disabled={loading || recalculating}
            >
              <RefreshCw size={14} aria-hidden="true" /> Refresh
            </button>
            <button
              type="button"
              className="button button-primary"
              onClick={handleRecalculate}
              disabled={loading || recalculating}
            >
              <Zap size={14} aria-hidden="true" />
              {recalculating ? 'Profiling…' : 'Recalculate Baselines'}
            </button>
          </>
        )}
      />

      <div className="split-intro-banner">
        <div className="split-intro-copy">
          <span className="eyebrow">Baseline Derivation &amp; Drift Gate</span>
          <h2>Heuristic Telemetry Fingerprint</h2>
          <p>
            E.D.I.T.H. derives deterministic per-resource baselines from simulated historical events across a rolling {BEHAVIOURAL_DNA_CONFIG.BASELINE_WINDOW} window. When live runtime calls exceed {BEHAVIOURAL_DNA_CONFIG.FREQUENCY_SPIKE_RATIO}x baseline velocity, compress below {Math.round(BEHAVIOURAL_DNA_CONFIG.BURST_BURST_MAX_INTERVAL_MS / 1000)}s intervals, or shift to dormant resources, composite drift crosses {BEHAVIOURAL_DNA_CONFIG.SCORE_THRESHOLD}/100 and triggers Runtime Guard alerts.
          </p>
        </div>
        <ProductIllustration
          src="/assets/behavioral-dna-engine.webp"
          alt="Central application node with steady green behavioral baseline ribbon and an amber-crimson drift spike crossing a detection threshold"
          variant="compact"
        />
      </div>

      <div className="kpi-grid kpi-grid-4">
        <StatCard
          label="Monitored apps"
          value={apps.length}
          suffix="apps"
          detail="Heuristic profiling enabled"
          icon={<AppWindow size={15} />}
          tone="success"
        />
        <StatCard
          label="Baseline window"
          value={7}
          suffix="days"
          detail="Rolling historical derivation"
          icon={<Calendar size={15} />}
          tone="neutral"
        />
        <StatCard
          label="Spike threshold"
          value={BEHAVIOURAL_DNA_CONFIG.FREQUENCY_SPIKE_RATIO.toFixed(1)}
          suffix="x"
          detail="Velocity ratio flagging drift"
          icon={<Zap size={15} />}
          tone="warning"
        />
        <StatCard
          label="Composite drift gate"
          value={BEHAVIOURAL_DNA_CONFIG.SCORE_THRESHOLD}
          suffix="/100"
          detail="Threshold for BEHAVIOURAL_DRIFT alert"
          icon={<AlertTriangle size={15} />}
          tone="danger"
        />
      </div>

      <div className="dashboard-grid dashboard-grid-main">
        <div className="stack">
          <Panel
            title="Application DNA profile"
            eyebrow="Per-resource access signature"
            action={(
              <label className="field inline-select-field">
                <span>Target Application</span>
                <select
                  value={selectedAppId}
                  onChange={(e) => setSelectedAppId(e.target.value)}
                  aria-label="Select Application"
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
              <LoadingState label="Loading behavioral DNA baselines" />
            ) : error ? (
              <ErrorState title="DNA analysis unavailable" error={error} />
            ) : !dnaProfile ? (
              <EmptyState title="No profile found">
                Select an application to inspect its behavioral fingerprint.
              </EmptyState>
            ) : (
              <div className="dna-profile-summary">
                <div className="dna-header-card">
                  <div className="dna-meta">
                    <span className="eyebrow">Application identity</span>
                    <h3>{dnaProfile.appName || selectedApp?.name}</h3>
                    <p className="dna-id-line">
                      App ID: <code>{dnaProfile.appId}</code> · Updated {formatDate(dnaProfile.updatedAt)}
                    </p>
                    <div className="chip-cluster">
                      <StatusBadge tone={dnaProfile.status === 'active' ? 'success' : 'danger'}>
                        {dnaProfile.status?.toUpperCase()}
                      </StatusBadge>
                      <StatusBadge tone="neutral">
                        {dnaProfile.activeResources?.length || 0} Active Resources
                      </StatusBadge>
                      <StatusBadge tone="info">
                        {dnaProfile.totalAccesses || 0} Total Events
                      </StatusBadge>
                    </div>
                  </div>
                  <div className="dna-score-ring">
                    <TrustRing score={dnaProfile.trustScore ?? selectedApp?.trustScore ?? 0} size="medium" />
                    <span className="ring-caption">Trust Score</span>
                  </div>
                </div>

                <div className="dna-chart-section">
                  <div className="section-title-row">
                    <h4>Resource access frequency vs. call volume</h4>
                    <span className="badge badge-neutral">5-Vector Comparison</span>
                  </div>
                  <ResourceBaselineChart baselines={fullBaselines} />
                </div>

                <div className="dna-baselines-list">
                  <div className="section-title-row">
                    <h4>Observed resource baselines &amp; invocation intervals</h4>
                    <span className="badge badge-neutral">Window: {BEHAVIOURAL_DNA_CONFIG.BASELINE_WINDOW}</span>
                  </div>

                  <div className="baseline-cards-grid">
                    {fullBaselines.map((base) => {
                      const pattern = PATTERN_META[base.expectedUsagePattern] || PATTERN_META[USAGE_PATTERNS.DORMANT];
                      const PatternIcon = pattern.Icon;
                      const isSensitive = SENSITIVE_RESOURCES.includes(base.resource);

                      return (
                        <div className={`baseline-card ${isSensitive ? 'sensitive-card' : ''}`} key={base.resource}>
                          <div className="baseline-card-top">
                            <span className="resource-icon-badge" aria-hidden="true">
                              <ResourceIcon resource={base.resource} size={17} />
                            </span>
                            <div className="resource-name-box">
                              <strong>{RESOURCE_LABELS[base.resource] || base.resource}</strong>
                              <small>{isSensitive ? 'Sensitive Resource' : 'Standard Resource'}</small>
                            </div>
                            <StatusBadge tone={pattern.tone}>
                              <PatternIcon size={11} style={{ marginRight: '4px' }} aria-hidden="true" />
                              {pattern.label}
                            </StatusBadge>
                          </div>

                          <div className="baseline-metrics-grid">
                            <div className="metric-box">
                              <span className="metric-label">Access rate</span>
                              <span className="metric-value">{base.averageAccessFrequency ?? 0} <small>/hr</small></span>
                            </div>
                            <div className="metric-box">
                              <span className="metric-label">Total calls</span>
                              <span className="metric-value">{base.accessCount ?? 0}</span>
                            </div>
                            <div className="metric-box">
                              <span className="metric-label">Interval</span>
                              <span className="metric-value">
                                {base.typicalIntervalMs ? `${Math.round(base.typicalIntervalMs / 1000)}s` : 'N/A'}
                              </span>
                            </div>
                          </div>

                          <div className="baseline-footer-row">
                            <span>Last seen: {formatDate(base.lastAccessTimestamp)}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </Panel>
        </div>

        <div className="stack">
          <Panel title="Multi-factor drift formulation" eyebrow="Heuristic weighting model">
            <p className="panel-note">
              E.D.I.T.H. derives a composite behavioral deviation score (0–100) using deterministic heuristic rules—not black-box ML—comparing current requests against established baselines.
            </p>

            <div className="dna-weight-bars">
              <div className="weight-item">
                <div className="weight-meta">
                  <strong>Resource Shift</strong>
                  <span>{weights.RESOURCE_SHIFT}% Weight</span>
                </div>
                <div className="progress-track">
                  <div className="progress-bar progress-danger" style={{ width: `${weights.RESOURCE_SHIFT}%` }} />
                </div>
                <small>Accessing unexpected or historically dormant permissions</small>
              </div>

              <div className="weight-item">
                <div className="weight-meta">
                  <strong>Velocity &amp; Frequency Spike</strong>
                  <span>{weights.FREQUENCY_SPIKE}% Weight</span>
                </div>
                <div className="progress-track">
                  <div className="progress-bar progress-warning" style={{ width: `${weights.FREQUENCY_SPIKE}%` }} />
                </div>
                <small>Bursts occurring at &gt;{BEHAVIOURAL_DNA_CONFIG.FREQUENCY_SPIKE_RATIO.toFixed(1)}x above rolling hourly baseline</small>
              </div>

              <div className="weight-item">
                <div className="weight-meta">
                  <strong>Interval &amp; Timing Anomalies</strong>
                  <span>{weights.UNUSUAL_TIMING}% Weight</span>
                </div>
                <div className="progress-track">
                  <div className="progress-bar progress-info" style={{ width: `${weights.UNUSUAL_TIMING}%` }} />
                </div>
                <small>Rapid-fire bursts below {BEHAVIOURAL_DNA_CONFIG.BURST_BURST_MAX_INTERVAL_MS}ms inter-request interval</small>
              </div>
            </div>

            <div className="callout callout-mint">
              <strong>Zero-Drift Enforcement Gate</strong>
              <p>
                When composite deviation reaches {BEHAVIOURAL_DNA_CONFIG.SCORE_THRESHOLD}/100, Runtime Guard flags <code>BEHAVIOURAL_DRIFT</code>, emits a High severity alert, and enforces block rules in Protect/Strict modes.
              </p>
            </div>
          </Panel>

          <Panel title="Usage pattern taxonomy" eyebrow="Deterministic classification">
            <div className="pattern-guide-list">
              <div className="pattern-guide-item">
                <StatusBadge tone="success">Routine Periodic</StatusBadge>
                <p>Regular, predictable background access cadence (e.g., workout telemetry or daily sync).</p>
              </div>
              <div className="pattern-guide-item">
                <StatusBadge tone="neutral">Sporadic Access</StatusBadge>
                <p>Infrequent user-initiated requests without high-frequency spikes.</p>
              </div>
              <div className="pattern-guide-item">
                <StatusBadge tone="warning">Burst Expected</StatusBadge>
                <p>Short rapid sequences expected for active navigation or batch file operations.</p>
              </div>
              <div className="pattern-guide-item">
                <StatusBadge tone="muted">Dormant</StatusBadge>
                <p>Ungranted or historically unused capability with zero prior baseline activity.</p>
              </div>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

export default BehaviouralDnaPage;
