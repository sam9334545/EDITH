import React, { useState, useEffect } from 'react';
import { ShieldAlert, Lightbulb, CheckCircle2, RefreshCw } from 'lucide-react';
import api from '../services/api';

export function SecurityView({ onActivityOccurred }) {
  const [alerts, setAlerts] = useState([]);
  const [apps, setApps] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [msg, setMsg] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [alertsRes, appsRes] = await Promise.all([
        api.getAlerts({ limit: 50 }),
        api.getApps(),
      ]);

      if (alertsRes.success) setAlerts(alertsRes.data);
      if (appsRes.success) {
        setApps(appsRes.data);
        // fetch recommendations for all apps
        const recPromises = appsRes.data.map((a) => api.getRecommendations(a.id));
        const recResults = await Promise.all(recPromises);
        const allRecs = [];
        for (const r of recResults) {
          if (r.success && r.data) allRecs.push(...r.data);
        }
        setRecommendations(allRecs);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleApplyRec = async (recId) => {
    setApplying(true);
    setMsg(null);
    try {
      const res = await api.applyRecommendation(recId);
      if (res.success) {
        setMsg(`Recommendation applied! History updated automatically.`);
        await fetchData();
        if (onActivityOccurred) onActivityOccurred();
      }
    } catch (e) {
      setMsg(`Error applying: ${e.message}`);
    } finally {
      setApplying(false);
    }
  };

  if (loading) {
    return (
      <div className="state-container">
        <div className="spinner"></div>
        <div className="state-title">Loading Security Engine Data...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 className="page-title">
              <ShieldAlert size={24} color="var(--accent-amber)" />
              Security Engine & Recommendations
            </h1>
            <p className="page-subtitle">
              Heuristic anomaly alerts and actionable security recommendations.
            </p>
          </div>
          <button className="btn btn-outline" onClick={fetchData} disabled={applying}>
            <RefreshCw size={14} className={applying ? 'spinner' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {msg && (
        <div style={{
          padding: '0.625rem 1rem',
          marginBottom: '1rem',
          borderRadius: 'var(--radius-sm)',
          background: 'rgba(56, 189, 248, 0.1)',
          border: '1px solid rgba(56, 189, 248, 0.25)',
          color: '#38bdf8',
          fontSize: '0.8125rem',
        }}>
          {msg}
        </div>
      )}

      {/* Recommendations Section */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700 }}>
            <Lightbulb size={18} color="var(--accent-amber)" />
            <span>Active Recommendations ({recommendations.filter((r) => r.status === 'pending').length} Pending)</span>
          </div>
        </div>

        {recommendations.length === 0 ? (
          <div className="state-container" style={{ padding: '2rem' }}>
            <div className="state-desc">No recommendations generated yet.</div>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>App</th>
                  <th>Title</th>
                  <th>Suggested Action</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {recommendations.map((rec) => (
                  <tr key={rec.id}>
                    <td>
                      <span className="app-id-pill">{rec.appId}</span>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{rec.title}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{rec.description}</div>
                    </td>
                    <td>
                      <code style={{ fontSize: '0.75rem', color: 'var(--accent-cyan)' }}>{rec.suggestedAction}</code>
                    </td>
                    <td>
                      <span className={`event-badge ${rec.status === 'applied' ? 'badge-allowed' : 'badge-alert'}`}>
                        {rec.status.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {rec.status === 'pending' && (
                        <button
                          className="btn btn-primary btn-xs"
                          disabled={applying}
                          onClick={() => handleApplyRec(rec.id)}
                        >
                          <CheckCircle2 size={12} />
                          <span>Apply</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Security Alerts Section */}
      <div className="card">
        <div className="card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700 }}>
            <ShieldAlert size={18} color="var(--accent-rose)" />
            <span>Security Alerts ({alerts.length})</span>
          </div>
        </div>

        {alerts.length === 0 ? (
          <div className="state-container" style={{ padding: '2rem' }}>
            <div className="state-desc">No active security alerts recorded.</div>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>App</th>
                  <th>Severity</th>
                  <th>Type</th>
                  <th>Message</th>
                </tr>
              </thead>
              <tbody>
                {alerts.map((alt) => (
                  <tr key={alt.id}>
                    <td className="timestamp-text">{new Date(alt.timestamp).toLocaleTimeString()}</td>
                    <td><span className="app-id-pill">{alt.appId}</span></td>
                    <td>
                      <span className={`event-badge ${alt.severity === 'high' ? 'badge-revoked' : 'badge-alert'}`}>
                        {alt.severity.toUpperCase()}
                      </span>
                    </td>
                    <td><code>{alt.type}</code></td>
                    <td>{alt.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default SecurityView;
