import { useCallback, useEffect, useState } from 'react';
import { RESOURCE_TYPES, SENSITIVE_RESOURCES, USAGE_PATTERNS } from '@shared/contracts.js';
import { api } from '../services/api.js';
import PageHeader from '../components/common/PageHeader.jsx';
import Panel from '../components/common/Panel.jsx';
import StatusBadge from '../components/common/StatusBadge.jsx';
import TrustRing from '../components/common/TrustRing.jsx';
import EmptyState from '../components/common/EmptyState.jsx';
import LoadingState from '../components/common/LoadingState.jsx';
import ErrorState from '../components/common/ErrorState.jsx';
import { formatDate, humanize } from '../utils/formatters.js';
import { Explainer } from '../components/common/Illustration.jsx';
import {
  RESOURCE_ICON, AppsIcon, CalendarIcon, PulseIcon, AlertIcon, RefreshIcon,
  CycleIcon, WaveIcon, DormantIcon, GaugeIcon,
} from '../components/common/Icons.jsx';

const PATTERN_COLORS = {
  [USAGE_PATTERNS.ROUTINE_PERIODIC]: { tone: 'success', label: 'Routine Periodic', Icon: CycleIcon },
  [USAGE_PATTERNS.SPORADIC]: { tone: 'neutral', label: 'Sporadic Access', Icon: WaveIcon },
  [USAGE_PATTERNS.BURST_EXPECTED]: { tone: 'warning', label: 'Burst Expected', Icon: PulseIcon },
  [USAGE_PATTERNS.DORMANT]: { tone: 'quiet', label: 'Dormant (Unused)', Icon: DormantIcon },
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

  // Sync selectedAppId when apps populate
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
      setError(err.message || 'Failed to load Behavioural DNA profile');
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
      onNotify?.(result.message || 'Baselines recalculated successfully!', 'success');
      await loadProfile(selectedAppId);
    } catch (err) {
      onNotify?.(err.message || 'Recalculation failed', 'danger');
    } finally {
      setRecalculating(false);
    }
  };

  const selectedApp = apps.find((a) => a.id === selectedAppId);
  const baselines = dnaProfile?.baselines || [];

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="CONTINUOUS APPLICATION PROFILING"
        title="Behavioral DNA Engine"
        description="Heuristic telemetry engine tracking resource frequency baselines, typical invocation intervals, and behavioral drift detection."
        actions={
          <div className="action-row">
            <button
              type="button"
              className="button button-secondary"
              onClick={() => loadProfile(selectedAppId)}
              disabled={loading || recalculating}
            >
              <RefreshIcon width="15" height="15" /> Refresh
            </button>
            <button
              type="button"
              className="button button-primary"
              onClick={handleRecalculate}
              disabled={loading || recalculating}
            >
              {recalculating ? 'Profiling…' : 'Recalculate baselines'}
            </button>
          </div>
        }
      />

      {/* Top Level Metric Highlights */}
      <div className="kpi-grid">
        <article className="kpi-card kpi-success">
          <div className="kpi-topline"><span>Monitored applications</span><span className="kpi-icon"><AppsIcon width="16" height="16" /></span></div>
          <div className="kpi-value">{apps.length}<small>apps</small></div>
          <p>Continuous runtime behavioural profiling enabled</p>
        </article>
        <article className="kpi-card kpi-neutral">
          <div className="kpi-topline"><span>Baseline window</span><span className="kpi-icon"><CalendarIcon width="16" height="16" /></span></div>
          <div className="kpi-value">7<small>days</small></div>
          <p>Rolling historical window for baseline derivation</p>
        </article>
        <article className="kpi-card kpi-warning">
          <div className="kpi-topline"><span>Spike threshold</span><span className="kpi-icon"><PulseIcon width="16" height="16" /></span></div>
          <div className="kpi-value">3.0<small>×</small></div>
          <p>Access velocity above 3× the baseline raises drift</p>
        </article>
        <article className="kpi-card kpi-danger">
          <div className="kpi-topline"><span>Composite drift gate</span><span className="kpi-icon"><AlertIcon width="16" height="16" /></span></div>
          <div className="kpi-value">50<small>/100</small></div>
          <p>Deviation score at which the Runtime Guard intervenes</p>
        </article>
      </div>

      <Panel title="How behavioural profiling works" eyebrow="Deterministic, heuristic — no machine learning">
        <Explainer
          name="behavioral-dna-engine"
          alt="An application emitting telemetry into a baseline band, with a stable trace inside the band and an amber spike breaking above it, marked as an anomaly."
          title="A baseline per application, per resource"
        >
          <ul className="explainer-list">
            <li><strong>Profile.</strong> Each application&apos;s recorded access events build a rolling 7-day baseline for every one of the five protected resources.</li>
            <li><strong>Compare.</strong> New requests are measured against that application&apos;s own normal rate and typical interval — never against other applications.</li>
            <li><strong>Detect drift.</strong> A burst above 3× the baseline, or a request for a historically dormant resource, is reported as a deviation with a plain-language explanation.</li>
            <li><strong>Act.</strong> Deviations feed the Runtime Guard and the trust narrative. The rules are fixed and inspectable, so the same events always produce the same verdict.</li>
          </ul>
        </Explainer>
      </Panel>

      {/* Main DNA Grid */}
      <div className="dashboard-grid dashboard-grid-main">
        {/* Left Column: DNA Profile & Baselines */}
        <div className="stack">
          <Panel
            title="Application DNA Profile"
            action={
              <div className="select-wrap">
                <select
                  value={selectedAppId}
                  onChange={(e) => setSelectedAppId(e.target.value)}
                  className="select-field"
                  aria-label="Select Application"
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
              <LoadingState message="Synthesizing behavioral DNA baselines..." />
            ) : error ? (
              <ErrorState title="DNA Analysis Unavailable" message={error} />
            ) : !dnaProfile ? (
              <EmptyState title="No Profile Found">Select an application to view its behavioral fingerprint.</EmptyState>
            ) : (
              <div className="dna-profile-summary">
                <div className="dna-header-card">
                  <div className="dna-meta">
                    <span className="text-overline">APPLICATION IDENTITY</span>
                    <h3>{dnaProfile.appName || selectedApp?.name}</h3>
                    <p className="text-subtle">App ID: <code>{dnaProfile.appId}</code></p>
                    <div className="chip-cluster" style={{ marginTop: '8px' }}>
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
                    <TrustRing score={dnaProfile.trustScore ?? selectedApp?.trustScore ?? 80} size={84} />
                    <span className="ring-caption">Trust Score</span>
                  </div>
                </div>

                <div className="dna-baselines-list">
                  <div className="section-title-row">
                    <h4>Observed Resource Baselines & Access Signatures</h4>
                    <span className="badge badge-neutral">5 Vector Analysis</span>
                  </div>

                  <div className="baseline-cards-grid">
                    {RESOURCE_TYPES.map((resource) => {
                      const base = baselines.find((b) => b.resource === resource) || {
                        resource,
                        averageAccessFrequency: 0,
                        expectedUsagePattern: USAGE_PATTERNS.DORMANT,
                        accessCount: 0,
                        typicalIntervalMs: null,
                      };
                      const pattern = PATTERN_COLORS[base.expectedUsagePattern] || PATTERN_COLORS[USAGE_PATTERNS.DORMANT];
                      const isSensitive = SENSITIVE_RESOURCES.includes(resource);
                      const ResourceIcon = RESOURCE_ICON[resource] || DormantIcon;

                      return (
                        <div className={`baseline-card ${isSensitive ? 'sensitive-card' : ''}`} key={resource}>
                          <div className="baseline-card-top">
                            <span className="resource-icon-badge"><ResourceIcon width="18" height="18" /></span>
                            <div className="resource-name-box">
                              <strong>{RESOURCE_LABELS[resource] || resource}</strong>
                              <small>{isSensitive ? 'Sensitive Resource' : 'Standard Resource'}</small>
                            </div>
                            <span className={`badge badge-${pattern.tone}`}>
                              <pattern.Icon width="12" height="12" /> {pattern.label}
                            </span>
                          </div>

                          <div className="baseline-metrics-grid">
                            <div className="metric-box">
                              <span className="metric-label">Access Velocity</span>
                              <span className="metric-value">{base.averageAccessFrequency ?? 0} <small>/hr</small></span>
                            </div>
                            <div className="metric-box">
                              <span className="metric-label">Total Calls</span>
                              <span className="metric-value">{base.accessCount ?? 0}</span>
                            </div>
                            <div className="metric-box">
                              <span className="metric-label">Interval</span>
                              <span className="metric-value">
                                {base.typicalIntervalMs ? `${Math.round(base.typicalIntervalMs / 1000)}s` : 'N/A'}
                              </span>
                            </div>
                          </div>

                          {/* Access Pattern Progress Indicator */}
                          <div className="dna-vector-track">
                            <div
                              className={`dna-vector-fill tone-${pattern.tone}`}
                              style={{
                                width: `${Math.min(100, Math.max(8, (base.accessCount || 0) * 12))}%`,
                              }}
                            />
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

        {/* Right Column: DNA Heuristic Architecture & Weights */}
        <div className="stack">
          <Panel title="DNA Detection Architecture & Threat Model">
            <div className="info-block">
              <h4>Multi-Factor Drift Formulation</h4>
              <p className="text-subtle">
                EDITH derives a composite behavioral deviation metric by evaluating current runtime telemetry against established historical baselines.
              </p>

              <div className="dna-weight-bars">
                <div className="weight-item">
                  <div className="weight-meta">
                    <strong>Resource Shift</strong>
                    <span>40% Weight</span>
                  </div>
                  <div className="progress-track">
                    <div className="progress-bar progress-danger" style={{ width: '40%' }} />
                  </div>
                  <small>Accessing unexpected or historically dormant permissions</small>
                </div>

                <div className="weight-item">
                  <div className="weight-meta">
                    <strong>Velocity & Frequency Spike</strong>
                    <span>35% Weight</span>
                  </div>
                  <div className="progress-track">
                    <div className="progress-bar progress-warning" style={{ width: '35%' }} />
                  </div>
                  <small>Bursts occurring at &gt;3.0x above rolling hourly baseline</small>
                </div>

                <div className="weight-item">
                  <div className="weight-meta">
                    <strong>Interval & Timing Anomalies</strong>
                    <span>25% Weight</span>
                  </div>
                  <div className="progress-track">
                    <div className="progress-bar progress-info" style={{ width: '25%' }} />
                  </div>
                  <small>Rapid-fire bursts below 5000ms inter-request interval</small>
                </div>
              </div>

              <div className="callout callout-mint" style={{ marginTop: '20px' }}>
                <strong>Zero-Drift Enforcement Policy</strong>
                <p>
                  When composite deviation crosses 50/100, the RASP Runtime Guard automatically flags <code>BEHAVIOURAL_DRIFT</code>, raises a High severity security alert, and throttles access.
                </p>
              </div>
            </div>
          </Panel>

          <Panel title="Usage Pattern Taxonomy">
            <div className="pattern-guide-list">
              <div className="pattern-guide-item">
                <span className="badge badge-success"><CycleIcon width="12" height="12" /> Routine Periodic</span>
                <p>Regular, expected background queries (e.g. step counters, daily syncs).</p>
              </div>
              <div className="pattern-guide-item">
                <span className="badge badge-neutral"><WaveIcon width="12" height="12" /> Sporadic Access</span>
                <p>User-initiated infrequent actions (e.g. profile edit, manual photo picker).</p>
              </div>
              <div className="pattern-guide-item">
                <span className="badge badge-warning"><PulseIcon width="12" height="12" /> Burst Expected</span>
                <p>Short rapid sequences (e.g. streaming navigation updates, batch uploads).</p>
              </div>
              <div className="pattern-guide-item">
                <span className="badge badge-quiet"><DormantIcon width="12" height="12" /> Dormant</span>
                <p>Ungranted or unused resource capabilities with zero historical activity.</p>
              </div>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

export default BehaviouralDnaPage;
