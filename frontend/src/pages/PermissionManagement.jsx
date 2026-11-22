import { useMemo } from 'react';
import { AlertTriangle, Check, Lock, ShieldAlert } from 'lucide-react';
import { ACTIVITY_EVENT_TYPES, APPLICATION_STATUS, RESOURCE_TYPES } from '@shared/contracts.js';
import AppMark from '../components/common/AppMark.jsx';
import EmptyState from '../components/common/EmptyState.jsx';
import ErrorState from '../components/common/ErrorState.jsx';
import PageHeader from '../components/common/PageHeader.jsx';
import Panel from '../components/common/Panel.jsx';
import ProductIllustration from '../components/common/ProductIllustration.jsx';
import StatusBadge from '../components/common/StatusBadge.jsx';
import { ResourceIcon } from '../components/common/AppIcon.jsx';
import PermissionGrid from '../components/security/PermissionGrid.jsx';
import { EVENT_LABELS, RESOURCE_LABELS, appName, formatDate } from '../components/common/LegacyControls.jsx';
import { humanize } from '../utils/formatters.js';

export default function PermissionManagement({
  apps = [],
  history = [],
  selectedAppId,
  setSelectedAppId,
  selectedApp,
  errors = {},
  onPermissionChange,
  busyAction,
}) {
  const permissionAudit = useMemo(
    () => history
      .filter((item) => [
        ACTIVITY_EVENT_TYPES.PERMISSION_GRANTED,
        ACTIVITY_EVENT_TYPES.PERMISSION_REVOKED,
        ACTIVITY_EVENT_TYPES.APP_SUSPENDED,
        ACTIVITY_EVENT_TYPES.APP_REACTIVATED,
      ].includes(item.eventType))
      .slice(0, 6),
    [history],
  );

  const isSelectedSuspended = selectedApp?.status === APPLICATION_STATUS.SUSPENDED;

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Least-privilege access governance"
        title="Permissions"
        description="Enforce strict per-resource access flags across all registered applications. Changes require confirmation and persist through the backend."
      />

      <div className="split-intro-banner">
        <div className="split-intro-copy">
          <span className="eyebrow">Central Governance Layer</span>
          <h2>Zero-Trust Precedence &amp; Resource Matrix</h2>
          <p>
            Every application is governed across five sensitive capabilities: Location, Contacts, Camera, Microphone, and Files. Individual flags control entitlement, while application suspension overrides all resource grants at the backend decision gate.
          </p>
          <div className="notice notice-simulated" style={{ marginTop: '14px' }}>
            <Lock size={15} aria-hidden="true" />
            <div>
              <strong>Backend enforces access control:</strong> The frontend only dispatches permission requests; access allow/deny outcomes are evaluated strictly server-side.
            </div>
          </div>
        </div>
        <ProductIllustration
          src="/assets/application-ecosystem.webp"
          alt="Applications connected through a central governance layer to Location, Contacts, Camera, Microphone, and Files resources"
          variant="compact"
        />
      </div>

      <Panel
        title="Workspace permission matrix"
        eyebrow={`${apps.length} applications × 5 resource vectors`}
      >
        <ErrorState error={errors.apps} title="Applications could not be loaded" />
        {!errors.apps && apps.length ? (
          <div className="table-scroll">
            <table className="governance-matrix-table">
              <thead>
                <tr>
                  <th>Application</th>
                  <th>Status</th>
                  {RESOURCE_TYPES.map((resource) => (
                    <th key={resource} className="matrix-col-head">
                      <span className="matrix-head-inner">
                        <ResourceIcon resource={resource} size={13} />
                        {RESOURCE_LABELS[resource]}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {apps.map((app) => {
                  const suspended = app.status === APPLICATION_STATUS.SUSPENDED;
                  const isCurrent = app.id === selectedAppId;
                  return (
                    <tr
                      key={app.id}
                      className={isCurrent ? 'matrix-row-selected' : ''}
                    >
                      <td>
                        <button
                          type="button"
                          className="matrix-app-select"
                          onClick={() => setSelectedAppId(app.id)}
                        >
                          <AppMark name={app.name} size="sm" />
                          <span>
                            <strong>{app.name}</strong>
                            <small>{app.id}</small>
                          </span>
                        </button>
                      </td>
                      <td>
                        <StatusBadge tone={suspended ? 'danger' : 'success'}>
                          {humanize(app.status)}
                        </StatusBadge>
                      </td>
                      {RESOURCE_TYPES.map((resource) => {
                        const enabled = app.permissions?.[resource]?.enabled === true;
                        const busyKey = `${app.id}-${resource}`;
                        return (
                          <td key={resource} className="matrix-cell">
                            <button
                              type="button"
                              className={`matrix-toggle ${enabled ? 'matrix-on' : 'matrix-off'} ${suspended && enabled ? 'matrix-overridden' : ''}`}
                              disabled={Boolean(busyAction)}
                              aria-label={`${enabled ? 'Disable' : 'Enable'} ${RESOURCE_LABELS[resource]} for ${app.name}`}
                              title={suspended && enabled ? 'Flag enabled, but blocked while app is suspended' : `${enabled ? 'Enabled' : 'Disabled'} — click to change`}
                              onClick={() => onPermissionChange(app, resource, !enabled)}
                            >
                              {busyAction === busyKey ? '…' : enabled ? <><Check size={12} /> On</> : 'Off'}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : !errors.apps && (
          <EmptyState title="No applications available">
            Connect to the backend to inspect and govern permissions.
          </EmptyState>
        )}
      </Panel>

      <Panel
        title="Inspect & configure selected application"
        eyebrow="Granular resource timestamps & controls"
        action={(
          <label className="field inline-select-field">
            <span>Application</span>
            <select value={selectedAppId} onChange={(event) => setSelectedAppId(event.target.value)}>
              {apps.map((app) => (
                <option value={app.id} key={app.id}>{app.name}</option>
              ))}
            </select>
          </label>
        )}
      >
        {selectedApp ? (
          <>
            <div className="selected-app-banner">
              <AppMark name={selectedApp.name} />
              <div className="selected-app-meta">
                <strong>{selectedApp.name}</strong>
                <span>{selectedApp.description}</span>
              </div>
              <StatusBadge tone={isSelectedSuspended ? 'danger' : 'success'}>
                {humanize(selectedApp.status)}
              </StatusBadge>
            </div>

            {isSelectedSuspended && (
              <div className="suspended-precedence-alert" role="alert">
                <ShieldAlert size={18} aria-hidden="true" />
                <div>
                  <strong>Suspended Application Precedence Active</strong>
                  <p>
                    {selectedApp.name} is currently suspended. All simulated runtime access requests are automatically denied by the backend even if individual permission switches below remain enabled.
                  </p>
                </div>
              </div>
            )}

            <PermissionGrid
              app={selectedApp}
              busy={Boolean(busyAction)}
              onToggle={(resource, enabled) => onPermissionChange(selectedApp, resource, enabled)}
            />
          </>
        ) : (
          <EmptyState title="No application selected">
            Choose an application from the governance matrix above.
          </EmptyState>
        )}
      </Panel>

      <Panel title="Recent governance audit trail" eyebrow="Persisted permission & status mutations">
        {permissionAudit.length ? (
          <div className="audit-compact-list">
            {permissionAudit.map((item) => (
              <div className="audit-compact-row" key={item.id}>
                <StatusBadge tone={item.eventType.includes('revoked') || item.eventType.includes('suspended') ? 'danger' : 'success'}>
                  {EVENT_LABELS[item.eventType] || humanize(item.eventType)}
                </StatusBadge>
                <strong>{appName(apps, item.appId)}</strong>
                <span>{item.description}</span>
                <time>{formatDate(item.timestamp)}</time>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title="No recent governance changes" icon={<AlertTriangle size={18} />}>
            Permission grants, revocations, and application suspensions will appear here.
          </EmptyState>
        )}
      </Panel>
    </div>
  );
}
