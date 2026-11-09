import React, { useState, useEffect } from 'react';
import { Layers, Shield, KeyRound, Ban, CheckCircle, RefreshCw } from 'lucide-react';
import { RESOURCE_TYPES, APPLICATION_STATUS } from '@shared/contracts.js';
import api from '../services/api';

export function ApplicationsView({ onActivityOccurred }) {
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [statusMsg, setStatusMsg] = useState(null);

  const fetchApps = async () => {
    setLoading(true);
    try {
      const res = await api.getApps();
      if (res.success) {
        setApps(res.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApps();
  }, []);

  const handleTogglePermission = async (appId, resource, currentEnabled) => {
    setUpdating(true);
    setStatusMsg(null);
    try {
      const res = await api.updatePermission(appId, resource, !currentEnabled);
      if (res.success) {
        setStatusMsg(`${resource} set to ${!currentEnabled ? 'GRANTED' : 'REVOKED'} for ${appId}`);
        await fetchApps();
        if (onActivityOccurred) onActivityOccurred();
      }
    } catch (e) {
      setStatusMsg(`Error: ${e.message}`);
    } finally {
      setUpdating(false);
    }
  };

  const handleToggleAppStatus = async (appId, currentStatus) => {
    setUpdating(true);
    setStatusMsg(null);
    const newStatus = currentStatus === APPLICATION_STATUS.ACTIVE ? APPLICATION_STATUS.SUSPENDED : APPLICATION_STATUS.ACTIVE;
    try {
      const res = await api.updateAppStatus(appId, newStatus);
      if (res.success) {
        setStatusMsg(`App ${appId} status changed to ${newStatus.toUpperCase()}`);
        await fetchApps();
        if (onActivityOccurred) onActivityOccurred();
      }
    } catch (e) {
      setStatusMsg(`Error: ${e.message}`);
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="state-container">
        <div className="spinner"></div>
        <div className="state-title">Loading Applications...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 className="page-title">
              <Layers size={24} color="var(--accent-blue)" />
              Applications & Permissions Governance
            </h1>
            <p className="page-subtitle">
              Manage application permissions and suspension state. Changes will automatically create audit history records.
            </p>
          </div>
          <button className="btn btn-outline" onClick={fetchApps} disabled={updating}>
            <RefreshCw size={14} className={updating ? 'spinner' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {statusMsg && (
        <div style={{
          padding: '0.625rem 1rem',
          marginBottom: '1rem',
          borderRadius: 'var(--radius-sm)',
          background: 'rgba(56, 189, 248, 0.1)',
          border: '1px solid rgba(56, 189, 248, 0.25)',
          color: '#38bdf8',
          fontSize: '0.8125rem',
        }}>
          {statusMsg}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1rem' }}>
        {apps.map((app) => (
          <div key={app.id} className="card" style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>{app.name}</h3>
                  <span className="app-id-pill">{app.id}</span>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                  {app.description}
                </div>
              </div>
              <span className={`event-badge ${app.status === 'active' ? 'badge-allowed' : 'badge-suspended'}`}>
                {app.status.toUpperCase()}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0.75rem', background: 'var(--bg-primary)', borderRadius: 'var(--radius-sm)', marginBottom: '1rem' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Trust Score</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: app.trustScore >= 80 ? '#34d399' : app.trustScore >= 60 ? '#fbbf24' : '#fb7185' }}>
                {app.trustScore} / 100 ({app.trustLevel})
              </span>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
                Resource Permissions
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {RESOURCE_TYPES.map((res) => {
                  const perm = app.permissions?.[res];
                  const isEnabled = perm?.enabled;
                  return (
                    <div
                      key={res}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.35rem 0.6rem',
                        background: 'rgba(255, 255, 255, 0.02)',
                        borderRadius: '4px',
                        fontSize: '0.8125rem',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <KeyRound size={13} color={isEnabled ? 'var(--accent-blue)' : 'var(--text-muted)'} />
                        <span style={{ textTransform: 'capitalize' }}>{res}</span>
                      </div>
                      <button
                        className={`btn btn-xs ${isEnabled ? 'btn-danger' : 'btn-primary'}`}
                        disabled={updating}
                        onClick={() => handleTogglePermission(app.id, res, isEnabled)}
                      >
                        {isEnabled ? 'Revoke' : 'Grant'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '0.75rem', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                className={`btn btn-xs ${app.status === 'active' ? 'btn-danger' : 'btn-secondary'}`}
                disabled={updating}
                onClick={() => handleToggleAppStatus(app.id, app.status)}
              >
                {app.status === 'active' ? (
                  <>
                    <Ban size={12} />
                    <span>Suspend App</span>
                  </>
                ) : (
                  <>
                    <CheckCircle size={12} />
                    <span>Reactivate App</span>
                  </>
                )}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default ApplicationsView;
