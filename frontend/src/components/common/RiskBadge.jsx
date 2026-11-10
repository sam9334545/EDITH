import StatusBadge from './StatusBadge.jsx';
import { humanize } from '../../utils/formatters.js';

export default function RiskBadge({ level }) {
  return <StatusBadge tone={level || 'neutral'}>{level ? humanize(level) : 'Not available'}</StatusBadge>;
}
