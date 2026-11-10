import { X } from 'lucide-react';
import { NAV_GROUPS } from './navigation.js';
import { BrandShieldMark, NavIcon } from '../common/AppIcon.jsx';

export default function Sidebar({ page, navigate, open, onToggle, activeAlerts = 0 }) {
  return (
    <>
      {open && (
        <div
          className="sidebar-backdrop"
          aria-hidden="true"
          onClick={onToggle}
        />
      )}
      <aside
        id="primary-navigation"
        className={`sidebar ${open ? 'sidebar-open' : ''}`}
        aria-label="Primary navigation"
      >
        <div className="sidebar-brand-row">
          <a
            className="sidebar-brand"
            href="#overview"
            onClick={(event) => {
              event.preventDefault();
              navigate('overview');
            }}
          >
            <BrandShieldMark className="sidebar-logo-svg" />
            <span className="sidebar-brand-copy">
              <strong>E.D.I.T.H.</strong>
              <small>Identity · Trust · Heuristics</small>
            </span>
          </a>
          <button
            type="button"
            className="sidebar-close-btn"
            aria-label="Close navigation"
            onClick={onToggle}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <nav className="sidebar-nav">
          {NAV_GROUPS.map((group) => (
            <div className="sidebar-group" key={group.id}>
              <span className="sidebar-group-label">{group.label}</span>
              <div className="sidebar-group-items">
                {group.items.map((item) => {
                  const isActive = page === item.id;
                  const showAlertBadge = item.id === 'security' && activeAlerts > 0;
                  return (
                    <button
                      type="button"
                      key={item.id}
                      className={`sidebar-link ${isActive ? 'sidebar-link-active' : ''}`}
                      aria-current={isActive ? 'page' : undefined}
                      onClick={() => navigate(item.id)}
                    >
                      <span className="sidebar-link-icon">
                        <NavIcon id={item.id} size={16} />
                      </span>
                      <span className="sidebar-link-text">{item.label}</span>
                      {showAlertBadge && (
                        <span className="sidebar-count-pill" title={`${activeAlerts} unacknowledged alerts`}>
                          {activeAlerts}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-sim-card">
            <div className="sidebar-sim-status">
              <span className="status-dot-live" aria-hidden="true" />
              <strong>Simulated Security Plane</strong>
            </div>
            <p>
              Deterministic backend telemetry and RASP-inspired inspection. No OS-level or external cloud scanning.
            </p>
          </div>
        </div>
      </aside>
    </>
  );
}
