import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ACCESS_STATUS,
  ACTIVITY_EVENT_TYPES,
  ALERT_SEVERITY,
  ALERT_TYPES,
  APPLICATION_STATUS,
  RECOMMENDATION_STATUS,
  RESOURCE_TYPES,
  SUGGESTED_ACTIONS,
} from '@shared/contracts.js';
import { api } from './api.js';

const NAV_ITEMS = [
  { id: 'overview', label: 'Overview', symbol: '◫' },
  { id: 'applications', label: 'Applications', symbol: '▦' },
  { id: 'permissions', label: 'Permissions', symbol: '⌑' },
  { id: 'monitoring', label: 'Monitoring', symbol: '⌁' },
  { id: 'security', label: 'Security', symbol: '◇' },
  { id: 'trust', label: 'Trust analysis', symbol: '◉' },
  { id: 'recommendations', label: 'Recommendations', symbol: '↗' },
  { id: 'history', label: 'History', symbol: '↺' },
];

const RESOURCE_LABELS = {
  location: 'Location',
  contacts: 'Contacts',
  camera: 'Camera',
  microphone: 'Microphone',
  files: 'Files',
};

const EVENT_LABELS = {
  [ACTIVITY_EVENT_TYPES.ACCESS_ALLOWED]: 'Access allowed',
  [ACTIVITY_EVENT_TYPES.ACCESS_DENIED]: 'Access denied',
  [ACTIVITY_EVENT_TYPES.ALERT_CREATED]: 'Security alert',
  [ACTIVITY_EVENT_TYPES.PERMISSION_GRANTED]: 'Permission granted',
  [ACTIVITY_EVENT_TYPES.PERMISSION_REVOKED]: 'Permission revoked',
  [ACTIVITY_EVENT_TYPES.APP_SUSPENDED]: 'Application suspended',
  [ACTIVITY_EVENT_TYPES.APP_REACTIVATED]: 'Application reactivated',
  [ACTIVITY_EVENT_TYPES.TRUST_SCORE_CHANGED]: 'Trust score changed',
  [ACTIVITY_EVENT_TYPES.RECOMMENDATION_CREATED]: 'Recommendation created',
  [ACTIVITY_EVENT_TYPES.RECOMMENDATION_APPLIED]: 'Recommendation applied',
};

const ALERT_LABELS = {
  [ALERT_TYPES.EXCESSIVE_ACCESS]: 'Excessive access',
  [ALERT_TYPES.UNAUTHORIZED_RESOURCE]: 'Unauthorized resource',
  [ALERT_TYPES.SUSPENDED_APP_ACCESS]: 'Suspended application access',
  [ALERT_TYPES.REPEATED_RESTRICTED_ACCESS]: 'Repeated restricted access',
  [ALERT_TYPES.UNUSUAL_RESOURCE_COMBINATION]: 'Unusual resource combination',
};
let nextToastId = 0;

function formatDate(value, options = {}) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: options.dateStyle || 'medium',
    timeStyle: options.timeStyle || 'short',
  }).format(date);
}

function appName(apps, id) {
  return apps.find((app) => app.id === id)?.name || id || 'Unknown application';
}

function levelLabel(level) {
  if (!level) return 'Not available';
  return level.charAt(0).toUpperCase() + level.slice(1);
}

