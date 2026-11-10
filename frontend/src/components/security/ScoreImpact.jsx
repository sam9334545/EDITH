import { scoreImpactLabel, scoreImpactTone } from '../../utils/riskCalculations.js';

export default function ScoreImpact({ before, impact, after }) {
  return (
    <div className="score-impact">
      <div><span>Before</span><strong>{Number.isFinite(before) ? before : 'Not recorded'}</strong></div>
      <div className={`score-impact-change tone-${scoreImpactTone(impact)}`}>
        <span>Recorded change</span><strong>{scoreImpactLabel(impact)}</strong>
      </div>
      <div><span>After</span><strong>{Number.isFinite(after) ? after : 'Not recorded'}</strong></div>
    </div>
  );
}
