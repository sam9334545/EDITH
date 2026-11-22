export default function PageHeader({ eyebrow, title, description, actions, badge, children }) {
  return (
    <header className="page-header">
      <div className="page-header-copy">
        <div className="page-header-eyebrow-row">
          {eyebrow && <span className="eyebrow">{eyebrow}</span>}
          {badge}
        </div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
        {children}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  );
}
