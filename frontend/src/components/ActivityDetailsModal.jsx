import React, { useEffect } from 'react';
import { X, Clock, Layers, FileCode, CheckCircle, Info } from 'lucide-react';
import EventBadge from './EventBadge';

export function ActivityDetailsModal({ activity, appName, onClose }) {
  if (!activity) return null;

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const formattedDate = new Date(activity.timestamp).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'short',
  });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="modal-header">
          <div className="modal-title">
            <EventBadge eventType={activity.eventType} />
            <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
              #{activity.id}
            </span>
          </div>
          <button className="btn btn-outline btn-xs" onClick={onClose} aria-label="Close modal">
            <X size={16} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="modal-body">
          {/* Description */}
          <div className="modal-row">
            <div className="modal-row-label">Description</div>
            <div className="modal-row-value" style={{ fontWeight: 600 }}>
              {activity.description}
            </div>
          </div>

          {/* Application */}
          <div className="modal-row">
            <div className="modal-row-label">Target Application</div>
            <div className="modal-row-value" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Layers size={15} color="var(--accent-blue)" />
              <span>{appName || activity.appId}</span>
              <span className="app-id-pill">{activity.appId}</span>
            </div>
          </div>

          {/* Timestamp */}
          <div className="modal-row">
            <div className="modal-row-label">Timestamp</div>
            <div className="modal-row-value" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Clock size={15} color="var(--text-muted)" />
              <span className="timestamp-text">{formattedDate}</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>({activity.timestamp})</span>
            </div>
          </div>

          {/* Metadata Section */}
          <div className="modal-row">
            <div className="modal-row-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <FileCode size={14} />
              <span>Event Metadata</span>
            </div>
            {activity.metadata && Object.keys(activity.metadata).length > 0 ? (
              <div className="code-block">
                {JSON.stringify(activity.metadata, null, 2)}
              </div>
            ) : (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
                No additional metadata recorded for this action.
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default ActivityDetailsModal;
