export default function Footer({ navigate }) {
  return (
    <footer className="page-footer-container">
      <div className="footer-grid">
        <div className="footer-brand">
          <span className="footer-badge">Security Intelligence &amp; Governance</span>
          <strong>E.D.I.T.H.</strong>
          <p>Enhanced Digital Identity, Trust &amp; Heuristics. Autonomous heuristic trust scoring, centralized permission governance, and behavioral security intelligence.</p>
          <p style={{ marginTop: '4px', fontSize: '11px', color: 'var(--charcoal-500)' }}>Deterministic permission management and simulated runtime heuristic security telemetry.</p>
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
            <li><button type="button" onClick={() => navigate('findings')}>Security Findings</button></li>
            <li><button type="button" onClick={() => navigate('policies')}>Policy Management</button></li>
            <li><button type="button" onClick={() => navigate('history')}>Activity History</button></li>
          </ul>
        </div>
        <div className="footer-col">
          <h4>Platform Telemetry</h4>
          <ul>
            <li><button type="button" onClick={() => navigate('posture')}>System Overview</button></li>
            <li><button type="button" onClick={() => navigate('findings')}>Security Findings</button></li>
            <li><button type="button" onClick={() => navigate('monitoring')}>Access Stream</button></li>
            <li><button type="button" onClick={() => navigate('trust')}>Trust Computation</button></li>
          </ul>
        </div>
      </div>
      <div className="footer-bottom">
        <span>© 2026 E.D.I.T.H. — Enhanced Digital Identity, Trust &amp; Heuristics. All rights reserved.</span>
        <span>Simulated Security &amp; Heuristic Access Control</span>
      </div>
    </footer>
  );
}
