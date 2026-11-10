export function scoreImpactLabel(scoreImpact) {
  if (!Number.isFinite(scoreImpact)) return 'Not available';
  if (scoreImpact < 0) return `${scoreImpact} points`;
  if (scoreImpact > 0) return `+${scoreImpact} points`;
  return 'No change';
}

export function scoreImpactTone(scoreImpact) {
  if (!Number.isFinite(scoreImpact) || scoreImpact === 0) return 'neutral';
  return scoreImpact < 0 ? 'danger' : 'success';
}
