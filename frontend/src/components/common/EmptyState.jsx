export default function EmptyState({ title, children }) {
  return (
    <div className="empty-state">
      <span className="empty-mark">—</span>
      <strong>{title}</strong>
      {children && <p>{children}</p>}
    </div>
  );
}
