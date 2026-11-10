function Icon({ children }) {
  return <span aria-hidden="true" className="icon">{children}</span>;
}

export default function Header({ onRefresh }) {
  return (
    <header className="topbar">
      <a className="brand" href="#overview">
        <span className="brand-mark"><span /><span /><span /></span>
        <span className="brand-copy">
          <strong>E.D.I.T.H.</strong>
          <small>Enhanced Digital Identity &amp; Heuristics</small>
        </span>
      </a>
      <div className="topbar-tools">
        <span className="environment-tag"><i />Simulated Environment</span>
        <button type="button" className="icon-button refresh-button" aria-label="Refresh data" onClick={onRefresh}>
          <Icon>↻</Icon>
        </button>
        <span className="profile-mark" aria-label="Workspace profile" title="Security Workspace">ED</span>
      </div>
    </header>
  );
}
