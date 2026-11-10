import { formatDate, humanize } from '../../utils/formatters.js';

export default function IncidentTimeline({ items = [] }) {
  const ordered = items
    .map((item, index) => ({ ...item, originalIndex: index }))
    .sort((left, right) => (
      new Date(left.timestamp) - new Date(right.timestamp) || left.originalIndex - right.originalIndex
    ));

  if (!ordered.length) {
    return <p className="panel-note">No persisted timeline events are available for this incident.</p>;
  }
  return (
    <ol className="incident-timeline">
      {ordered.map((item, index) => (
        <li key={`${item.type}-${item.timestamp}-${index}`}>
          <span className="timeline-dot" />
          <div>
            <strong>{humanize(item.type)}</strong>
            <p>{item.description || 'No description was recorded.'}</p>
            <time>{formatDate(item.timestamp)}</time>
          </div>
        </li>
      ))}
    </ol>
  );
}
