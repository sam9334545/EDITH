import { useEffect } from 'react';
import { APPLICATION_STATUS, RESOURCE_TYPES } from '@shared/contracts.js';
import AppMark from './AppMark.jsx';
import LoadingState from './LoadingState.jsx';
import StatusBadge from './StatusBadge.jsx';
import TrustRing from './TrustRing.jsx';
import { ALERT_LABELS, RESOURCE_LABELS, Button, ApiUnavailable, appName, formatDate, humanize } from './LegacyControls.jsx';

export function ConfirmationModal({ modal, busy, detailApp, detailError, apps, events, alerts, history, onCancel }) {
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
