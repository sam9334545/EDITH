import { AlertCircle } from 'lucide-react';

export default function ErrorState({ error, message, title = 'Data unavailable' }) {
  const resolvedMessage = typeof error === 'string'
    ? error
    : error?.message || message;
  if (!error && !message) return null;

  return (
    <div className="api-unavailable" role="alert">
      <div className="api-unavailable-head">
        <AlertCircle size={16} strokeWidth={2} aria-hidden="true" />
        <strong>{title}</strong>
      </div>
      <span>{resolvedMessage || 'The requested data could not be loaded.'}</span>
      {error?.status === 404 && <small>The backend did not find the requested record.</small>}
    </div>
  );
}
