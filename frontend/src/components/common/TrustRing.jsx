import { trustLevelFor } from '@shared/contracts.js';

const RING_COLORS = {
  high: '#26745C',
  moderate: '#D99A32',
  low: '#D97706',
  critical: '#C94B4B',
  unknown: '#94A3B8',
};

export default function TrustRing({ score, level, size = 'large' }) {
  const numericScore = Number.isFinite(score) ? Math.min(100, Math.max(0, Math.round(score))) : null;
  const resolvedLevel = level || (numericScore !== null ? trustLevelFor(numericScore) : 'unknown');
  const px = typeof size === 'number' ? size : size === 'small' ? 54 : size === 'medium' ? 76 : 96;
  const strokeWidth = px <= 58 ? 5 : 7;
  const radius = (px - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = numericScore !== null ? (numericScore / 100) * circumference : 0;
  const color = RING_COLORS[resolvedLevel] || RING_COLORS.unknown;

  return (
    <div
      className={`trust-ring-v2 trust-${resolvedLevel} ${px <= 58 ? 'trust-ring-small' : ''}`}
      style={{ width: `${px}px`, height: `${px}px` }}
      aria-label={numericScore !== null ? `Trust score ${numericScore} out of 100` : 'Trust score unavailable'}
    >
      <svg width={px} height={px} viewBox={`0 0 ${px} ${px}`} className="trust-ring-svg" aria-hidden="true">
        <circle
          cx={px / 2}
          cy={px / 2}
          r={radius}
          fill="none"
          stroke="#E4F2EC"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={px / 2}
          cy={px / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${progress} ${circumference}`}
          transform={`rotate(-90 ${px / 2} ${px / 2})`}
          className="trust-ring-arc"
        />
      </svg>
      <div className="trust-ring-center">
        <strong>{numericScore !== null ? numericScore : '—'}</strong>
        <span>/100</span>
      </div>
    </div>
  );
}
