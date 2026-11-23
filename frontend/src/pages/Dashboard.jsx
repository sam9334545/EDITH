import { useMemo } from 'react';
import {
  Activity,
  AppWindow,
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Gauge,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { ACCESS_STATUS, APPLICATION_STATUS, RECOMMENDATION_STATUS } from '@shared/contracts.js';
import AppMark from '../components/common/AppMark.jsx';
import EmptyState from '../components/common/EmptyState.jsx';
import ErrorState from '../components/common/ErrorState.jsx';
import Panel from '../components/common/Panel.jsx';
import ProductIllustration from '../components/common/ProductIllustration.jsx';
import StatCard from '../components/common/StatCard.jsx';
import StatusBadge from '../components/common/StatusBadge.jsx';
import {
  AccessActivityChart,
  RiskDonutChart,
  TrustDistributionChart,
} from '../components/charts/SecurityCharts.jsx';
import { ALERT_LABELS, RESOURCE_LABELS, appName } from '../components/common/LegacyControls.jsx';
import { formatDate, humanize } from '../utils/formatters.js';

function levelLabel(level) {
  return level ? level.charAt(0).toUpperCase() + level.slice(1) : 'Not available';
}

function ActivityList({ items, apps }) {
  if (!items.length) {
    return (
      <EmptyState title="No activity recorded">
        Activity will appear when the backend history endpoint returns records.
      </EmptyState>
    );
  }
  return (
    <div className="activity-list">
      {items.slice(0, 5).map((item) => {
        const isDanger = item.eventType?.includes('denied') || item.eventType?.includes('revoked') || item.eventType?.includes('suspended');
        const isWarn = item.eventType?.includes('alert');
        const markerTone = isDanger ? 'danger' : isWarn ? 'warning' : 'success';
        return (
          <article className="activity-item" key={item.id}>
            <span className={`activity-marker activity-${markerTone}`} />
            <div className="activity-content">
              <div className="activity-title-row">
                <strong>{humanize(item.eventType)}</strong>
                <time>{formatDate(item.timestamp)}</time>
              </div>
              <p>{item.description}</p>
              <span>{appName(apps, item.appId)}</span>
            </div>
          </article>
        );
      })}
    </div>
  );
}

export default function Dashboard({
  apps = [],
  events = [],
  alerts = [],
  history = [],
  recommendations = [],
  errors = {},
  averageTrust,
  activeAlerts,
  stats,
  onRunDemo,
  onReset,
  onNavigate,
  onAcknowledge,
  onApplyRecommendation,
  onViewApp,
  busyAction,
}) {
  const allowed = stats?.allowedRequests ?? events.filter((event) => event.status === ACCESS_STATUS.ALLOWED).length;
  const denied = stats?.deniedRequests ?? events.filter((event) => event.status === ACCESS_STATUS.DENIED).length;
  const totalApps = stats?.totalApps ?? apps.length;
  const activeAppsCount = apps.filter((app) => app.status === APPLICATION_STATUS.ACTIVE).length;
  const suspendedAppsCount = apps.filter((app) => app.status === APPLICATION_STATUS.SUSPENDED).length;

  const appsList = useMemo(
    () => apps.slice().sort((left, right) => (left.trustScore ?? 101) - (right.trustScore ?? 101)),
    [apps],
  );

  const pendingRecommendations = useMemo(
    () => recommendations.filter((item) => item.status === RECOMMENDATION_STATUS.PENDING),
    [recommendations],
  );

  const trustTierBreakdown = useMemo(
    () => [
      { key: 'high', label: 'High Trust (80–100)', count: apps.filter((a) => a.trustLevel === 'high').length, color: '#26745C' },
      { key: 'moderate', label: 'Moderate (60–79)', count: apps.filter((a) => a.trustLevel === 'moderate').length, color: '#D99A32' },
      { key: 'low', label: 'Low (40–59)', count: apps.filter((a) => a.trustLevel === 'low').length, color: '#D97706' },
      { key: 'critical', label: 'Critical (0–39)', count: apps.filter((a) => a.trustLevel === 'critical').length, color: '#C94B4B' },
    ],
    [apps],
  );

  return (
    <div className="page-stack">
      <section className="overview-hero-card" aria-label="E.D.I.T.H. Platform Overview">
        <div className="overview-hero-copy">
          <div className="hero-badge-row">
            <span className="eyebrow">Enhanced Digital Identity, Trust &amp; Heuristics</span>
            <span className="hero-sim-pill">
              <span className="status-dot-live" aria-hidden="true" />
              Simulated Telemetry Active
            </span>
          </div>
          <h1>Zero-Trust Application Governance &amp; Adaptive Security</h1>
          <p>
            Continuously govern sensitive resource permissions, profile application behavior baselines, inspect simulated runtime traffic through RASP-inspired policies, and evaluate dynamic trust scores.
          </p>
          <div className="hero-actions-row">
            <button
              className="button button-primary"
              type="button"
              onClick={onRunDemo}
              disabled={Boolean(busyAction)}
            >
              {busyAction === 'demo' ? 'Running scenario…' : 'Run 7-step demo scenario'}
              <ArrowUpRight size={15} aria-hidden="true" />
            </button>
            <button
              className="button"
              type="button"
              onClick={onReset}
              disabled={Boolean(busyAction)}
            >
              <RotateCcw size={14} aria-hidden="true" />
              Reset demo seed
            </button>
            <button
              className="button"
              type="button"
              onClick={() => onNavigate('monitoring')}
            >
              Simulate request
            </button>
          </div>
          <div className="hero-meta-strip">
            <span><strong>{activeAppsCount}</strong> Active apps</span>
            <span><strong>{suspendedAppsCount}</strong> Suspended</span>
            <span><strong>{pendingRecommendations.length}</strong> Pending remediations</span>
          </div>
        </div>

        <div className="overview-hero-visual">
          <ProductIllustration
            src="/assets/edith-security-hero.webp"
            alt="Isometric smart-home and application security ecosystem connected around a central E.D.I.T.H. shield"
            variant="hero"
          />
        </div>
      </section>

      <section className="kpi-grid" aria-label="Security posture summary">
        <StatCard
          label="Applications"
          value={errors.apps ? '—' : totalApps}
          detail={`${activeAppsCount} active · ${suspendedAppsCount} suspended`}
          icon={<AppWindow size={15} />}
          tone="neutral"
        />
        <StatCard
          label="Allowed requests"
          value={errors.events ? '—' : allowed}
          detail={stats ? 'All API recorded traffic' : 'Across latest 200 events'}
          icon={<CheckCircle2 size={15} />}
          tone="success"
        />
        <StatCard
          label="Denied requests"
          value={errors.events ? '—' : denied}
          detail={stats ? 'Blocked by backend policies' : 'Across latest 200 events'}
          icon={<XCircle size={15} />}
          tone="warning"
        />
        <StatCard
          label="Active alerts"
          value={errors.alerts ? '—' : activeAlerts}
          detail={errors.alerts ? 'Alert API unavailable' : 'Unacknowledged heuristic signals'}
          icon={<ShieldAlert size={15} />}
          tone={activeAlerts > 0 ? 'danger' : 'success'}
        />
        <StatCard
          label="Average trust"
          value={errors.apps ? '—' : averageTrust === null ? '—' : averageTrust}
          suffix={averageTrust === null ? '' : '/100'}
          detail="Dynamic backend trust index"
          icon={<ShieldCheck size={15} />}
          tone={averageTrust !== null && averageTrust < 60 ? 'warning' : 'info'}
        />
      </section>

      <section className="engine-showcase-grid" aria-label="Integrated security engines">
        <button type="button" className="engine-card" onClick={() => onNavigate('posture')}>
          <span className="engine-card-icon" aria-hidden="true">
            <ShieldCheck size={20} />
          </span>
          <div className="engine-card-content">
            <span className="engine-eyebrow">CNAPP-Inspired View</span>
            <h4>Security Posture</h4>
            <p>Risk-adjusted application posture, permission exposure analytics, and daily runtime trend coverage.</p>
            <span className="engine-card-link">Open posture view <ArrowRight size={13} /></span>
          </div>
        </button>

        <button type="button" className="engine-card" onClick={() => onNavigate('dna')}>
          <span className="engine-card-icon" aria-hidden="true">
            <Activity size={20} />
          </span>
          <div className="engine-card-content">
            <span className="engine-eyebrow">5-Vector Profiling</span>
            <h4>Behavioral DNA Engine</h4>
            <p>Deterministic rolling access frequencies, invocation interval baselines, and drift threshold checks.</p>
            <span className="engine-card-link">Inspect baselines <ArrowRight size={13} /></span>
          </div>
        </button>

        <button type="button" className="engine-card" onClick={() => onNavigate('adaptive')}>
          <span className="engine-card-icon" aria-hidden="true">
            <Gauge size={20} />
          </span>
          <div className="engine-card-content">
            <span className="engine-eyebrow">Closed-Loop Scoring</span>
            <h4>Adaptive Trust Engine</h4>
            <p>Repeated-violation escalation multipliers, clean streak recovery credits, and audit-logged restoration.</p>
            <span className="engine-card-link">Manage trust engine <ArrowRight size={13} /></span>
          </div>
        </button>
      </section>

      <div className="dashboard-grid dashboard-grid-charts">
        <Panel title="Access decision volume" eyebrow="7-day simulated telemetry">
          {errors.events ? (
            <ErrorState error={errors.events} title="Access events are unavailable" />
          ) : (
            <AccessActivityChart events={events} />
          )}
        </Panel>

        <Panel title="Application risk profile" eyebrow="Trust classification breakdown">
          {errors.apps ? (
            <ErrorState error={errors.apps} title="Applications are unavailable" />
          ) : apps.length ? (
            <div className="overview-dist-stack">
              <RiskDonutChart items={trustTierBreakdown} centerLabel="Apps" />
              <TrustDistributionChart apps={apps} />
            </div>
          ) : (
            <EmptyState title="No trust data">Application trust levels will appear here.</EmptyState>
          )}
        </Panel>
      </div>

      <div className="dashboard-grid dashboard-grid-main">
        <Panel
          title="Application trust prioritization"
          eyebrow="Lowest trust surfaced first"
          className="span-two"
          action={(
            <button type="button" className="text-link" onClick={() => onNavigate('applications')}>
              All {totalApps} applications <ArrowRight size={13} />
            </button>
          )}
        >
          {errors.apps ? (
            <ErrorState error={errors.apps} title="Applications are unavailable" />
          ) : appsList.length ? (
            <div className="trust-app-list">
              {appsList.slice(0, 7).map((app) => {
                const enabled = Object.values(app.permissions || {}).filter((permission) => permission.enabled).length;
                return (
                  <div className="trust-app-row" key={app.id}>
                    <AppMark name={app.name} size="sm" />
                    <div className="trust-app-name">
                      <button
                        type="button"
                        className="inline-app-link"
                        onClick={() => onViewApp?.(app)}
                      >
                        {app.name}
                      </button>
                      <span>{enabled} of 5 permissions enabled</span>
                    </div>
                    <StatusBadge tone={app.status === APPLICATION_STATUS.ACTIVE ? 'success' : 'danger'}>
                      {humanize(app.status)}
                    </StatusBadge>
                    <div className="trust-app-score">
                      <div>
                        <strong>{Number.isFinite(app.trustScore) ? app.trustScore : '—'}</strong>
                        <span>{levelLabel(app.trustLevel)}</span>
                      </div>
                      <div className="score-track">
                        <i
                          className={`score-fill trust-fill-${app.trustLevel || 'unknown'}`}
                          style={{ width: `${Number.isFinite(app.trustScore) ? app.trustScore : 0}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState title="No applications found">Applications will appear when the API returns them.</EmptyState>
          )}
        </Panel>

        <Panel
          title="Recent security alerts"
          eyebrow="Heuristic & runtime signals"
          action={(
            <button type="button" className="text-link" onClick={() => onNavigate('security')}>
              Alert register <ArrowRight size={13} />
            </button>
          )}
        >
          {errors.alerts ? (
            <ErrorState error={errors.alerts} title="Security alerts are unavailable" />
          ) : alerts.length ? (
            <div className="compact-alert-list">
              {alerts.slice(0, 5).map((alert) => (
                <div className="compact-alert" key={alert.id}>
                  <span className={`severity-mark severity-${alert.severity}`} />
                  <div>
                    <strong>{ALERT_LABELS[alert.type] || humanize(alert.type)}</strong>
                    <span>{appName(apps, alert.appId)} · {formatDate(alert.timestamp)}</span>
                  </div>
                  <StatusBadge tone={alert.severity}>{humanize(alert.severity)}</StatusBadge>
                  {!alert.acknowledged ? (
                    <button
                      className="icon-button small"
                      aria-label={`Acknowledge ${alert.id}`}
                      title="Acknowledge alert"
                      type="button"
                      onClick={() => onAcknowledge(alert)}
                      disabled={Boolean(busyAction)}
                    >
                      <Check size={13} />
                    </button>
                  ) : (
                    <span className="ack-check-muted" title="Acknowledged">
                      <Check size={13} />
                    </span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="No active alerts">Alerts appear when the backend detects anomalies.</EmptyState>
          )}
        </Panel>
      </div>

      <div className="dashboard-grid dashboard-grid-bottom">
        <Panel
          title="Recommended remediations"
          eyebrow={`${pendingRecommendations.length} pending actions`}
          action={(
            <button type="button" className="text-link" onClick={() => onNavigate('recommendations')}>
              Full queue <ArrowRight size={13} />
            </button>
          )}
        >
          {errors.recommendations ? (
            <ErrorState error={errors.recommendations} title="Recommendations are unavailable" />
          ) : pendingRecommendations.length ? (
            <div className="compact-rec-list">
              {pendingRecommendations.slice(0, 4).map((rec) => (
                <div className="compact-rec-row" key={rec.id}>
                  <span className="compact-rec-icon" aria-hidden="true">
                    <ClipboardCheck size={15} />
                  </span>
                  <div className="compact-rec-copy">
                    <strong>{rec.title}</strong>
                    <span>
                      {appName(apps, rec.appId)} · {RESOURCE_LABELS[rec.resource] || rec.resource || 'App-wide'}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="button button-primary button-xs"
                    disabled={Boolean(busyAction)}
                    onClick={() => onApplyRecommendation?.(rec)}
                  >
                    Apply
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="No pending remediations">
              All backend-generated recommendations have been handled.
            </EmptyState>
          )}
        </Panel>

        <Panel
          title="Recent audit activity"
          eyebrow="Immutable ledger tail"
          action={(
            <button type="button" className="text-link" onClick={() => onNavigate('history')}>
              View history <ArrowRight size={13} />
            </button>
          )}
        >
          {errors.history ? (
            <ErrorState error={errors.history} title="Activity history is unavailable" />
          ) : (
            <ActivityList items={history} apps={apps} />
          )}
        </Panel>
      </div>
    </div>
  );
}
