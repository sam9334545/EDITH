import { RESOURCE_TYPES } from '@shared/contracts.js';
import EmptyState from '../common/EmptyState.jsx';
import StatusBadge from '../common/StatusBadge.jsx';
import { formatDate } from '../../utils/formatters.js';

const RESOURCE_LABELS = {
  location: 'Location',
  contacts: 'Contacts',
  camera: 'Camera',
  microphone: 'Microphone',
  files: 'Files',
};

const RESOURCE_DESCRIPTIONS = {
  location: 'Device location and route data',
  contacts: 'Address book and contact details',
  camera: 'Image capture and camera access',
  microphone: 'Audio input and recording',
  files: 'Local documents and attachments',
};

export default function PermissionGrid({ app, onToggle, busy }) {
  if (!app) return <EmptyState title="Choose an application">Select an app to review its permissions.</EmptyState>;
  return (
    <div className="permission-grid">
      {RESOURCE_TYPES.map((resource, index) => {
        const permission = app.permissions?.[resource];
        const enabled = permission?.enabled === true;
        return (
          <article className="permission-card" key={resource}>
            <div className="permission-topline">
              <span className={`resource-symbol resource-${resource}`} aria-hidden="true">{['⌖', '◎', '▧', '◖', '▤'][index]}</span>
              <StatusBadge tone={enabled ? 'success' : 'muted'}>{enabled ? 'Enabled' : 'Disabled'}</StatusBadge>
            </div>
            <div><h3>{RESOURCE_LABELS[resource]}</h3><p>{RESOURCE_DESCRIPTIONS[resource]}</p></div>
            <dl className="permission-meta">
              <div><dt>Granted</dt><dd>{formatDate(permission?.grantedAt)}</dd></div>
              <div><dt>Last accessed</dt><dd>{formatDate(permission?.lastAccessedAt)}</dd></div>
            </dl>
            <button type="button" className={`switch ${enabled ? 'switch-on' : ''}`} role="switch"
              aria-checked={enabled} aria-label={`${enabled ? 'Disable' : 'Enable'} ${RESOURCE_LABELS[resource]} permission`}
              disabled={busy} onClick={() => onToggle(resource, !enabled)}>
              <span /><span className="switch-label">{enabled ? 'On' : 'Off'}</span>
            </button>
          </article>
        );
      })}
    </div>
  );
}
