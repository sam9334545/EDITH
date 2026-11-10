export default function ErrorState({ error, title = 'Data unavailable' }) {
  if (!error) return null;
  return (
    <div className="api-unavailable" role="alert">
      <strong>{title}</strong>
      <span>{error.message || 'The requested data could not be loaded.'}</span>
      {error.status === 404 && <small>The backend did not find the requested record.</small>}
    </div>
  );
}