function usePagedRows(rows, pageSize = 8) {
  const [page, setPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  return {
    page: safePage,
    pageCount,
    setPage,
    visibleRows: rows.slice(safePage * pageSize, (safePage + 1) * pageSize),
  };
}

function Icon({ children, className = '' }) {
  return <span aria-hidden="true" className={`icon ${className}`}>{children}</span>;
}

function Button({ children, variant = 'secondary', className = '', ...props }) {
  return (
    <button className={`button button-${variant} ${className}`} {...props}>
      {children}
    </button>
  );
}

function StatusBadge({ children, tone = 'neutral' }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

function LoadingState({ label = 'Loading data' }) {
  return (
    <div className="loading-state" role="status">
      <span className="spinner" />
      <span>{label}</span>
    </div>
  );
}

function EmptyState({ title, children }) {
  return (
    <div className="empty-state">
      <span className="empty-mark">—</span>
      <strong>{title}</strong>
      {children && <p>{children}</p>}
    </div>
  );
}

function ApiUnavailable({ error, endpoint }) {
  if (!error) return null;
  return (
    <div className="api-unavailable" role="status">
      <strong>{endpoint} is unavailable</strong>
      <span>{error.message}</span>
      {error.status === 404 && (
        <small>The backend route is not mounted. No sample data is being shown.</small>
      )}
    </div>
  );
}

function Panel({ title, eyebrow, action, className = '', children }) {
  return (
    <section className={`panel ${className}`}>
      {(title || eyebrow || action) && (
        <div className="panel-heading">
          <div>
            {eyebrow && <span className="eyebrow">{eyebrow}</span>}
            {title && <h2>{title}</h2>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

function PageHeader({ eyebrow, title, description, actions }) {
  return (
    <header className="page-header">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  );
}

function TrustRing({ score, level, size = 'large' }) {
  const validScore = Number.isFinite(score) ? Math.min(100, Math.max(0, score)) : 0;
  const tone = level || 'unknown';
  return (
    <div
      className={`trust-ring trust-${tone} trust-ring-${size}`}
      style={{ '--score-progress': `${validScore}%` }}
      aria-label={Number.isFinite(score) ? `Trust score ${score} out of 100` : 'Trust score unavailable'}
    >
      <div className="trust-ring-center">
        <strong>{Number.isFinite(score) ? score : '—'}</strong>
        <span>of 100</span>
      </div>
    </div>
  );
}

function AppMark({ name = '' }) {
  const initials = name
    .replace(/\([^)]*\)/g, '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
  return <span className="app-mark">{initials || 'A'}</span>;
}

function Pagination({ page, pageCount, onChange, total }) {
  if (pageCount <= 1) return null;
  return (
    <div className="pagination">
      <span>{total} records · page {page + 1} of {pageCount}</span>
      <div>
        <Button disabled={page === 0} onClick={() => onChange(page - 1)}>Previous</Button>
        <Button disabled={page + 1 >= pageCount} onClick={() => onChange(page + 1)}>Next</Button>
      </div>
    </div>
  );
}

function SelectField({ label, value, onChange, options, className = '' }) {
  return (
    <label className={`field ${className}`}>
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}

function TextField({ label, value, onChange, ...props }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} {...props} />
    </label>
  );
}

function PermissionGrid({ app, onToggle, busy }) {
  if (!app) return <EmptyState title="Choose an application">Select an app to review its permissions.</EmptyState>;

  return (
    <div className="permission-grid">
      {RESOURCE_TYPES.map((resource, index) => {
        const permission = app.permissions?.[resource];
        const enabled = permission?.enabled === true;
        return (
          <article className="permission-card" key={resource}>
            <div className="permission-topline">
              <span className={`resource-symbol resource-${resource}`} aria-hidden="true">
                {['⌖', '◎', '▧', '◖', '▤'][index]}
              </span>
              <StatusBadge tone={enabled ? 'success' : 'muted'}>
                {enabled ? 'Enabled' : 'Disabled'}
              </StatusBadge>
            </div>
            <div>
              <h3>{RESOURCE_LABELS[resource]}</h3>
              <p>{resourceDescription(resource)}</p>
            </div>
            <dl className="permission-meta">
              <div><dt>Granted</dt><dd>{formatDate(permission?.grantedAt)}</dd></div>
              <div><dt>Last accessed</dt><dd>{formatDate(permission?.lastAccessedAt)}</dd></div>
            </dl>
            <button
              type="button"
              className={`switch ${enabled ? 'switch-on' : ''}`}
              role="switch"
              aria-checked={enabled}
              aria-label={`${enabled ? 'Disable' : 'Enable'} ${RESOURCE_LABELS[resource]} permission`}
              disabled={busy}
              onClick={() => onToggle(resource, !enabled)}
            >
              <span />
              <span className="switch-label">{enabled ? 'On' : 'Off'}</span>
            </button>
          </article>
        );
      })}
    </div>
  );
}

function resourceDescription(resource) {
  const descriptions = {
    location: 'Device location and route data',
    contacts: 'Address book and contact details',
    camera: 'Image capture and camera access',
    microphone: 'Audio input and recording',
    files: 'Local documents and attachments',
  };
  return descriptions[resource] || 'Application resource';
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
      <div className="chart-legend">
        <span><i className="legend-allowed" />Allowed</span>
        <span><i className="legend-denied" />Denied</span>
        <small>Based on the latest 200 events returned by the API</small>
      </div>
      <div className="bar-chart-grid">
        {points.map((point) => {
          const total = point.allowed + point.denied;
          const allowedHeight = total ? (point.allowed / total) * point.height * 100 : 0;
          const deniedHeight = total ? (point.denied / total) * point.height * 100 : 0;
          return (
            <div className="bar-column" key={point.label}>
              <div className="bar-track">
                {total > 0 && (
                  <div className="bar-stack" style={{ height: `${point.height * 100}%` }}>
                    <i className="bar-allowed" style={{ height: `${allowedHeight}%` }} />
                    <i className="bar-denied" style={{ height: `${deniedHeight}%` }} />
                  </div>
                )}
              </div>
              <span>{point.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TrustDistribution({ apps }) {
  const levels = ['high', 'moderate', 'low', 'critical'];
  return (
    <div className="distribution">
      {levels.map((level) => {
        const count = apps.filter((app) => app.trustLevel === level).length;
        return (
          <div className="distribution-row" key={level}>
            <span className={`distribution-dot trust-dot-${level}`} />
            <span>{levelLabel(level)}</span>
            <div className="distribution-track"><i style={{ width: `${apps.length ? (count / apps.length) * 100 : 0}%` }} /></div>
            <strong>{count}</strong>
          </div>
        );
      })}
    </div>
  );
}

function ActivityList({ items, apps, limit = 5 }) {
  return items.length ? (
    <div className="activity-list">
      {items.slice(0, limit).map((item) => (
        <article className="activity-item" key={item.id}>
          <span className={`activity-marker activity-${activityTone(item.eventType)}`} />
          <div className="activity-content">
            <div className="activity-title-row">
              <strong>{EVENT_LABELS[item.eventType] || humanize(item.eventType)}</strong>
              <time>{formatDate(item.timestamp)}</time>
            </div>
            <p>{item.description}</p>
            <span>{appName(apps, item.appId)}</span>
          </div>
        </article>
      ))}
    </div>
  ) : (
    <EmptyState title="No activity recorded">Activity will appear here when the backend history endpoint is available.</EmptyState>
  );
}

function activityTone(type) {
  if (type?.includes('denied') || type?.includes('revoked')) return 'danger';
  if (type?.includes('alert')) return 'warning';
  if (type?.includes('allowed') || type?.includes('granted')) return 'success';
  return 'neutral';
}

function humanize(value = '') {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function ErrorBlock({ error, endpoint }) {
  return (
    <div className="section-feedback">
      {error ? <ApiUnavailable error={error} endpoint={endpoint} /> : null}
    </div>
  );
}

function AlertRows({ alerts, apps, events, onAcknowledge, onView, busyId }) {
  const eventById = useMemo(() => new Map(events.map((event) => [event.id, event])), [events]);
  return alerts.map((alert) => {
    const resource = (alert.relatedEventIds || [])
      .map((eventId) => eventById.get(eventId)?.resource)
      .find(Boolean);
    return (
      <article className="alert-row" key={alert.id}>
        <div className="alert-row-main">
          <span className={`severity-mark severity-${alert.severity || 'low'}`} />
          <div>
            <strong>{ALERT_LABELS[alert.type] || humanize(alert.type)}</strong>
            <p>{alert.message}</p>
            <div className="alert-meta">
              <span>{appName(apps, alert.appId)}</span>
              {resource && <span>{RESOURCE_LABELS[resource] || resource}</span>}
              <time>{formatDate(alert.timestamp)}</time>
            </div>
          </div>
        </div>
        <div className="alert-row-side">
          <StatusBadge tone={alert.severity || 'neutral'}>{humanize(alert.severity)}</StatusBadge>
          <Button onClick={() => onView(alert)}>Details</Button>
          {alert.acknowledged
            ? <StatusBadge tone="muted">Acknowledged</StatusBadge>
            : <Button disabled={busyId === alert.id} onClick={() => onAcknowledge(alert)}>Acknowledge</Button>}
        </div>
      </article>
    );
  });
}

function App() {
  const [page, setPage] = useState(() => {
    if (typeof window === 'undefined') return 'overview';
    const hash = window.location.hash.replace('#', '');
    return ['overview', 'applications', 'permissions', 'monitoring', 'security', 'trust', 'recommendations', 'history'].includes(hash) ? hash : 'overview';
  });
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [apps, setApps] = useState([]);
  const [events, setEvents] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [history, setHistory] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [stats, setStats] = useState(null);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [busyAction, setBusyAction] = useState('');
  const [selectedAppId, setSelectedAppId] = useState('');
  const [trustData, setTrustData] = useState(null);
  const [simulationResult, setSimulationResult] = useState(null);
  const [trustError, setTrustError] = useState(null);
  const [detailApp, setDetailApp] = useState(null);
  const [detailError, setDetailError] = useState(null);
  const [modal, setModal] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [refreshKey, setRefreshKey] = useState(0);

  const notify = useCallback((message, tone = 'success') => {
    nextToastId += 1;
    const id = `toast-${nextToastId}`;
    setToasts((current) => [...current, { id, message, tone }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 4200);
  }, []);

  const refresh = useCallback(async ({ quiet = false } = {}) => {
    if (!quiet) setBusy(true);
    const [appsResult, eventsResult, alertsResult, historyResult, statsResult] = await Promise.allSettled([
      api.getApps(),
      api.getEvents({ limit: 200 }),
      api.getAlerts({ limit: 200 }),
      api.getHistory({ limit: 100 }),
      api.getStats(),
    ]);

    const nextErrors = {};
    if (appsResult.status === 'fulfilled') {
      const value = Array.isArray(appsResult.value) ? appsResult.value : [];
      setApps(value);
      setSelectedAppId((current) => value.some((app) => app.id === current) ? current : (value[0]?.id || ''));
    } else {
      nextErrors.apps = appsResult.reason;
    }

    if (eventsResult.status === 'fulfilled') {
      setEvents(Array.isArray(eventsResult.value) ? eventsResult.value : []);
    } else {
      nextErrors.events = eventsResult.reason;
    }
    if (alertsResult.status === 'fulfilled') {
      setAlerts(Array.isArray(alertsResult.value) ? alertsResult.value : []);
    } else {
      nextErrors.alerts = alertsResult.reason;
    }
    if (historyResult.status === 'fulfilled') {
      setHistory(Array.isArray(historyResult.value) ? historyResult.value : []);
    } else {
      nextErrors.history = historyResult.reason;
    }
    if (statsResult.status === 'fulfilled') setStats(statsResult.value);
    else nextErrors.stats = statsResult.reason;
    setErrors(nextErrors);

    const currentApps = appsResult.status === 'fulfilled' && Array.isArray(appsResult.value)
      ? appsResult.value
      : [];
    if (currentApps.length) {
      const recResults = await Promise.allSettled(
        currentApps.map((app) => api.getRecommendations(app.id)),
      );
      const combined = [];
      const recommendationErrors = [];
      for (const result of recResults) {
        if (result.status === 'fulfilled' && Array.isArray(result.value)) combined.push(...result.value);
        else if (result.status === 'rejected') recommendationErrors.push(result.reason);
      }
      setRecommendations(combined);
      if (recommendationErrors.length) {
        setErrors((current) => ({ ...current, recommendations: recommendationErrors[0] }));
      }
    } else {
      setRecommendations([]);
    }
    if (!quiet) setBusy(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refreshKey, refresh]);

  useEffect(() => {
    if (page !== 'trust' || !selectedAppId) return undefined;
    let active = true;
    setTrustData(null);
    setTrustError(null);
    api.getTrustScore(selectedAppId)
      .then((data) => { if (active) setTrustData(data); })
      .catch((error) => { if (active) setTrustError(error); });
    return () => { active = false; };
  }, [page, selectedAppId]);

  const selectedApp = apps.find((app) => app.id === selectedAppId) || null;
  const activeAlerts = alerts.filter((alert) => !alert.acknowledged).length;
  const averageTrust = apps.length
    ? Math.round(apps.reduce((sum, app) => sum + (Number.isFinite(app.trustScore) ? app.trustScore : 0), 0) / apps.length)
    : null;

  const runAction = useCallback(async (key, action, successMessage) => {
    setBusyAction(key);
    try {
      await action();
      if (successMessage) notify(successMessage);
      setModal(null);
      setRefreshKey((current) => current + 1);
    } catch (error) {
      notify(error.message, 'error');
    } finally {
      setBusyAction('');
    }
  }, [notify]);

  function askPermissionChange(app, resource, enabled) {
    const action = enabled ? 'grant' : 'revoke';
    setModal({
      title: `${enabled ? 'Enable' : 'Disable'} ${RESOURCE_LABELS[resource]} access?`,
      description: `${action === 'grant' ? 'This gives' : 'This removes'} ${app.name} ${enabled ? 'permission to use' : 'access to'} ${RESOURCE_LABELS[resource].toLowerCase()}. The change will be recorded by the backend.`,
      confirmLabel: enabled ? 'Enable permission' : 'Disable permission',
      danger: !enabled,
      onConfirm: () => runAction(
        `${app.id}-${resource}`,
        () => api.updatePermission(app.id, resource, enabled),
        `${RESOURCE_LABELS[resource]} permission ${enabled ? 'enabled' : 'disabled'}.`,
      ),
    });
  }

  function askStatusChange(app) {
    const nextStatus = app.status === APPLICATION_STATUS.SUSPENDED
      ? APPLICATION_STATUS.ACTIVE
      : APPLICATION_STATUS.SUSPENDED;
    setModal({
      title: `${nextStatus === APPLICATION_STATUS.SUSPENDED ? 'Suspend' : 'Reactivate'} ${app.name}?`,
      description: nextStatus === APPLICATION_STATUS.SUSPENDED
        ? 'The backend will deny future simulated access requests from this application.'
        : 'This application will be allowed to request enabled permissions again.',
      confirmLabel: nextStatus === APPLICATION_STATUS.SUSPENDED ? 'Suspend application' : 'Reactivate application',
      danger: nextStatus === APPLICATION_STATUS.SUSPENDED,
      onConfirm: () => runAction(
        `status-${app.id}`,
        () => api.updateStatus(app.id, nextStatus),
        `${app.name} is now ${nextStatus}.`,
      ),
    });
  }

  async function openAppDetails(app) {
    setDetailApp(null);
    setDetailError(null);
    setModal({ type: 'detail', title: app.name });
    try {
      const data = await api.getApp(app.id);
      setDetailApp(data);
    } catch (error) {
      setDetailError(error);
    }
  }

  function openAlertDetails(alert) {
    setModal({
      type: 'alert-detail',
      alert,
      title: ALERT_LABELS[alert.type] || humanize(alert.type),
      onAcknowledge: askAcknowledge,
    });
  }

  function askAcknowledge(alert) {
    runAction(
      `ack-${alert.id}`,
      () => api.acknowledgeAlert(alert.id),
      'Alert acknowledged.',
    );
  }

  function askApplyRecommendation(recommendation) {
    const highImpact = recommendation.suggestedAction === SUGGESTED_ACTIONS.SUSPEND_APP
      || recommendation.suggestedAction === SUGGESTED_ACTIONS.REVOKE_PERMISSION;
    setModal({
      title: 'Apply this recommendation?',
      description: `${recommendation.title}. ${recommendation.description}`,
      confirmLabel: highImpact ? 'Apply recommendation' : 'Confirm',
      danger: recommendation.suggestedAction === SUGGESTED_ACTIONS.SUSPEND_APP,
      onConfirm: () => runAction(
        `rec-${recommendation.id}`,
        () => api.applyRecommendation(recommendation.id),
        'Recommendation applied.',
      ),
    });
  }

  async function simulate(payload) {
    setBusyAction('simulate');
    try {
      const result = await api.simulateEvents(payload);
      setSimulationResult(result);
      const summary = result?.summary;
      notify(
        `Simulation complete: ${summary?.allowed ?? 0} allowed, ${summary?.denied ?? 0} denied.`,
      );
      setRefreshKey((current) => current + 1);
      return result;
    } catch (error) {
      notify(error.message, 'error');
      throw error;
    } finally {
      setBusyAction('');
    }
  }

  function confirmReset() {
    setModal({
      title: 'Reset the demo environment?',
      description: 'This restores the backend’s deterministic seed data and clears simulated changes.',
      confirmLabel: 'Reset demo',
      danger: true,
      onConfirm: () => runAction('reset-demo', api.resetDemo, 'Demo environment reset.'),
    });
  }

  function confirmRunDemo() {
    setModal({
      title: 'Run the demo scenario?',
      description: 'This resets seed data, simulates the access scenario, applies the generated location recommendation, and records the follow-up request.',
      confirmLabel: 'Run scenario',
      onConfirm: async () => {
        setBusyAction('demo');
        try {
          await api.resetDemo();
          const start = Date.now();
          await api.simulateEvents({
            appId: 'app_01', resource: 'location', reason: 'Workout route tracking', count: 3,
            startTime: new Date(start).toISOString(),
          });
          await api.simulateEvents({
            appId: 'app_01', resource: 'location', reason: 'Background route update', count: 25,
            startTime: new Date(start + 120000).toISOString(),
          });
          await api.simulateEvents({
            appId: 'app_01', resource: 'contacts', reason: 'Find friends for activity', count: 1,
            startTime: new Date(start + 240000).toISOString(),
          });
          const recs = await api.getRecommendations('app_01');
          const locationRecommendation = recs.find((item) => (
            item.resource === 'location' && item.status === RECOMMENDATION_STATUS.PENDING
          ));
          if (locationRecommendation) await api.applyRecommendation(locationRecommendation.id);
          await api.simulateEvents({
            appId: 'app_01', resource: 'location', reason: 'Follow-up location request', count: 1,
            startTime: new Date(start + 300000).toISOString(),
          });
          notify('Demo scenario completed.');
          setModal(null);
          setRefreshKey((current) => current + 1);
        } catch (error) {
          notify(error.message, 'error');
          setModal(null);
        } finally {
          setBusyAction('');
        }
      },
    });
  }

  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash.replace('#', '');
      if (['overview', 'applications', 'permissions', 'monitoring', 'security', 'trust', 'recommendations', 'history'].includes(hash)) {
        setPage(hash);
      }
    };
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  const navigate = (nextPage) => {
    setPage(nextPage);
    if (typeof window !== 'undefined') {
      window.location.hash = nextPage;
    }
    setMobileNavOpen(false);
  };

  const renderPage = () => {
    const shared = {
      apps,
      events,
      alerts,
      history,
      recommendations,
      selectedAppId,
      selectedApp,
      setSelectedAppId,
      errors,
      busyAction,
      onPermissionChange: askPermissionChange,
      onStatusChange: askStatusChange,
      onAcknowledge: askAcknowledge,
      onApplyRecommendation: askApplyRecommendation,
      onViewAlert: openAlertDetails,
      onSimulate: simulate,
      onViewApp: openAppDetails,
    };

    switch (page) {
      case 'applications': return <ApplicationsPage {...shared} />;
      case 'permissions': return <PermissionsPage {...shared} />;
      case 'monitoring': return <MonitoringPage {...shared} simulationResult={simulationResult} />;
      case 'security': return <SecurityPage {...shared} />;
      case 'trust': return (
        <TrustPage
          {...shared}
          trustData={trustData}
          trustError={trustError}
          onRefresh={() => setRefreshKey((current) => current + 1)}
        />
      );
      case 'recommendations': return <RecommendationsPage {...shared} />;
      case 'history': return <HistoryPage {...shared} />;
      default: return (
        <OverviewPage
          {...shared}
          stats={stats}
          averageTrust={averageTrust}
          activeAlerts={activeAlerts}
          onRunDemo={confirmRunDemo}
          onReset={confirmReset}
          onNavigate={navigate}
        />
      );
    }
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#overview" onClick={(event) => { event.preventDefault(); navigate('overview'); }}>
          <span className="brand-mark"><span /><span /><span /></span>
          <span className="brand-copy">
            <strong>E.D.I.T.H.</strong>
            <small>Enhanced Digital Identity &amp; Heuristics</small>
          </span>
        </a>
        <div className="topbar-tools">
          <span className="environment-tag"><i />Simulated Environment</span>
          <button type="button" className="icon-button refresh-button" aria-label="Refresh data" onClick={() => setRefreshKey((current) => current + 1)}>
            <Icon>↻</Icon>
          </button>
          <span className="profile-mark" aria-label="Workspace profile" title="Security Workspace">ED</span>
        </div>
      </header>

      <div className="navigation-wrap">
        <button
          type="button"
          className="mobile-menu-button"
          aria-expanded={mobileNavOpen}
          aria-controls="primary-navigation"
          onClick={() => setMobileNavOpen((open) => !open)}
        >
          <Icon>{mobileNavOpen ? '×' : '☰'}</Icon>
          <span>Navigate</span>
        </button>
        <nav id="primary-navigation" className={`primary-navigation ${mobileNavOpen ? 'navigation-open' : ''}`} aria-label="Primary">
          {NAV_ITEMS.map((item) => (
            <button
              type="button"
              key={item.id}
              className={`nav-link ${page === item.id ? 'nav-link-active' : ''}`}
              aria-current={page === item.id ? 'page' : undefined}
              onClick={() => navigate(item.id)}
            >
              <span className="nav-symbol" aria-hidden="true">{item.symbol}</span>
              {item.label}
            </button>
          ))}
        </nav>
      </div>

      <main className="main-content">
        {busy && page === 'overview' && <div className="refresh-indicator"><span className="spinner" />Refreshing live data</div>}
        {renderPage()}
      </main>

      <footer className="page-footer-container">
        <div className="footer-grid">
          <div className="footer-brand">
            <span className="footer-badge">Security Intelligence &amp; Governance</span>
            <strong>E.D.I.T.H.</strong>
            <p>
              Enhanced Digital Identity, Trust &amp; Heuristics. Autonomous heuristic trust scoring, centralized permission governance, and behavioral security intelligence.
            </p>
            <p style={{ marginTop: '4px', fontSize: '11px', color: 'var(--charcoal-500)' }}>
              Deterministic permission management and simulated runtime heuristic security telemetry.
            </p>
          </div>
          <div className="footer-col">
            <h4>Navigation</h4>
            <ul>
              <li><button type="button" onClick={() => navigate('overview')}>Overview</button></li>
              <li><button type="button" onClick={() => navigate('applications')}>Applications</button></li>
              <li><button type="button" onClick={() => navigate('permissions')}>Permissions</button></li>
              <li><button type="button" onClick={() => navigate('monitoring')}>Monitoring</button></li>
            </ul>
          </div>
          <div className="footer-col">
            <h4>Security Hub</h4>
            <ul>
              <li><button type="button" onClick={() => navigate('security')}>Security Alerts</button></li>
              <li><button type="button" onClick={() => navigate('trust')}>Trust Analysis</button></li>
              <li><button type="button" onClick={() => navigate('recommendations')}>Recommendations</button></li>
              <li><button type="button" onClick={() => navigate('history')}>Activity History</button></li>
            </ul>
          </div>
          <div className="footer-col">
            <h4>Platform Telemetry</h4>
            <ul>
              <li><button type="button" onClick={() => navigate('overview')}>System Overview</button></li>
              <li><button type="button" onClick={() => navigate('monitoring')}>Access Stream</button></li>
              <li><button type="button" onClick={() => navigate('security')}>Anomaly Heuristics</button></li>
              <li><button type="button" onClick={() => navigate('trust')}>Trust Computation</button></li>
            </ul>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© 2026 E.D.I.T.H. — Enhanced Digital Identity, Trust &amp; Heuristics. All rights reserved.</span>
          <span>Simulated Security &amp; Heuristic Access Control</span>
        </div>
      </footer>

      {modal && (
        <ConfirmationModal
          modal={modal}
          busy={Boolean(busyAction)}
          detailApp={detailApp}
          detailError={detailError}
          apps={apps}
          events={events}
          alerts={alerts}
          history={history}
          onAcknowledgeAlert={askAcknowledge}
          onCancel={() => { if (!busyAction) setModal(null); }}
        />
      )}

      <div className="toast-stack" aria-live="polite" aria-atomic="false">
        {toasts.map((toast) => (
          <div className={`toast toast-${toast.tone}`} key={toast.id} role="status">
            <i />
            <span>{toast.message}</span>
            <button type="button" aria-label="Dismiss notification" onClick={() => setToasts((current) => current.filter((item) => item.id !== toast.id))}>×</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function OverviewPage({
  apps, events, alerts, history, errors, averageTrust, activeAlerts, stats,
  onRunDemo, onReset, onNavigate, onAcknowledge, busyAction,
}) {
  const allowed = stats?.allowedRequests ?? events.filter((event) => event.status === ACCESS_STATUS.ALLOWED).length;
  const denied = stats?.deniedRequests ?? events.filter((event) => event.status === ACCESS_STATUS.DENIED).length;
  const totalApps = stats?.totalApps ?? apps.length;
  const appsList = apps.slice().sort((a, b) => (b.trustScore ?? -1) - (a.trustScore ?? -1));

  return (
    <>
      <PageHeader
        eyebrow={`Workspace Environment · ${new Intl.DateTimeFormat(undefined, { dateStyle: 'full' }).format(new Date())}`}
        title="Autonomous Digital Trust & Heuristic Security."
        description="Centralized permission governance, real-time access telemetry, and behavioral anomaly detection for modern applications."
        actions={(
          <>
            <Button onClick={onReset} disabled={Boolean(busyAction)}>Reset demo</Button>
            <Button variant="primary" onClick={onRunDemo} disabled={Boolean(busyAction)}>
              {busyAction === 'demo' ? 'Running scenario…' : 'Run demo scenario'}
              <Icon>↗</Icon>
            </Button>
          </>
        )}
      />

      <section className="kpi-grid" aria-label="Environment summary">
        <KpiCard label="Applications" value={errors.apps ? '—' : totalApps} detail="Registered in workspace" icon="▦" />
        <KpiCard label="Allowed requests" value={errors.events ? '—' : allowed} detail={stats ? 'All recorded requests' : 'Across the latest 200 events'} icon="✓" tone="success" />
        <KpiCard label="Denied requests" value={errors.events ? '—' : denied} detail={stats ? 'All recorded requests' : 'Across the latest 200 events'} icon="×" tone="warning" />
        <KpiCard label="Active alerts" value={errors.alerts ? '—' : activeAlerts} detail={errors.alerts ? 'Alert API unavailable' : 'Unacknowledged alerts'} icon="◇" tone="danger" />
        <KpiCard label="Average trust" value={errors.apps ? '—' : averageTrust === null ? '—' : `${averageTrust}`} suffix={averageTrust === null ? '' : '/100'} detail="Based on API trust scores" icon="◉" tone="espresso" />
      </section>

      <div className="dashboard-grid dashboard-grid-main">
        <Panel
          title="Application trust overview"
          eyebrow="Across your workspace"
          className="span-two"
          action={<button type="button" className="text-link" onClick={() => onNavigate('applications')}>View all <Icon>→</Icon></button>}
        >
          {errors.apps ? <ErrorBlock error={errors.apps} endpoint="Applications" /> : appsList.length ? (
            <div className="trust-app-list">
              {appsList.map((app) => {
                const enabledPermissions = Object.values(app.permissions || {}).filter((permission) => permission.enabled).length;
                return (
                  <div className="trust-app-row" key={app.id}>
                    <AppMark name={app.name} />
                    <div className="trust-app-name">
                      <strong>{app.name}</strong>
                      <span>{enabledPermissions} permissions enabled</span>
                    </div>
                    <StatusBadge tone={app.status === APPLICATION_STATUS.ACTIVE ? 'success' : 'muted'}>{humanize(app.status)}</StatusBadge>
                    <div className="trust-app-score">
                      <div><strong>{Number.isFinite(app.trustScore) ? app.trustScore : '—'}</strong><span>{levelLabel(app.trustLevel)}</span></div>
                      <div className="score-track"><i className={`score-fill trust-fill-${app.trustLevel || 'unknown'}`} style={{ width: `${Number.isFinite(app.trustScore) ? app.trustScore : 0}%` }} /></div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : <EmptyState title="No applications found">Applications will appear here when the API returns them.</EmptyState>}
        </Panel>

        <Panel title="Recent security alerts" eyebrow="Needs attention" action={<button type="button" className="text-link" onClick={() => onNavigate('security')}>All alerts <Icon>→</Icon></button>}>
          {errors.alerts ? <ErrorBlock error={errors.alerts} endpoint="Security alerts" /> : alerts.length ? (
            <div className="compact-alert-list">
              {alerts.slice(0, 4).map((alert) => (
                <div className="compact-alert" key={alert.id}>
                  <span className={`severity-mark severity-${alert.severity}`} />
                  <div>
                    <strong>{ALERT_LABELS[alert.type] || humanize(alert.type)}</strong>
                    <span>{appName(apps, alert.appId)} · {formatDate(alert.timestamp)}</span>
                  </div>
                  <StatusBadge tone={alert.severity}>{humanize(alert.severity)}</StatusBadge>
                  {!alert.acknowledged && <button className="icon-button small" aria-label={`Acknowledge ${alert.id}`} onClick={() => onAcknowledge(alert)} disabled={Boolean(busyAction)}>✓</button>}
                </div>
              ))}
            </div>
          ) : <EmptyState title="No active alerts">Alerts will appear when the security API is connected.</EmptyState>}
        </Panel>
      </div>

      <div className="dashboard-grid dashboard-grid-lower">
        <Panel title="Access activity" eyebrow="Last seven days">
          {errors.events
            ? <ErrorBlock error={errors.events} endpoint="Access events" />
            : <EventBars events={events} />}
        </Panel>
        <Panel title="Trust distribution" eyebrow="Applications by current level">
          {errors.apps
            ? <ErrorBlock error={errors.apps} endpoint="Applications" />
            : apps.length ? <TrustDistribution apps={apps} /> : <EmptyState title="No trust data">Application trust levels will appear here.</EmptyState>}
        </Panel>
        <Panel title="Recent activity" eyebrow="Audit timeline" action={<button type="button" className="text-link" onClick={() => onNavigate('history')}>View history <Icon>→</Icon></button>}>
          {errors.history
            ? <ErrorBlock error={errors.history} endpoint="Activity history" />
            : <ActivityList items={history} apps={apps} limit={4} />}
        </Panel>
      </div>
    </>
  );
}

function KpiCard({ label, value, suffix = '', detail, icon, tone = 'neutral' }) {
  return (
    <article className={`kpi-card kpi-${tone}`}>
      <div className="kpi-topline"><span>{label}</span><span className="kpi-icon">{icon}</span></div>
      <div className="kpi-value">{value}<small>{suffix}</small></div>
      <p>{detail}</p>
    </article>
  );
}

function ApplicationsPage({ apps, events, errors, onStatusChange, onViewApp, busyAction }) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [sort, setSort] = useState('trust');
  const filtered = useMemo(() => apps
    .filter((app) => app.name.toLowerCase().includes(search.toLowerCase()) || app.description?.toLowerCase().includes(search.toLowerCase()))
    .filter((app) => status === 'all' || app.status === status)
    .sort((left, right) => sort === 'name'
      ? left.name.localeCompare(right.name)
      : (right.trustScore ?? -1) - (left.trustScore ?? -1)), [apps, search, status, sort]);

  return (
    <>
      <PageHeader eyebrow="Application registry" title="Applications" description="Review the apps in your environment and understand their access posture." />
      <div className="toolbar">
        <TextField label="Search applications" value={search} onChange={setSearch} placeholder="Name or description" />
        <SelectField label="Status" value={status} onChange={setStatus} options={[
          { value: 'all', label: 'All statuses' },
          { value: APPLICATION_STATUS.ACTIVE, label: 'Active' },
          { value: APPLICATION_STATUS.SUSPENDED, label: 'Suspended' },
        ]} />
        <SelectField label="Sort by" value={sort} onChange={setSort} options={[
          { value: 'trust', label: 'Trust score' },
          { value: 'name', label: 'Application name' },
        ]} />
        <span className="toolbar-count">{filtered.length} applications</span>
      </div>
      <ErrorBlock error={errors.apps} endpoint="Applications" />
      {filtered.length ? (
        <div className="application-grid">
          {filtered.map((app) => {
            const permissions = Object.entries(app.permissions || {}).filter(([, permission]) => permission.enabled);
            const lastAccess = Object.values(app.permissions || {})
              .map((permission) => permission.lastAccessedAt)
              .filter(Boolean)
              .sort()
              .at(-1);
            return (
              <article className="application-card" key={app.id}>
                <div className="application-card-top">
                  <AppMark name={app.name} />
                  <StatusBadge tone={app.status === APPLICATION_STATUS.ACTIVE ? 'success' : 'muted'}>{humanize(app.status)}</StatusBadge>
                </div>
                <h2>{app.name}</h2>
                <p className="application-description">{app.description}</p>
                <div className="application-card-score">
                  <TrustRing score={app.trustScore} level={app.trustLevel} size="small" />
                  <div><strong>{Number.isFinite(app.trustScore) ? app.trustScore : '—'} <small>/ 100</small></strong><span>{levelLabel(app.trustLevel)} trust</span></div>
                </div>
                <div className="permission-chips">
                  {permissions.length
                    ? permissions.map(([resource]) => <span key={resource}>{RESOURCE_LABELS[resource] || resource}</span>)
                    : <span className="muted-chip">No permissions enabled</span>}
                </div>
                <div className="application-last-access">
                  <span>Last accessed</span><strong>{formatDate(lastAccess)}</strong>
                </div>
                <div className="application-card-actions">
                  <Button onClick={() => onViewApp(app)}>View details</Button>
                  <Button
                    variant={app.status === APPLICATION_STATUS.ACTIVE ? 'danger-quiet' : 'primary'}
                    disabled={Boolean(busyAction)}
                    onClick={() => onStatusChange(app)}
                  >
                    {app.status === APPLICATION_STATUS.ACTIVE ? 'Suspend' : 'Reactivate'}
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      ) : errors.apps ? null : <EmptyState title="No matching applications">Adjust the filters or search term and try again.</EmptyState>}
      <p className="data-note">Application scores and status are supplied by the backend. Access activity currently includes {events.length} API event records.</p>
    </>
  );
}

function PermissionsPage({ apps, selectedAppId, setSelectedAppId, selectedApp, errors, onPermissionChange, busyAction }) {
  return (
    <>
      <PageHeader eyebrow="Access governance" title="Permissions" description="Review and change each application’s access to sensitive resources." />
      <Panel title="Select an application" className="permission-selector-panel">
        {errors.apps ? <ErrorBlock error={errors.apps} endpoint="Applications" /> : (
          <SelectField
            label="Application"
            value={selectedAppId}
            onChange={setSelectedAppId}
            options={apps.map((app) => ({ value: app.id, label: app.name }))}
          />
        )}
        {selectedApp && (
          <div className="selected-app-summary">
            <AppMark name={selectedApp.name} />
            <div><strong>{selectedApp.name}</strong><span>{selectedApp.description}</span></div>
            <StatusBadge tone={selectedApp.status === APPLICATION_STATUS.ACTIVE ? 'success' : 'muted'}>{humanize(selectedApp.status)}</StatusBadge>
          </div>
        )}
      </Panel>
      {selectedApp ? (
        <>
          <div className="section-heading">
            <div><span className="eyebrow">Permission inventory</span><h2>Resource access</h2></div>
            <p>Changes require confirmation and are sent to the backend.</p>
          </div>
          <PermissionGrid
            app={selectedApp}
            busy={Boolean(busyAction)}
            onToggle={(resource, enabled) => onPermissionChange(selectedApp, resource, enabled)}
          />
        </>
      ) : !errors.apps && <EmptyState title="No applications available">Connect to the backend to manage permissions.</EmptyState>}
      <div className="notice notice-simulated"><strong>Access decisions stay server-side.</strong><span>This interface requests permission updates; the backend remains the source of truth for access decisions.</span></div>
    </>
  );
}

function MonitoringPage({ apps, events, errors, onSimulate, busyAction, simulationResult }) {
  const [appFilter, setAppFilter] = useState('all');
  const [resourceFilter, setResourceFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [suspiciousFilter, setSuspiciousFilter] = useState('all');
  const [search, setSearch] = useState('');
  const filtered = useMemo(() => events
    .filter((event) => appFilter === 'all' || event.appId === appFilter)
    .filter((event) => resourceFilter === 'all' || event.resource === resourceFilter)
    .filter((event) => statusFilter === 'all' || event.status === statusFilter)
    .filter((event) => suspiciousFilter === 'all' || String(Boolean(event.suspicious)) === suspiciousFilter)
    .filter((event) => `${event.reason} ${event.id} ${appName(apps, event.appId)}`.toLowerCase().includes(search.toLowerCase())), [
    events, apps, appFilter, resourceFilter, statusFilter, suspiciousFilter, search,
  ]);
  const pageData = usePagedRows(filtered, 10);

  return (
    <>
      <PageHeader eyebrow="Simulated runtime activity" title="Access monitoring" description="Inspect requests as they pass through the E.D.I.T.H. backend and simulate new activity." />
      <SimulationPanel apps={apps} onSubmit={onSimulate} busy={busyAction === 'simulate'} />
      {simulationResult && <SimulationResultPanel result={simulationResult} />}
      <Panel title="Access event stream" eyebrow={`${events.length} recent records`}>
        {errors.events ? <ErrorBlock error={errors.events} endpoint="Access events" /> : (
          <>
            <div className="filter-toolbar">
              <TextField label="Search events" value={search} onChange={(value) => { setSearch(value); pageData.setPage(0); }} placeholder="Reason, app or event ID" />
              <SelectField label="Application" value={appFilter} onChange={(value) => { setAppFilter(value); pageData.setPage(0); }} options={[
                { value: 'all', label: 'All applications' },
                ...apps.map((app) => ({ value: app.id, label: app.name })),
              ]} />
              <SelectField label="Resource" value={resourceFilter} onChange={(value) => { setResourceFilter(value); pageData.setPage(0); }} options={[
                { value: 'all', label: 'All resources' },
                ...RESOURCE_TYPES.map((resource) => ({ value: resource, label: RESOURCE_LABELS[resource] })),
              ]} />
              <SelectField label="Decision" value={statusFilter} onChange={(value) => { setStatusFilter(value); pageData.setPage(0); }} options={[
                { value: 'all', label: 'All decisions' },
                { value: ACCESS_STATUS.ALLOWED, label: 'Allowed' },
                { value: ACCESS_STATUS.DENIED, label: 'Denied' },
              ]} />
              <SelectField label="Suspicious" value={suspiciousFilter} onChange={(value) => { setSuspiciousFilter(value); pageData.setPage(0); }} options={[
                { value: 'all', label: 'Any' }, { value: 'true', label: 'Yes' }, { value: 'false', label: 'No' },
              ]} />
            </div>
            {filtered.length ? (
              <div className="table-scroll">
                <table>
                  <thead><tr><th>Application</th><th>Resource</th><th>Reason</th><th>Timestamp</th><th>Decision</th><th>Signal</th><th>Alert ref.</th></tr></thead>
                  <tbody>
                    {pageData.visibleRows.map((event) => (
                      <tr key={event.id}>
                        <td><span className="table-app"><AppMark name={appName(apps, event.appId)} />{appName(apps, event.appId)}</span></td>
                        <td>{RESOURCE_LABELS[event.resource] || event.resource}</td>
                        <td className="truncate-cell" title={event.reason}>{event.reason || '—'}</td>
                        <td>{formatDate(event.timestamp)}</td>
                        <td><StatusBadge tone={event.status === ACCESS_STATUS.ALLOWED ? 'success' : 'danger'}>{humanize(event.status)}</StatusBadge></td>
                        <td>{event.suspicious ? <StatusBadge tone="warning">Suspicious</StatusBadge> : <span className="muted-text">—</span>}</td>
                        <td>{event.alertId || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <EmptyState title="No matching events">Events will appear after a simulated request is submitted.</EmptyState>}
            <Pagination page={pageData.page} pageCount={pageData.pageCount} total={filtered.length} onChange={pageData.setPage} />
          </>
        )}
      </Panel>
    </>
  );
}

function SimulationResultPanel({ result }) {
  const summary = result.summary || {};
  const createdAlerts = Array.isArray(result.alertsCreated) ? result.alertsCreated : [];
  return (
    <Panel title="Latest simulation result" eyebrow="Backend response" className="simulation-result">
      <div className="simulation-result-summary">
        <div><span>Total requests</span><strong>{summary.total ?? result.events?.length ?? '—'}</strong></div>
        <div><span>Allowed</span><strong>{summary.allowed ?? '—'}</strong></div>
        <div><span>Denied</span><strong>{summary.denied ?? '—'}</strong></div>
        {result.trustScore && <div><span>Trust score</span><strong>{result.trustScore.score ?? '—'} <small>{levelLabel(result.trustScore.level)}</small></strong></div>}
      </div>
      <div className="simulation-result-alerts">
        <strong>New alerts</strong>
        {createdAlerts.length ? createdAlerts.map((alert) => (
          <div className="simulation-created-alert" key={alert.id}>
            <span className={`severity-mark severity-${alert.severity}`} />
            <span>{ALERT_LABELS[alert.type] || humanize(alert.type)}</span>
            <StatusBadge tone={alert.severity}>{humanize(alert.severity)}</StatusBadge>
            <code>{alert.id}</code>
          </div>
        )) : <span className="muted-text">The backend returned no newly created alerts.</span>}
      </div>
    </Panel>
  );
}

function SimulationPanel({ apps, onSubmit, busy }) {
  const [appId, setAppId] = useState('');
  const [resource, setResource] = useState(RESOURCE_TYPES[0]);
  const [reason, setReason] = useState('');
  const [count, setCount] = useState('1');

  useEffect(() => {
    if (!apps.some((app) => app.id === appId)) setAppId(apps[0]?.id || '');
  }, [apps, appId]);

  function submit(event) {
    event.preventDefault();
    onSubmit({ appId, resource, reason: reason.trim() || 'Simulated request', count: Number(count) });
  }

  return (
    <Panel title="Simulate an access request" eyebrow="Controlled test activity" className="simulation-panel">
      <form className="simulation-form" onSubmit={submit}>
        <SelectField label="Application" value={appId} onChange={setAppId} options={apps.map((app) => ({ value: app.id, label: app.name }))} />
        <SelectField label="Resource" value={resource} onChange={setResource} options={RESOURCE_TYPES.map((item) => ({ value: item, label: RESOURCE_LABELS[item] }))} />
        <TextField label="Request reason" value={reason} onChange={setReason} placeholder="e.g. Workout route tracking" maxLength={160} />
        <TextField label="Request count" type="number" min="1" max="100" value={count} onChange={setCount} required />
        <Button type="submit" variant="primary" disabled={busy || !appId || Number(count) < 1 || Number(count) > 100}>
          {busy ? 'Generating…' : 'Generate requests'} <Icon>↗</Icon>
        </Button>
      </form>
      <p className="form-note"><Icon>i</Icon> Requests are simulated through the backend. The backend decides whether each request is allowed.</p>
    </Panel>
  );
}

function SecurityPage({ apps, alerts, events, errors, onAcknowledge, onViewAlert, busyAction }) {
  const [severity, setSeverity] = useState('all');
  const [type, setType] = useState('all');
  const [acknowledged, setAcknowledged] = useState('all');
  const filtered = alerts
    .filter((alert) => severity === 'all' || alert.severity === severity)
    .filter((alert) => type === 'all' || alert.type === type)
    .filter((alert) => acknowledged === 'all' || String(Boolean(alert.acknowledged)) === acknowledged);

  return (
    <>
      <PageHeader eyebrow="Threat signals" title="Security alerts" description="Review deterministic signals generated from simulated application behavior." />
      <div className="security-summary">
        <div><span>Rule coverage</span><strong>5</strong><small>R1–R5</small></div>
        <p>Alerts are produced by the backend security engine. This page never fabricates sample findings.</p>
      </div>
      <Panel title="Alert register" eyebrow={`${filtered.length} alerts`}>
        {errors.alerts ? <ErrorBlock error={errors.alerts} endpoint="Security alerts" /> : (
          <>
            <div className="filter-toolbar compact">
              <SelectField label="Severity" value={severity} onChange={setSeverity} options={[
                { value: 'all', label: 'All severities' },
                ...Object.values(ALERT_SEVERITY).map((value) => ({ value, label: humanize(value) })),
              ]} />
              <SelectField label="Alert type" value={type} onChange={setType} options={[
                { value: 'all', label: 'All alert types' },
                ...Object.entries(ALERT_LABELS).map(([value, label]) => ({ value, label })),
              ]} />
              <SelectField label="Acknowledgement" value={acknowledged} onChange={setAcknowledged} options={[
                { value: 'all', label: 'Any status' },
                { value: 'false', label: 'Needs review' },
                { value: 'true', label: 'Acknowledged' },
              ]} />
            </div>
            {filtered.length ? (
              <div className="alert-list">
                <AlertRows
                  alerts={filtered}
                  apps={apps}
                  events={events}
                  onAcknowledge={onAcknowledge}
                  onView={onViewAlert}
                  busyId={busyAction.replace('ack-', '')}
                />
              </div>
            ) : <EmptyState title="No alerts to show">Security alerts will appear here when the backend alert route is available.</EmptyState>}
          </>
        )}
      </Panel>
    </>
  );
}

function TrustPage({ apps, selectedAppId, setSelectedAppId, selectedApp, trustData, trustError, events }) {
  const score = selectedApp?.trustScore;
  const level = selectedApp?.trustLevel;
  const historyData = trustData?.history || [];
  const maxScore = Math.max(100, ...historyData.map((item) => item.newScore || 0));

  return (
    <>
      <PageHeader eyebrow="Continuous evaluation" title="Trust analysis" description="Understand backend-calculated application trust and the recorded reasons behind changes." />
      <div className="trust-controls">
        <SelectField label="Application" value={selectedAppId} onChange={setSelectedAppId} options={apps.map((app) => ({ value: app.id, label: app.name }))} />
        {selectedApp && <StatusBadge tone={`trust-${level || 'unknown'}`}>{levelLabel(level)} trust</StatusBadge>}
      </div>
      {selectedApp ? (
        <div className="trust-analysis-grid">
          <Panel title="Current trust score" eyebrow={selectedApp.name} className="trust-score-panel">
            <div className="trust-score-content">
              <TrustRing score={score} level={level} />
              <div>
                <StatusBadge tone={`trust-${level || 'unknown'}`}>{levelLabel(level)}</StatusBadge>
                <p>The value shown is supplied by the backend. Trust thresholds: High 80–100, Moderate 60–79, Low 40–59, Critical 0–39.</p>
              </div>
            </div>
          </Panel>
          <Panel title="Score history" eyebrow="Backend record">
            {trustError ? <ErrorBlock error={trustError} endpoint="Trust score history" /> : trustData ? (
              historyData.length ? (
                <div className="score-history-list">
                  {historyData.map((item) => (
                    <article key={item.id} className="score-history-row">
                      <span className="score-history-change">{item.previousScore} <i>→</i> {item.newScore}</span>
                      <div><strong>{item.changeReason}</strong><time>{formatDate(item.timestamp)}</time></div>
                    </article>
                  ))}
                </div>
              ) : <EmptyState title="No score history">The backend returned no trust adjustments for this application.</EmptyState>
            ) : <LoadingState label="Loading backend score history" />}
          </Panel>
          <Panel title="Adjustment insights" eyebrow="No client-side scoring">
            {trustError ? <ErrorBlock error={trustError} endpoint="Trust score detail" /> : trustData ? (
              <ul className="explanation-list">
                {(trustData.explanation || []).map((line, index) => <li key={`${index}-${line}`}>{line}</li>)}
              </ul>
            ) : <p className="panel-note">Detailed trust history requires the security score endpoint. The {events.length} access records are not used to recalculate scores in the browser.</p>}
          </Panel>
          <Panel title="Score movement" eyebrow="Recorded changes">
            {trustError ? <ErrorBlock error={trustError} endpoint="Trust score history" /> : (
              historyData.length
                ? <ScoreChart records={historyData} maxScore={maxScore} />
                : <EmptyState title="No score movement">A trend chart will appear when the backend returns score history.</EmptyState>
            )}
          </Panel>
        </div>
      ) : <EmptyState title="No applications available">Connect to the backend to review trust scores.</EmptyState>}
    </>
  );
}

function ScoreChart({ records, maxScore }) {
  const points = records.slice().reverse();
  return (
    <div className="score-change-chart">
      {points.map((item) => (
        <div className="score-change-column" key={item.id}>
          <div className="score-change-track">
            <i style={{ height: `${Math.min(100, Math.max(0, (item.newScore / maxScore) * 100))}%` }} />
          </div>
          <span>{item.newScore}</span>
          <small>{new Date(item.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</small>
        </div>
      ))}
    </div>
  );
}

function RecommendationsPage({ apps, recommendations, errors, onApplyRecommendation, busyAction }) {
  const [status, setStatus] = useState('all');
  const filtered = recommendations.filter((item) => status === 'all' || item.status === status);
  return (
    <>
      <PageHeader eyebrow="Guided response" title="Recommendations" description="Review suggestions generated by the backend from security findings." />
      <Panel title="Recommendation queue" eyebrow={`${filtered.length} recommendations`} action={(
        <SelectField label="Status" value={status} onChange={setStatus} options={[
          { value: 'all', label: 'All statuses' },
          { value: RECOMMENDATION_STATUS.PENDING, label: 'Pending' },
          { value: RECOMMENDATION_STATUS.APPLIED, label: 'Applied' },
          { value: RECOMMENDATION_STATUS.DISMISSED, label: 'Dismissed' },
        ]} />
      )}>
        {errors.recommendations ? <ErrorBlock error={errors.recommendations} endpoint="Recommendations" /> : filtered.length ? (
          <div className="recommendation-grid">
            {filtered.map((item) => (
              <article className="recommendation-card" key={item.id}>
                <div className="recommendation-card-head">
                  <span className="recommendation-mark"><Icon>↗</Icon></span>
                  <StatusBadge tone={item.status === RECOMMENDATION_STATUS.PENDING ? 'warning' : 'muted'}>{humanize(item.status)}</StatusBadge>
                </div>
                <span className="eyebrow">{humanize(item.type)}</span>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
                <dl>
                  <div><dt>Application</dt><dd>{appName(apps, item.appId)}</dd></div>
                  <div><dt>Resource</dt><dd>{RESOURCE_LABELS[item.resource] || item.resource || 'Application-wide'}</dd></div>
                  <div><dt>Related alert</dt><dd>{item.alertId || 'Not linked'}</dd></div>
                </dl>
                <div className="recommendation-footer">
                  <span>{humanize(item.suggestedAction || 'review')}</span>
                  {item.status === RECOMMENDATION_STATUS.PENDING && (
                    <Button variant="primary" disabled={Boolean(busyAction)} onClick={() => onApplyRecommendation(item)}>Apply</Button>
                  )}
                </div>
              </article>
            ))}
          </div>
        ) : <EmptyState title="No recommendations available">Recommendations appear here when generated and returned by the backend.</EmptyState>}
      </Panel>
      <p className="data-note">Applying a recommendation can change permissions or suspend an application. Every action is confirmed and executed by the backend.</p>
    </>
  );
}

function HistoryPage({ apps, history, errors }) {
  const [appId, setAppId] = useState('all');
  const [type, setType] = useState('all');
  const [limit, setLimit] = useState('100');
  const filtered = history
    .filter((item) => appId === 'all' || item.appId === appId)
    .filter((item) => type === 'all' || item.eventType === type)
    .slice(0, Number(limit));
  return (
    <>
      <PageHeader eyebrow="Audit trail" title="Activity history" description="A chronological record of access, permission, trust and response activity." />
      <Panel title="Activity log" eyebrow={`${filtered.length} records`}>
        {errors.history ? <ErrorBlock error={errors.history} endpoint="Activity history" /> : (
          <>
            <div className="filter-toolbar compact">
              <SelectField label="Application" value={appId} onChange={setAppId} options={[
                { value: 'all', label: 'All applications' },
                ...apps.map((app) => ({ value: app.id, label: app.name })),
              ]} />
              <SelectField label="Activity type" value={type} onChange={setType} options={[
                { value: 'all', label: 'All activity' },
                ...Object.values(ACTIVITY_EVENT_TYPES).map((item) => ({ value: item, label: EVENT_LABELS[item] })),
              ]} />
              <SelectField label="Records" value={limit} onChange={setLimit} options={[
                { value: '25', label: 'Last 25' },
                { value: '50', label: 'Last 50' },
                { value: '100', label: 'Last 100' },
                { value: '200', label: 'Last 200' },
              ]} />
            </div>
            {filtered.length ? (
              <div className="table-scroll">
                <table>
                  <thead><tr><th>Activity</th><th>Application</th><th>Description</th><th>Timestamp</th><th>Details</th></tr></thead>
                  <tbody>
                    {filtered.map((item) => (
                      <tr key={item.id}>
                        <td><StatusBadge tone={activityTone(item.eventType)}>{EVENT_LABELS[item.eventType] || humanize(item.eventType)}</StatusBadge></td>
                        <td>{appName(apps, item.appId)}</td>
                        <td>{item.description}</td>
                        <td>{formatDate(item.timestamp)}</td>
                        <td className="metadata-cell">{metadataLabel(item.metadata)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <EmptyState title="No history records">History will appear after the backend history route is connected.</EmptyState>}
          </>
        )}
      </Panel>
    </>
  );
}

function metadataLabel(metadata) {
  if (!metadata || !Object.keys(metadata).length) return '—';
  return Object.entries(metadata)
    .map(([key, value]) => `${humanize(key)}: ${typeof value === 'object' ? JSON.stringify(value) : value}`)
    .join(' · ');
}

function ConfirmationModal({ modal, busy, detailApp, detailError, apps, events, alerts, history, onCancel }) {
  useEffect(() => {
    function onKeyDown(event) {
      if (event.key === 'Escape' && !busy) onCancel();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [busy, onCancel]);

  if (modal.type === 'alert-detail') {
    const alert = modal.alert;
    const relatedEvents = events.filter((event) => alert.relatedEventIds?.includes(event.id));
    return (
      <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel(); }}>
        <section className="modal detail-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
          <div className="modal-heading">
            <div><span className="eyebrow">Security finding · {alert.id}</span><h2 id="modal-title">{modal.title}</h2></div>
            <button type="button" className="icon-button" aria-label="Close alert details" onClick={onCancel}>×</button>
          </div>
          <div className="alert-detail-summary">
            <StatusBadge tone={alert.severity}>{humanize(alert.severity)}</StatusBadge>
            <StatusBadge tone={alert.acknowledged ? 'muted' : 'warning'}>{alert.acknowledged ? 'Acknowledged' : 'Needs review'}</StatusBadge>
            <span>{appName(apps, alert.appId)}</span>
            <time>{formatDate(alert.timestamp)}</time>
          </div>
          <p className="alert-detail-message">{alert.message}</p>
          <div className="alert-detail-events">
            <h3>Related access events</h3>
            {relatedEvents.length ? relatedEvents.map((event) => (
              <div className="detail-line" key={event.id}>
                <strong>{event.id} · {RESOURCE_LABELS[event.resource] || event.resource} · {humanize(event.status)}</strong>
                <span>{formatDate(event.timestamp)}</span>
              </div>
            )) : (alert.relatedEventIds || []).map((eventId) => (
              <div className="detail-line" key={eventId}><strong>{eventId}</strong><span>Event not in current result set</span></div>
            ))}
          </div>
          <div className="modal-actions">
            {!alert.acknowledged && <Button variant="primary" onClick={() => modal.onAcknowledge(alert)}>Acknowledge</Button>}
            <Button onClick={onCancel}>Close</Button>
          </div>
        </section>
      </div>
    );
  }

  if (modal.type === 'detail') {
    const relatedEvents = events.filter((event) => event.appId === detailApp?.id).slice(0, 6);
    const relatedAlerts = alerts.filter((alert) => alert.appId === detailApp?.id).slice(0, 5);
    const relatedHistory = history.filter((item) => item.appId === detailApp?.id).slice(0, 5);
    return (
      <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel(); }}>
        <section className="modal detail-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
          <div className="modal-heading">
            <div><span className="eyebrow">Application detail</span><h2 id="modal-title">{modal.title}</h2></div>
            <button type="button" className="icon-button" aria-label="Close details" onClick={onCancel}>×</button>
          </div>
          {detailError ? <ApiUnavailable error={detailError} endpoint="Application detail" /> : !detailApp ? <LoadingState label="Loading application details" /> : (
            <>
              <div className="detail-overview">
                <AppMark name={detailApp.name} />
                <div><p>{detailApp.description}</p><StatusBadge tone={detailApp.status === APPLICATION_STATUS.ACTIVE ? 'success' : 'muted'}>{humanize(detailApp.status)}</StatusBadge></div>
                <TrustRing score={detailApp.trustScore} level={detailApp.trustLevel} size="small" />
              </div>
              <div className="detail-columns">
                <section><h3>Permissions</h3><div className="detail-permissions">{RESOURCE_TYPES.map((resource) => (
                  <div key={resource}><span>{RESOURCE_LABELS[resource]}</span><StatusBadge tone={detailApp.permissions?.[resource]?.enabled ? 'success' : 'muted'}>{detailApp.permissions?.[resource]?.enabled ? 'Enabled' : 'Disabled'}</StatusBadge></div>
                ))}</div></section>
                <section><h3>Recent access</h3>{relatedEvents.length ? relatedEvents.map((event) => (
                  <div className="detail-line" key={event.id}><strong>{RESOURCE_LABELS[event.resource] || event.resource} · {humanize(event.status)}</strong><span>{formatDate(event.timestamp)}</span></div>
                )) : <p className="muted-text">No access events returned for this application.</p>}</section>
                <section><h3>Related security alerts</h3>{relatedAlerts.length ? relatedAlerts.map((alert) => (
                  <div className="detail-line" key={alert.id}><strong>{ALERT_LABELS[alert.type] || humanize(alert.type)} · {humanize(alert.severity)}</strong><span>{formatDate(alert.timestamp)}</span></div>
                )) : <p className="muted-text">No security alerts returned for this application.</p>}</section>
                <section><h3>Trust and activity history</h3>{relatedHistory.length ? relatedHistory.map((item) => (
                  <div className="detail-line" key={item.id}><strong>{item.description}</strong><span>{formatDate(item.timestamp)}</span></div>
                )) : <p className="muted-text">Activity history not available for this application.</p>}</section>
              </div>
            </>
          )}
          <div className="modal-actions"><Button onClick={onCancel}>Close</Button></div>
        </section>
      </div>
    );
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onCancel(); }}>
      <section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div className={`modal-icon ${modal.danger ? 'modal-icon-danger' : ''}`} aria-hidden="true">{modal.danger ? '!' : '↗'}</div>
        <h2 id="modal-title">{modal.title}</h2>
        <p>{modal.description}</p>
        <div className="modal-actions">
          <Button onClick={onCancel} disabled={busy}>Cancel</Button>
          <Button variant={modal.danger ? 'danger' : 'primary'} onClick={modal.onConfirm} disabled={busy}>
            {busy ? 'Working…' : modal.confirmLabel}
          </Button>
        </div>
      </section>
    </div>
  );
}

export default App;
