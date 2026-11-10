export default function TrustRing({ score, level, size = 'large' }) {
  const validScore = Number.isFinite(score) ? Math.min(100, Math.max(0, score)) : 0;
  return (
    <div className={`trust-ring trust-${level || 'unknown'} trust-ring-${size}`}
      style={{ '--score-progress': `${validScore}%` }}
      aria-label={Number.isFinite(score) ? `Trust score ${score} out of 100` : 'Trust score unavailable'}>
      <div className="trust-ring-center"><strong>{Number.isFinite(score) ? score : '—'}</strong><span>of 100</span></div>
    </div>
  );
}
