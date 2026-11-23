import { useMemo, useState } from 'react';
import { Eye, LayoutGrid, List, Search, ShieldAlert, ShieldCheck } from 'lucide-react';
import { APPLICATION_STATUS } from '@shared/contracts.js';
import AppMark from '../components/common/AppMark.jsx';
import EmptyState from '../components/common/EmptyState.jsx';
import ErrorState from '../components/common/ErrorState.jsx';
import PageHeader from '../components/common/PageHeader.jsx';
import StatCard from '../components/common/StatCard.jsx';
import StatusBadge from '../components/common/StatusBadge.jsx';
import TrustRing from '../components/common/TrustRing.jsx';
import { ResourceIcon } from '../components/common/AppIcon.jsx';
import { formatDate, humanize } from '../utils/formatters.js';

function Field({ label, value, onChange, options, placeholder }) {
  return (
    <label className="field">
      <span>{label}</span>
      {options ? (
        <select value={value} onChange={(event) => onChange(event.target.value)}>
          {options.map((option) => (
            <option value={option.value} key={option.value}>{option.label}</option>
          ))}
        </select>
      ) : (
        <div className="search-input-wrap">
          <Search size={14} className="search-input-icon" aria-hidden="true" />
          <input value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
        </div>
      )}
    </label>
  );
}

