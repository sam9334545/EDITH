export default function LoadingState({ label, message }) {
  return (
    <div className="loading-state" role="status">
      <span className="spinner" aria-hidden="true" />
      <span>{label || message || 'Loading data'}</span>
    </div>
  );
}
