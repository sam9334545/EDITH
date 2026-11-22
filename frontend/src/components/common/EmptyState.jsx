import { Inbox } from 'lucide-react';

export default function EmptyState({ title, children, icon }) {
  return (
    <div className="empty-state">
      <span className="empty-mark" aria-hidden="true">
        {icon || <Inbox size={20} strokeWidth={1.7} />}
      </span>
      <strong>{title}</strong>
      {children && <p>{children}</p>}
    </div>
  );
}
