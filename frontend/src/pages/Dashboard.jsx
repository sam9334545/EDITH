import { useMemo } from 'react';
import { ACCESS_STATUS, APPLICATION_STATUS } from '@shared/contracts.js';
import EmptyState from '../components/common/EmptyState.jsx';
import ErrorState from '../components/common/ErrorState.jsx';
import Panel from '../components/common/Panel.jsx';
import PageHeader from '../components/common/PageHeader.jsx';
import StatusBadge from '../components/common/StatusBadge.jsx';
import { formatDate, humanize } from '../utils/formatters.js';

const ALERT_LABELS = {
  excessive_access: 'Excessive access',
  unauthorized_resource: 'Unauthorized resource',
  suspended_app_access: 'Suspended application access',
  repeated_restricted_access: 'Repeated restricted access',
  unusual_resource_combination: 'Unusual resource combination',
};

function levelLabel(level) {
  return level ? level.charAt(0).toUpperCase() + level.slice(1) : 'Not available';
}

function DashboardStat({ label, value, suffix = '', detail, icon, tone = 'neutral' }) {
  return (
    <article className={`kpi-card kpi-${tone}`}>
      <div className="kpi-topline"><span>{label}</span><span className="kpi-icon">{icon}</span></div>
      <div className="kpi-value">{value}<small>{suffix}</small></div>
      <p>{detail}</p>
    </article>
  );
}

