import { APPLICATION_STATUS } from '@shared/contracts.js';
import EmptyState from '../components/common/EmptyState.jsx';
import PageHeader from '../components/common/PageHeader.jsx';
import Panel from '../components/common/Panel.jsx';
import PermissionGrid from '../components/security/PermissionGrid.jsx';
import StatusBadge from '../components/common/StatusBadge.jsx';
import AppMark from '../components/common/AppMark.jsx';
import { humanize } from '../utils/formatters.js';

export default function PermissionManagement({ apps, selectedAppId, setSelectedAppId, selectedApp, errors, onPermissionChange, busyAction }) {
  return (
    <>
      <PageHeader eyebrow="Access governance" title="Permissions" description="Review and change each application’s access to sensitive resources." />
      <Panel title="Select an application" className="permission-selector-panel">
        {errors.apps ? <div className="api-unavailable" role="alert">{errors.apps.message}</div> : (
          <label className="field"><span>Application</span><select value={selectedAppId} onChange={(event) => setSelectedAppId(event.target.value)}>
            {apps.map((app) => <option value={app.id} key={app.id}>{app.name}</option>)}
          </select></label>
        )}
        {selectedApp && <div className="selected-app-summary"><AppMark name={selectedApp.name} /><div><strong>{selectedApp.name}</strong><span>{selectedApp.description}</span></div><StatusBadge tone={selectedApp.status === APPLICATION_STATUS.ACTIVE ? 'success' : 'muted'}>{humanize(selectedApp.status)}</StatusBadge></div>}
      </Panel>
      {selectedApp ? (
        <>
          <div className="section-heading"><div><span className="eyebrow">Permission inventory</span><h2>Resource access</h2></div><p>Changes require confirmation and are sent to the backend.</p></div>
          <PermissionGrid app={selectedApp} busy={Boolean(busyAction)} onToggle={(resource, enabled) => onPermissionChange(selectedApp, resource, enabled)} />
        </>
      ) : !errors.apps && <EmptyState title="No applications available">Connect to the backend to manage permissions.</EmptyState>}
      <div className="notice notice-simulated"><strong>Access decisions stay server-side.</strong><span>This interface requests permission updates; the backend remains the source of truth for access decisions.</span></div>
    </>
  );
}
