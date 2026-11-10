import { useMemo, useState } from 'react';
import { ACTIVITY_EVENT_TYPES, ALERT_TYPES } from '@shared/contracts.js';
import StatusBadge from './StatusBadge.jsx';

export const RESOURCE_LABELS = {
  location: 'Location',
  contacts: 'Contacts',
  camera: 'Camera',
  microphone: 'Microphone',
  files: 'Files',
};

export const EVENT_LABELS = {
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

export const ALERT_LABELS = {
  [ALERT_TYPES.EXCESSIVE_ACCESS]: 'Excessive access',
  [ALERT_TYPES.UNAUTHORIZED_RESOURCE]: 'Unauthorized resource',
  [ALERT_TYPES.SUSPENDED_APP_ACCESS]: 'Suspended application access',
  [ALERT_TYPES.REPEATED_RESTRICTED_ACCESS]: 'Repeated restricted access',
  [ALERT_TYPES.UNUSUAL_RESOURCE_COMBINATION]: 'Unusual resource combination',
};
export function safeDecode(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return '';
  }
}

export function formatDate(value, options = {}) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: options.dateStyle || 'medium',
    timeStyle: options.timeStyle || 'short',
  }).format(date);
}

export function appName(apps, id) {
  return apps.find((app) => app.id === id)?.name || id || 'Unknown application';
}

export function levelLabel(level) {
  if (!level) return 'Not available';
  return level.charAt(0).toUpperCase() + level.slice(1);
}

export function usePagedRows(rows, pageSize = 8) {
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

export function Icon({ children, className = '' }) {
  return <span aria-hidden="true" className={`icon ${className}`}>{children}</span>;
}

export function Button({ children, variant = 'secondary', className = '', ...props }) {
  return (
    <button className={`button button-${variant} ${className}`} {...props}>
      {children}
    </button>
  );
}

export function ApiUnavailable({ error, endpoint }) {
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

export function Pagination({ page, pageCount, onChange, total }) {
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

export function SelectField({ label, value, onChange, options, className = '' }) {
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

export function TextField({ label, value, onChange, ...props }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} {...props} />
    </label>
  );
}

export function activityTone(type) {
  if (type?.includes('denied') || type?.includes('revoked')) return 'danger';
  if (type?.includes('alert')) return 'warning';
  if (type?.includes('allowed') || type?.includes('granted')) return 'success';
  return 'neutral';
}

export function humanize(value = '') {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function ErrorBlock({ error, endpoint }) {
  return (
    <div className="section-feedback">
      {error ? <ApiUnavailable error={error} endpoint={endpoint} /> : null}
    </div>
  );
}

export function AlertRows({ alerts, apps, events, onAcknowledge, onView, busyId }) {
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
