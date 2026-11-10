import { NAV_ITEMS } from './navigation.js';

function Icon({ children }) {
  return <span aria-hidden="true" className="icon">{children}</span>;
}

export default function Sidebar({ page, navigate, open, onToggle }) {
  return (
    <div className="navigation-wrap">
      <button
        type="button"
        className="mobile-menu-button"
        aria-expanded={open}
        aria-controls="primary-navigation"
        onClick={onToggle}
      >
        <Icon>{open ? '×' : '☰'}</Icon>
        <span>Navigate</span>
      </button>
      <nav id="primary-navigation" className={`primary-navigation ${open ? 'navigation-open' : ''}`} aria-label="Primary">
        {NAV_ITEMS.map((item) => (
          <button
            type="button"
            key={item.id}
            className={`nav-link ${page === item.id ? 'nav-link-active' : ''}`}
            aria-current={page === item.id ? 'page' : undefined}
            onClick={() => navigate(item.id)}
          >
            <span className="nav-symbol" aria-hidden="true">{item.symbol}</span>
            {item.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
