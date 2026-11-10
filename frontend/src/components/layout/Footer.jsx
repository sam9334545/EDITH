import { BrandShieldMark } from '../common/AppIcon.jsx';

export default function Footer({ navigate }) {
  return (
    <footer className="page-footer-container">
      <div className="footer-inner">
        <div className="footer-brand-strip">
          <BrandShieldMark className="footer-logo-svg" />
          <div>
            <strong>E.D.I.T.H. — Enhanced Digital Identity, Trust &amp; Heuristics</strong>
            <p>
              Simulated application permission governance, runtime guard inspection, behavioral DNA profiling, and adaptive trust scoring.
            </p>
          </div>
        </div>
        <div className="footer-links-row">
          <button type="button" onClick={() => navigate('overview')}>Overview</button>
          <button type="button" onClick={() => navigate('permissions')}>Permissions</button>
          <button type="button" onClick={() => navigate('dna')}>Behavioral DNA</button>
          <button type="button" onClick={() => navigate('adaptive')}>Adaptive Trust</button>
          <button type="button" onClick={() => navigate('security')}>Runtime Guard</button>
          <button type="button" onClick={() => navigate('history')}>Audit History</button>
        </div>
      </div>
    </footer>
  );
}