export default function Applications({ apps = [], events = [], errors = {}, onStatusChange, onViewApp, onViewAppPage, busyAction }) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [sort, setSort] = useState('trust-asc');
  const [viewMode, setViewMode] = useState('grid');

  const activeCount = apps.filter((a) => a.status === APPLICATION_STATUS.ACTIVE).length;
  const suspendedCount = apps.filter((a) => a.status === APPLICATION_STATUS.SUSPENDED).length;
  const lowTrustCount = apps.filter((a) => (a.trustScore ?? 100) < 60).length;

  const filtered = useMemo(() => apps
    .filter((app) => (
      app.name.toLowerCase().includes(search.toLowerCase())
      || app.description?.toLowerCase().includes(search.toLowerCase())
      || app.id?.toLowerCase().includes(search.toLowerCase())
    ))
    .filter((app) => status === 'all' || app.status === status)
    .sort((left, right) => {
      if (sort === 'name') return left.name.localeCompare(right.name);
      if (sort === 'trust-desc') return (right.trustScore ?? -1) - (left.trustScore ?? -1);
      return (left.trustScore ?? 101) - (right.trustScore ?? 101);
    }), [apps, search, status, sort]);

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Application inventory & risk registry"
        title="Applications"
        description="Inspect registered workspace applications, review their enabled sensitive permissions, evaluate trust tiers, and enforce suspension."
        actions={(
          <div className="segmented-toggle" role="group" aria-label="View layout">
            <button
              type="button"
              className={viewMode === 'grid' ? 'active' : ''}
              onClick={() => setViewMode('grid')}
            >
              <LayoutGrid size={14} aria-hidden="true" /> Cards
            </button>
            <button
              type="button"
              className={viewMode === 'table' ? 'active' : ''}
              onClick={() => setViewMode('table')}
            >
              <List size={14} aria-hidden="true" /> Table
            </button>
          </div>
        )}
      />

      <div className="kpi-grid kpi-grid-4">
        <StatCard label="Registered apps" value={apps.length} detail="Returned by API registry" icon={<LayoutGrid size={15} />} />
        <StatCard label="Active operational" value={activeCount} detail="Permitted to request resources" icon={<ShieldCheck size={15} />} tone="success" />
        <StatCard label="Suspended" value={suspendedCount} detail="Blocked from all resource access" icon={<ShieldAlert size={15} />} tone={suspendedCount > 0 ? 'danger' : 'neutral'} />
        <StatCard label="Below 60 trust" value={lowTrustCount} detail="Requires governance review" icon={<ShieldAlert size={15} />} tone={lowTrustCount > 0 ? 'warning' : 'success'} />
      </div>

      <div className="toolbar toolbar-elevated">
        <Field label="Search applications" value={search} onChange={setSearch} placeholder="Name, ID, or description" />
        <Field
          label="Status"
          value={status}
          onChange={setStatus}
          options={[
            { value: 'all', label: 'All statuses' },
            { value: APPLICATION_STATUS.ACTIVE, label: 'Active' },
            { value: APPLICATION_STATUS.SUSPENDED, label: 'Suspended' },
          ]}
        />
        <Field
          label="Sort by"
          value={sort}
          onChange={setSort}
          options={[
            { value: 'trust-asc', label: 'Lowest trust first' },
            { value: 'trust-desc', label: 'Highest trust first' },
            { value: 'name', label: 'Application name' },
          ]}
        />
        <span className="toolbar-count">{filtered.length} of {apps.length} applications</span>
      </div>

      <ErrorState error={errors.apps} title="Applications could not be loaded" />

      {filtered.length ? (
        viewMode === 'grid' ? (
          <div className="application-grid">
            {filtered.map((app) => {
              const permissions = Object.entries(app.permissions || {}).filter(([, permission]) => permission.enabled);
              const lastAccess = Object.values(app.permissions || {}).map((permission) => permission.lastAccessedAt).filter(Boolean).sort().at(-1);
              const isSuspended = app.status === APPLICATION_STATUS.SUSPENDED;
              return (
                <article className={`application-card ${isSuspended ? 'application-card-suspended' : ''}`} key={app.id}>
                  <div className="application-card-top">
                    <div className="app-identity-cluster">
                      <AppMark name={app.name} />
                      <div>
                        <span className="app-id-code">{app.id}</span>
                        {app.category && <span className="app-category-tag">{humanize(app.category)}</span>}
                      </div>
                    </div>
                    <StatusBadge tone={isSuspended ? 'danger' : 'success'}>{humanize(app.status)}</StatusBadge>
                  </div>

                  <h2>{app.name}</h2>
                  <p className="application-description">{app.description}</p>

                  <div className="application-card-score">
                    <TrustRing score={app.trustScore} level={app.trustLevel} size="small" />
                    <div>
                      <strong>{Number.isFinite(app.trustScore) ? app.trustScore : '—'} <small>/ 100</small></strong>
                      <span>{humanize(app.trustLevel)} trust tier</span>
                    </div>
                  </div>

                  <div className="permission-chips">
                    {permissions.length ? permissions.map(([resource]) => (
                      <span className="permission-chip-icon" key={resource}>
                        <ResourceIcon resource={resource} size={12} />
                        {humanize(resource)}
                      </span>
                    )) : <span className="muted-chip">No permissions enabled</span>}
                  </div>

                  <div className="application-last-access">
                    <span>Last accessed</span>
                    <strong>{formatDate(lastAccess)}</strong>
                  </div>

                  <div className="application-card-actions">
                    <button className="button" type="button" onClick={() => onViewApp(app)}>
                      <Eye size={13} aria-hidden="true" /> Quick view
                    </button>
                    <button className="button" type="button" onClick={() => onViewAppPage(app)}>
                      Posture
                    </button>
                    <button
                      className={`button ${!isSuspended ? 'button-danger-quiet' : 'button-primary'}`}
                      type="button"
                      disabled={Boolean(busyAction)}
                      onClick={() => onStatusChange(app)}
                    >
                      {!isSuspended ? 'Suspend' : 'Reactivate'}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="panel table-panel">
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Application</th>
                    <th>Status</th>
                    <th>Trust Score</th>
                    <th>Enabled Permissions</th>
                    <th>Last Accessed</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((app) => {
                    const permissions = Object.entries(app.permissions || {}).filter(([, p]) => p.enabled);
                    const lastAccess = Object.values(app.permissions || {}).map((p) => p.lastAccessedAt).filter(Boolean).sort().at(-1);
                    const isSuspended = app.status === APPLICATION_STATUS.SUSPENDED;
                    return (
                      <tr key={app.id}>
                        <td>
                          <div className="table-app">
                            <AppMark name={app.name} size="sm" />
                            <div>
                              <strong>{app.name}</strong>
                              <small className="table-sub-id">{app.id}</small>
                            </div>
                          </div>
                        </td>
                        <td><StatusBadge tone={isSuspended ? 'danger' : 'success'}>{humanize(app.status)}</StatusBadge></td>
                        <td>
                          <strong className="mono-num">{app.trustScore ?? '—'}</strong>
                          <small className="table-sub-id"> · {humanize(app.trustLevel)}</small>
                        </td>
                        <td>
                          <div className="permission-chips inline-chips">
                            {permissions.length ? permissions.map(([r]) => (
                              <span key={r}>{humanize(r)}</span>
                            )) : <span className="muted-chip">None</span>}
                          </div>
                        </td>
                        <td>{formatDate(lastAccess)}</td>
                        <td>
                          <div className="table-actions-row">
                            <button className="button button-xs" type="button" onClick={() => onViewAppPage(app)}>Details</button>
                            <button
                              className={`button button-xs ${!isSuspended ? 'button-danger-quiet' : 'button-primary'}`}
                              type="button"
                              disabled={Boolean(busyAction)}
                              onClick={() => onStatusChange(app)}
                            >
                              {!isSuspended ? 'Suspend' : 'Reactivate'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      ) : errors.apps ? null : (
        <EmptyState title="No matching applications">
          Adjust the filters or search term and try again.
        </EmptyState>
      )}

      <p className="data-note">
        Application trust scores and lifecycle status are governed by the backend. Access telemetry currently references {events.length} API event records.
      </p>
    </div>
  );
}