function EventBars({ events }) {
  const points = useMemo(() => {
    const end = new Date();
    end.setHours(0, 0, 0, 0);
    const days = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(end);
      date.setDate(end.getDate() - (6 - index));
      const key = date.toLocaleDateString();
      const dayEvents = events.filter((item) => new Date(item.timestamp).toLocaleDateString() === key);
      return {
        label: date.toLocaleDateString(undefined, { weekday: 'short' }),
        allowed: dayEvents.filter((item) => item.status === ACCESS_STATUS.ALLOWED).length,
        denied: dayEvents.filter((item) => item.status === ACCESS_STATUS.DENIED).length,
      };
    });
    const max = Math.max(1, ...days.map((day) => day.allowed + day.denied));
    return days.map((day) => ({ ...day, height: (day.allowed + day.denied) / max }));
  }, [events]);
  return (
    <div className="bar-chart" aria-label="Allowed and denied requests in the last seven days">
      <div className="chart-legend"><span><i className="legend-allowed" />Allowed</span><span><i className="legend-denied" />Denied</span><small>Based on the latest 200 events returned by the API</small></div>
      <div className="bar-chart-grid">
        {points.map((point) => {
          const total = point.allowed + point.denied;
          const allowedHeight = total ? (point.allowed / total) * point.height * 100 : 0;
          const deniedHeight = total ? (point.denied / total) * point.height * 100 : 0;
          return (
            <div className="bar-column" key={point.label}>
              <div className="bar-track">{total > 0 && <div className="bar-stack" style={{ height: `${point.height * 100}%` }}>
                <i className="bar-allowed" style={{ height: `${allowedHeight}%` }} />
                <i className="bar-denied" style={{ height: `${deniedHeight}%` }} />
              </div>}</div><span>{point.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TrustDistribution({ apps }) {
  return (
    <div className="distribution">
      {['high', 'moderate', 'low', 'critical'].map((level) => {
        const count = apps.filter((app) => app.trustLevel === level).length;
        return (
          <div className="distribution-row" key={level}>
            <span className={`distribution-dot trust-dot-${level}`} /><span>{levelLabel(level)}</span>
            <div className="distribution-track"><i style={{ width: `${apps.length ? (count / apps.length) * 100 : 0}%` }} /></div><strong>{count}</strong>
          </div>
        );
      })}
    </div>
  );
}

function ActivityList({ items, apps }) {
  if (!items.length) return <EmptyState title="No activity recorded">Activity will appear when the backend history endpoint has records.</EmptyState>;
  return (
    <div className="activity-list">
      {items.slice(0, 4).map((item) => (
        <article className="activity-item" key={item.id}>
          <span className={`activity-marker activity-${item.eventType?.includes('denied') ? 'danger' : 'neutral'}`} />
          <div className="activity-content">
            <div className="activity-title-row"><strong>{humanize(item.eventType)}</strong><time>{formatDate(item.timestamp)}</time></div>
            <p>{item.description}</p><span>{apps.find((app) => app.id === item.appId)?.name || item.appId || 'Unknown application'}</span>
          </div>
        </article>
      ))}
    </div>
  );
}

export default function Dashboard({
  apps, events, alerts, history, errors, averageTrust, activeAlerts, stats,
  onRunDemo, onReset, onNavigate, onAcknowledge, busyAction,
}) {
  const allowed = stats?.allowedRequests ?? events.filter((event) => event.status === ACCESS_STATUS.ALLOWED).length;
  const denied = stats?.deniedRequests ?? events.filter((event) => event.status === ACCESS_STATUS.DENIED).length;
  const totalApps = stats?.totalApps ?? apps.length;
  const appsList = apps.slice().sort((left, right) => (right.trustScore ?? -1) - (left.trustScore ?? -1));
  return (
    <>
      <PageHeader
        eyebrow={`Workspace Environment · ${new Intl.DateTimeFormat(undefined, { dateStyle: 'full' }).format(new Date())}`}
        title="Autonomous Digital Trust & Heuristic Security."
        description="Centralized permission governance, real-time access telemetry, and behavioral anomaly detection for modern applications."
        actions={<><button className="button" type="button" onClick={onReset} disabled={Boolean(busyAction)}>Reset demo</button><button className="button button-primary" type="button" onClick={onRunDemo} disabled={Boolean(busyAction)}>{busyAction === 'demo' ? 'Running scenario…' : 'Run demo scenario'} ↗</button></>}
      />
      <section className="kpi-grid" aria-label="Environment summary">
        <DashboardStat label="Applications" value={errors.apps ? '—' : totalApps} detail="Registered in workspace" icon="▦" />
        <DashboardStat label="Allowed requests" value={errors.events ? '—' : allowed} detail={stats ? 'All recorded requests' : 'Across the latest 200 events'} icon="✓" tone="success" />
        <DashboardStat label="Denied requests" value={errors.events ? '—' : denied} detail={stats ? 'All recorded requests' : 'Across the latest 200 events'} icon="×" tone="warning" />
        <DashboardStat label="Active alerts" value={errors.alerts ? '—' : activeAlerts} detail={errors.alerts ? 'Alert API unavailable' : 'Unacknowledged alerts'} icon="◇" tone="danger" />
        <DashboardStat label="Average trust" value={errors.apps ? '—' : averageTrust === null ? '—' : averageTrust} suffix={averageTrust === null ? '' : '/100'} detail="Based on API trust scores" icon="◉" tone="espresso" />
      </section>

      {/* Advanced Security & AI Engines Showcase */}
      <section className="engine-showcase-grid" aria-label="Integrated Security Engines">
        <div className="engine-card" onClick={() => onNavigate('posture')} role="button" tabIndex={0}>
          <span className="engine-card-icon" aria-hidden="true">◈</span>
          <div className="engine-card-content">
            <h4>CNAPP & Security Posture</h4>
            <p>Cloud-native application protection with risk scoring, compliance drift, and security findings.</p>
            <span className="engine-card-link">Explore Posture Overview →</span>
          </div>
        </div>

        <div className="engine-card" onClick={() => onNavigate('dna')} role="button" tabIndex={0}>
          <span className="engine-card-icon" aria-hidden="true">🧬</span>
          <div className="engine-card-content">
            <h4>Behavioral DNA Engine</h4>
            <p>Heuristic telemetry profiling, rolling access baselines, and runtime drift detection.</p>
            <span className="engine-card-link">View Application Baselines →</span>
          </div>
        </div>

        <div className="engine-card" onClick={() => onNavigate('adaptive')} role="button" tabIndex={0}>
          <span className="engine-card-icon" aria-hidden="true">⚡</span>
          <div className="engine-card-content">
            <h4>Adaptive Trust Engine</h4>
            <p>Closed-loop risk weighting, repeated-violation escalation, and clean streak trust credits.</p>
            <span className="engine-card-link">Manage Adaptive Trust →</span>
          </div>
        </div>
      </section>
      <div className="dashboard-grid dashboard-grid-main">
        <Panel title="Application trust overview" eyebrow="Across your workspace" className="span-two" action={<button type="button" className="text-link" onClick={() => onNavigate('applications')}>View all →</button>}>
          {errors.apps ? <ErrorState error={errors.apps} title="Applications are unavailable" /> : appsList.length ? (
            <div className="trust-app-list">{appsList.map((app) => {
              const enabled = Object.values(app.permissions || {}).filter((permission) => permission.enabled).length;
              return <div className="trust-app-row" key={app.id}>
                <span className="app-mark">{app.name.slice(0, 2).toUpperCase()}</span>
                <div className="trust-app-name"><strong>{app.name}</strong><span>{enabled} permissions enabled</span></div>
                <StatusBadge tone={app.status === APPLICATION_STATUS.ACTIVE ? 'success' : 'muted'}>{humanize(app.status)}</StatusBadge>
                <div className="trust-app-score"><div><strong>{Number.isFinite(app.trustScore) ? app.trustScore : '—'}</strong><span>{levelLabel(app.trustLevel)}</span></div><div className="score-track"><i className={`score-fill trust-fill-${app.trustLevel || 'unknown'}`} style={{ width: `${Number.isFinite(app.trustScore) ? app.trustScore : 0}%` }} /></div></div>
              </div>;
            })}</div>
          ) : <EmptyState title="No applications found">Applications will appear when the API returns them.</EmptyState>}
        </Panel>
        <Panel title="Recent security alerts" eyebrow="Needs attention" action={<button type="button" className="text-link" onClick={() => onNavigate('security')}>All alerts →</button>}>
          {errors.alerts ? <ErrorState error={errors.alerts} title="Security alerts are unavailable" /> : alerts.length ? (
            <div className="compact-alert-list">{alerts.slice(0, 4).map((alert) => (
              <div className="compact-alert" key={alert.id}>
                <span className={`severity-mark severity-${alert.severity}`} />
                <div><strong>{ALERT_LABELS[alert.type] || humanize(alert.type)}</strong><span>{apps.find((app) => app.id === alert.appId)?.name || alert.appId} · {formatDate(alert.timestamp)}</span></div>
                <StatusBadge tone={alert.severity}>{humanize(alert.severity)}</StatusBadge>
                {!alert.acknowledged && <button className="icon-button small" aria-label={`Acknowledge ${alert.id}`} type="button" onClick={() => onAcknowledge(alert)} disabled={Boolean(busyAction)}>✓</button>}
              </div>
            ))}</div>
          ) : <EmptyState title="No active alerts">Alerts appear when the backend records them.</EmptyState>}
        </Panel>
      </div>
      <div className="dashboard-grid dashboard-grid-lower">
        <Panel title="Access activity" eyebrow="Last seven days">{errors.events ? <ErrorState error={errors.events} title="Access events are unavailable" /> : <EventBars events={events} />}</Panel>
        <Panel title="Trust distribution" eyebrow="Applications by current level">{errors.apps ? <ErrorState error={errors.apps} title="Applications are unavailable" /> : apps.length ? <TrustDistribution apps={apps} /> : <EmptyState title="No trust data">Application trust levels will appear here.</EmptyState>}</Panel>
        <Panel title="Recent activity" eyebrow="Audit timeline" action={<button type="button" className="text-link" onClick={() => onNavigate('history')}>View history →</button>}>
          {errors.history ? <ErrorState error={errors.history} title="Activity history is unavailable" /> : <ActivityList items={history} apps={apps} />}
        </Panel>
      </div>
    </>
  );
}
