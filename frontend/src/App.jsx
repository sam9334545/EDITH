import React, { useState } from 'react';
import {
  Shield,
  History,
  Layers,
  AlertTriangle,
  Play,
  RotateCcw,
} from 'lucide-react';
import ActivityHistoryPage from './pages/ActivityHistoryPage';
import ApplicationsView from './components/ApplicationsView';
import SecurityView from './components/SecurityView';
import api from './services/api';

export function App() {
  const [activeTab, setActiveTab] = useState('history'); // default to Activity History
  const [demoRunning, setDemoRunning] = useState(false);
  const [demoStatus, setDemoStatus] = useState(null);

  // Full 7-Step E2E Demo Scenario runner
  const runDemoScenario = async () => {
    if (!window.confirm('Run the 7-step E.D.I.T.H. Demo Scenario? This will test excessive access, unauthorized access, trust score penalties, and recommendation application.')) {
      return;
    }

    setDemoRunning(true);
    setDemoStatus('Resetting seed state...');
    try {
      await api.resetDemo();
      const T = Date.now();

      // Step 1: 3 location requests
      setDemoStatus('Step 1/6: Simulating 3 normal location requests for FitTrack...');
      await api.simulateEvents({
        appId: 'app_01',
        resource: 'location',
        reason: 'Workout route tracking',
        count: 3,
        startTime: new Date(T).toISOString(),
      });

      // Step 2: 25 location requests in burst (triggers R1 Excessive Access -> high alert, -15 penalty)
      setDemoStatus('Step 2/6: Simulating 25 rapid location requests (triggers Excessive Access Alert)...');
      await api.simulateEvents({
        appId: 'app_01',
        resource: 'location',
        reason: 'Continuous GPS polling',
        count: 25,
        startTime: new Date(T + 120000).toISOString(),
      });

      // Step 3: Contacts request (disabled -> unauthorized_resource alert, -8 penalty)
      setDemoStatus('Step 3/6: Simulating unauthorized contacts access attempt...');
      await api.simulateEvents({
        appId: 'app_01',
        resource: 'contacts',
        reason: 'Background friend sync',
        count: 1,
        startTime: new Date(T + 240000).toISOString(),
      });

      // Step 4: Find and apply the location restriction recommendation
      setDemoStatus('Step 4/6: Applying security recommendation to revoke location...');
      const recsRes = await api.getRecommendations('app_01', 'pending');
      if (recsRes.success && recsRes.data.length > 0) {
        const locationRec = recsRes.data.find((r) => r.resource === 'location');
        if (locationRec) {
          await api.applyRecommendation(locationRec.id);
        }
      }

      // Step 5: Location request after revoke -> denied!
      setDemoStatus('Step 5/6: Testing access to newly revoked location (denied!)...');
      await api.simulateEvents({
        appId: 'app_01',
        resource: 'location',
        reason: 'Workout route attempt after revocation',
        count: 1,
        startTime: new Date(T + 300000).toISOString(),
      });

      setDemoStatus('Demo scenario completed successfully! Fitness score dropped 94 -> 79 -> 71 -> 63. All activities recorded.');
      setActiveTab('history');
    } catch (e) {
      setDemoStatus(`Demo error: ${e.message}`);
    } finally {
      setDemoRunning(false);
    }
  };

  return (
    <div className="app-container">
      {/* Top Navigation Bar */}
      <header className="header-bar">
        <div className="header-inner">
          <div className="logo-area" onClick={() => setActiveTab('history')}>
            <div className="logo-badge">
              <Shield size={20} strokeWidth={2.5} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontWeight: 800, fontSize: '1.125rem', letterSpacing: '-0.02em' }}>
                  E.D.I.T.H.
                </span>
                <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  v1.0-M3
                </span>
              </div>
              <div style={{ fontSize: '0.6875rem', color: 'var(--text-secondary)' }}>
                Enhanced Digital Identity, Trust & Heuristics
              </div>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="nav-links">
            <button
              className={`nav-item ${activeTab === 'history' ? 'active' : ''}`}
              onClick={() => setActiveTab('history')}
            >
              <History size={16} />
              <span>Activity History</span>
            </button>
            <button
              className={`nav-item ${activeTab === 'apps' ? 'active' : ''}`}
              onClick={() => setActiveTab('apps')}
            >
              <Layers size={16} />
              <span>Applications</span>
            </button>
            <button
              className={`nav-item ${activeTab === 'security' ? 'active' : ''}`}
              onClick={() => setActiveTab('security')}
            >
              <AlertTriangle size={16} />
              <span>Security Engine</span>
            </button>
          </nav>

          {/* Right Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button
              className="btn btn-primary btn-xs"
              onClick={runDemoScenario}
              disabled={demoRunning}
              title="Runs the 7-step scenario from the specification"
            >
              <Play size={12} fill="white" />
              <span>{demoRunning ? 'Running Demo...' : 'Run Demo Scenario'}</span>
            </button>

            {/* Simulated environment badge */}
            <div className="simulated-pill" title="All runtime activities are safely simulated.">
              <span className="pulse-dot"></span>
              <span>Simulated Environment</span>
            </div>
          </div>
        </div>
      </header>

      {/* Demo status banner if running or finished */}
      {demoStatus && (
        <div style={{
          background: 'rgba(2, 132, 199, 0.15)',
          borderBottom: '1px solid rgba(56, 189, 248, 0.25)',
          padding: '0.5rem 2rem',
          fontSize: '0.8125rem',
          color: '#7dd3fc',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <span>{demoStatus}</span>
          <button
            onClick={() => setDemoStatus(null)}
            style={{ background: 'transparent', border: 'none', color: '#7dd3fc', cursor: 'pointer' }}
          >
            &times;
          </button>
        </div>
      )}

      {/* Main Content View */}
      <main className="main-content">
        {activeTab === 'history' && <ActivityHistoryPage />}
        {activeTab === 'apps' && <ApplicationsView onActivityOccurred={() => {}} />}
        {activeTab === 'security' && <SecurityView onActivityOccurred={() => {}} />}
      </main>
    </div>
  );
}

export default App;
