import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  History,
  Activity,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  RefreshCw,
  Filter,
  Eye,
  AlertCircle,
  Inbox,
  Play,
  RotateCcw,
} from 'lucide-react';
import { ACTIVITY_EVENT_TYPES } from '@shared/contracts.js';
import api from '../services/api';
import EventBadge, { EVENT_TYPE_CONFIG } from '../components/EventBadge';
import ActivityDetailsModal from '../components/ActivityDetailsModal';

export function ActivityHistoryPage() {
  // State
  const [activities, setActivities] = useState([]);
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedActivity, setSelectedActivity] = useState(null);

  // Filters state
  const [selectedApp, setSelectedApp] = useState('');
  const [selectedEventType, setSelectedEventType] = useState('');
  const [selectedLimit, setSelectedLimit] = useState(100);

  // Quick Action feedback
  const [actionMessage, setActionMessage] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Fetch apps for filter dropdown and app name mapping
  const fetchApps = useCallback(async () => {
    try {
      const res = await api.getApps();
      if (res.success && res.data) {
        setApps(res.data);
      }
    } catch (e) {
      console.error('Failed to fetch apps:', e);
    }
  }, []);

  // Fetch activity history from backend API
  const fetchActivities = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getHistory({
        appId: selectedApp || undefined,
        eventType: selectedEventType || undefined,
        limit: selectedLimit,
      });

      if (res.success) {
        setActivities(res.data || []);
      } else {
        setError(res.error?.message || 'Failed to fetch activity history');
      }
    } catch (err) {
      setError(err.message || 'Network error while fetching activities');
    } finally {
      setLoading(false);
    }
  }, [selectedApp, selectedEventType, selectedLimit]);

  // Initial load
  useEffect(() => {
    fetchApps();
  }, [fetchApps]);

  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  // App map for fast lookup: appId -> name
  const appMap = useMemo(() => {
    const map = {};
    for (const app of apps) {
      map[app.id] = app.name;
    }
    return map;
  }, [apps]);

  // Summary Metrics calculation (from the full current history set or API summary)
  const summaryMetrics = useMemo(() => {
    const total = activities.length;
    const allowed = activities.filter(
      (a) => a.eventType === ACTIVITY_EVENT_TYPES.ACCESS_ALLOWED
    ).length;
    const denied = activities.filter(
      (a) => a.eventType === ACTIVITY_EVENT_TYPES.ACCESS_DENIED
    ).length;
    const alerts = activities.filter(
      (a) => a.eventType === ACTIVITY_EVENT_TYPES.ALERT_CREATED
    ).length;

    return { total, allowed, denied, alerts };
  }, [activities]);

  // Reset filters
  const handleResetFilters = () => {
    setSelectedApp('');
    setSelectedEventType('');
    setSelectedLimit(100);
  };

  // Helper actions to quickly demonstrate and test feature
  const triggerQuickSimulateAllowed = async () => {
    setActionLoading(true);
    setActionMessage(null);
    try {
      const res = await api.simulateEvents({
        appId: 'app_01',
        resource: 'location',
        reason: 'Live test: Route check',
        count: 1,
      });
      if (res.success) {
        setActionMessage('Simulated allowed access request for FitTrack!');
        await fetchActivities();
      }
    } catch (err) {
      setActionMessage(`Simulation error: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const triggerQuickSimulateDenied = async () => {
    setActionLoading(true);
    setActionMessage(null);
    try {
      const res = await api.simulateEvents({
        appId: 'app_01',
        resource: 'contacts',
        reason: 'Live test: Unauthorized contact sync',
        count: 1,
      });
      if (res.success) {
        setActionMessage('Simulated denied access request (contacts disabled)!');
        await fetchActivities();
      }
    } catch (err) {
      setActionMessage(`Simulation error: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const triggerResetState = async () => {
    if (!window.confirm('Reset environment to initial seed?')) return;
    setActionLoading(true);
    try {
      await api.resetDemo();
      setActionMessage('State reset to initial seed data.');
      await fetchApps();
      await fetchActivities();
    } catch (err) {
      setActionMessage(`Reset error: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const formatTimestamp = (isoString) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 className="page-title">
              <History size={26} color="var(--accent-blue)" />
              Activity History
            </h1>
            <p className="page-subtitle">
              Chronological security audit trail of all runtime access events, alerts, and governance actions.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              className="btn btn-outline"
              onClick={fetchActivities}
              disabled={loading}
              title="Refresh Activity Log"
            >
              <RefreshCw size={14} className={loading ? 'spinner' : ''} />
              <span>Refresh</span>
            </button>
            <button
              className="btn btn-outline"
              onClick={triggerResetState}
              disabled={actionLoading}
              title="Reset to Seed Data"
            >
              <RotateCcw size={14} />
              <span>Reset Seed</span>
            </button>
          </div>
        </div>
      </div>

      {/* Interactive Quick Simulation Bar */}
      <div className="action-banner">
        <div className="action-banner-text">
          <div className="action-banner-title">Interactive Audit Verification Bar</div>
          <div className="action-banner-desc">
            Trigger simulated actions to watch activities and summary metrics update automatically in real-time.
          </div>
        </div>
        <div className="action-banner-btns">
          <button
            className="btn btn-secondary btn-xs"
            onClick={triggerQuickSimulateAllowed}
            disabled={actionLoading}
          >
            <Play size={12} color="var(--accent-emerald)" />
            <span>Simulate Allowed</span>
          </button>
          <button
            className="btn btn-secondary btn-xs"
            onClick={triggerQuickSimulateDenied}
            disabled={actionLoading}
          >
            <Play size={12} color="var(--accent-rose)" />
            <span>Simulate Denied</span>
          </button>
        </div>
      </div>

      {actionMessage && (
        <div style={{
          padding: '0.625rem 1rem',
          marginBottom: '1rem',
          borderRadius: 'var(--radius-sm)',
          background: 'rgba(56, 189, 248, 0.1)',
          border: '1px solid rgba(56, 189, 248, 0.25)',
          color: '#38bdf8',
          fontSize: '0.8125rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <span>{actionMessage}</span>
          <button
            onClick={() => setActionMessage(null)}
            style={{ background: 'transparent', border: 'none', color: '#38bdf8', cursor: 'pointer' }}
          >
            &times;
          </button>
        </div>
      )}

      {/* 1. Summary Cards */}
      <div className="summary-grid">
        {/* Total Activities */}
        <div className="summary-card">
          <div className="summary-icon-box" style={{ background: 'rgba(56, 189, 248, 0.12)', color: 'var(--accent-blue)' }}>
            <Activity size={22} />
          </div>
          <div className="summary-content">
            <span className="summary-label">Total Activities</span>
            <span className="summary-value">{summaryMetrics.total}</span>
          </div>
        </div>

        {/* Allowed Requests */}
        <div className="summary-card">
          <div className="summary-icon-box" style={{ background: 'rgba(16, 185, 129, 0.12)', color: 'var(--accent-emerald)' }}>
            <ShieldCheck size={22} />
          </div>
          <div className="summary-content">
            <span className="summary-label">Allowed Requests</span>
            <span className="summary-value" style={{ color: '#34d399' }}>{summaryMetrics.allowed}</span>
          </div>
        </div>

        {/* Denied Requests */}
        <div className="summary-card">
          <div className="summary-icon-box" style={{ background: 'rgba(244, 63, 94, 0.12)', color: 'var(--accent-rose)' }}>
            <ShieldAlert size={22} />
          </div>
          <div className="summary-content">
            <span className="summary-label">Denied Requests</span>
            <span className="summary-value" style={{ color: '#fb7185' }}>{summaryMetrics.denied}</span>
          </div>
        </div>

        {/* Security Alerts */}
        <div className="summary-card">
          <div className="summary-icon-box" style={{ background: 'rgba(245, 158, 11, 0.12)', color: 'var(--accent-amber)' }}>
            <AlertTriangle size={22} />
          </div>
          <div className="summary-content">
            <span className="summary-label">Security Alerts</span>
            <span className="summary-value" style={{ color: '#fbbf24' }}>{summaryMetrics.alerts}</span>
          </div>
        </div>
      </div>

      {/* 2. Main Activities Container */}
      <div className="card">
        {/* Header & Filter Bar */}
        <div className="filters-bar">
          {/* Filter by Application */}
          <div className="filter-group">
            <span className="filter-label">Application:</span>
            <select
              className="select-input"
              value={selectedApp}
              onChange={(e) => setSelectedApp(e.target.value)}
              aria-label="Filter by Application"
            >
              <option value="">All Applications</option>
              {apps.map((app) => (
                <option key={app.id} value={app.id}>
                  {app.name} ({app.id})
                </option>
              ))}
            </select>
          </div>

          {/* Filter by Event Type */}
          <div className="filter-group">
            <span className="filter-label">Event Type:</span>
            <select
              className="select-input"
              value={selectedEventType}
              onChange={(e) => setSelectedEventType(e.target.value)}
              aria-label="Filter by Event Type"
            >
              <option value="">All Event Types</option>
              {Object.entries(EVENT_TYPE_CONFIG).map(([typeKey, config]) => (
                <option key={typeKey} value={typeKey}>
                  {config.label}
                </option>
              ))}
            </select>
          </div>

          {/* Record Limit Selector */}
          <div className="filter-group">
            <span className="filter-label">Limit:</span>
            <select
              className="select-input"
              value={selectedLimit}
              onChange={(e) => setSelectedLimit(Number(e.target.value))}
              aria-label="Record Limit Selector"
            >
              <option value={10}>10 records</option>
              <option value={25}>25 records</option>
              <option value={50}>50 records</option>
              <option value={100}>100 records</option>
              <option value={200}>200 records</option>
            </select>
          </div>

          {/* Clear Filters Button if any active */}
          {(selectedApp || selectedEventType || selectedLimit !== 100) && (
            <button
              className="btn btn-outline btn-xs"
              onClick={handleResetFilters}
              style={{ marginLeft: 'auto' }}
            >
              <Filter size={12} />
              <span>Reset Filters</span>
            </button>
          )}
        </div>

        {/* Content Area: Loading / Error / Empty / Table */}
        {loading ? (
          <div className="state-container">
            <div className="spinner"></div>
            <div className="state-title">Loading Activity History...</div>
            <div className="state-desc">Fetching chronological audit trail from backend.</div>
          </div>
        ) : error ? (
          <div className="state-container">
            <AlertCircle className="state-icon" style={{ color: 'var(--accent-rose)' }} />
            <div className="state-title">Failed to Load Activities</div>
            <div className="state-desc">{error}</div>
            <button className="btn btn-secondary" onClick={fetchActivities} style={{ marginTop: '0.75rem' }}>
              <RefreshCw size={14} />
              <span>Retry</span>
            </button>
          </div>
        ) : activities.length === 0 ? (
          <div className="state-container">
            <Inbox className="state-icon" />
            <div className="state-title">No Activities Found</div>
            <div className="state-desc">
              {selectedApp || selectedEventType
                ? 'No activities match the selected filter criteria. Try adjusting your filters.'
                : 'No activity history records exist in the system.'}
            </div>
            {(selectedApp || selectedEventType) && (
              <button className="btn btn-outline" onClick={handleResetFilters} style={{ marginTop: '0.5rem' }}>
                Reset Filters
              </button>
            )}
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Application</th>
                  <th>Event Type</th>
                  <th>Description</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {activities.map((item) => {
                  const appName = appMap[item.appId] || item.appId;
                  return (
                    <tr
                      key={item.id}
                      onClick={() => setSelectedActivity(item)}
                      style={{ cursor: 'pointer' }}
                    >
                      {/* Timestamp */}
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <span className="timestamp-text" title={item.timestamp}>
                          {formatTimestamp(item.timestamp)}
                        </span>
                      </td>

                      {/* Application Name & ID */}
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <div className="app-tag">
                          <span>{appName}</span>
                          <span className="app-id-pill">{item.appId}</span>
                        </div>
                      </td>

                      {/* Event Type Badge */}
                      <td>
                        <EventBadge eventType={item.eventType} />
                      </td>

                      {/* Description */}
                      <td>
                        <span style={{ fontWeight: 500 }}>{item.description}</span>
                      </td>

                      {/* Action */}
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <button
                          className="btn btn-outline btn-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedActivity(item);
                          }}
                        >
                          <Eye size={12} />
                          <span>Details</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 3. Details Modal */}
      {selectedActivity && (
        <ActivityDetailsModal
          activity={selectedActivity}
          appName={appMap[selectedActivity.appId]}
          onClose={() => setSelectedActivity(null)}
        />
      )}
    </div>
  );
}

export default ActivityHistoryPage;
