import { Bell, Menu, RefreshCw } from 'lucide-react';
import { NAV_ITEMS } from './navigation.js';

export default function Header({ page, activeAlerts = 0, busy = false, navigate, onToggleNavigation, onRefresh }) {
  const current = NAV_ITEMS.find((item) => item.id === page) || {
    label: page === 'incident' ? 'Incident Forensics' : page === 'application-details' ? 'Application Posture' : 'Overview',
    subtitle: 'Security operations & telemetry',
  };

  return (
    <header className="topbar">
      <div className="topbar-left">
        <button
          type="button"
          className="mobile-menu-button"
          aria-label="Open navigation menu"
          aria-controls="primary-navigation"
          onClick={onToggleNavigation}
        >
          <Menu size={18} aria-hidden="true" />
        </button>
        <div className="topbar-context">
          <span className="topbar-crumb">E.D.I.T.H. Security Console</span>
          <strong className="topbar-title">{current.label}</strong>
        </div>
      </div>

      <div className="topbar-tools">
        <span className="environment-tag" title="Deterministic API-driven simulated security environment">
          <span className="status-dot-live" aria-hidden="true" />
          <span>Simulated Environment</span>
        </span>

        {navigate && (
          <button
            type="button"
            className={`icon-button alert-shortcut-btn ${activeAlerts > 0 ? 'has-alerts' : ''}`}
            aria-label={`Security alerts (${activeAlerts} unacknowledged)`}
            title={`${activeAlerts} unacknowledged security alerts`}
            onClick={() => navigate('security')}
          >
            <Bell size={16} aria-hidden="true" />
            {activeAlerts > 0 && <span className="topbar-badge-count">{activeAlerts}</span>}
          </button>
        )}

        <button
          type="button"
          className={`icon-button refresh-button ${busy ? 'is-spinning' : ''}`}
          aria-label="Refresh telemetry data"
          title="Refresh backend data"
          onClick={onRefresh}
        >
          <RefreshCw size={16} aria-hidden="true" />
        </button>

        <span className="profile-mark" aria-label="Security operator workspace" title="E.D.I.T.H. Security Operator">
          ED
        </span>
      </div>
    </header>
  );
}
