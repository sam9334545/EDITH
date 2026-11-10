import { useMemo, useState } from 'react';
import { APPLICATION_STATUS } from '@shared/contracts.js';
import AppMark from '../components/common/AppMark.jsx';
import EmptyState from '../components/common/EmptyState.jsx';
import PageHeader from '../components/common/PageHeader.jsx';
import StatusBadge from '../components/common/StatusBadge.jsx';
import TrustRing from '../components/common/TrustRing.jsx';
import { formatDate, humanize } from '../utils/formatters.js';
import Illustration from '../components/common/Illustration.jsx';

function Field({ label, value, onChange, options, placeholder }) {
  return (
    <label className="field"><span>{label}</span>{options ? (
      <select value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select>
    ) : <input value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />}</label>
  );
}

export default function Applications({ apps, events, errors, onStatusChange, onViewApp, onViewAppPage, busyAction }) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [sort, setSort] = useState('trust');
  const filtered = useMemo(() => apps
    .filter((app) => app.name.toLowerCase().includes(search.toLowerCase()) || app.description?.toLowerCase().includes(search.toLowerCase()))
    .filter((app) => status === 'all' || app.status === status)
    .sort((left, right) => sort === 'name'
      ? left.name.localeCompare(right.name)
      : (right.trustScore ?? -1) - (left.trustScore ?? -1)), [apps, search, status, sort]);
  return (
    <>
      <PageHeader eyebrow="Application registry" title="Applications" description="Review the apps in your environment and understand their access posture." />
      <section className="registry-banner" aria-label="How applications reach protected resources">
        <div className="registry-banner-copy">
          <h4>Applications never reach a resource directly</h4>
          <p>
            Every request passes through the governance layer, which checks the application&apos;s status
            and its granted permissions before allowing or denying access. Suspended applications are
            blocked outright, whatever their individual permission flags say.
          </p>
        </div>
        <Illustration
          name="application-ecosystem"
          alt="Applications on the left connected through a central governance layer to protected resources on the right, with one link monitored and one restricted."
          className="registry-banner-art"
        />
      </section>
      <div className="toolbar">
        <Field label="Search applications" value={search} onChange={setSearch} placeholder="Name or description" />
        <Field label="Status" value={status} onChange={setStatus} options={[
          { value: 'all', label: 'All statuses' },
          { value: APPLICATION_STATUS.ACTIVE, label: 'Active' },
          { value: APPLICATION_STATUS.SUSPENDED, label: 'Suspended' },
        ]} />
        <Field label="Sort by" value={sort} onChange={setSort} options={[
          { value: 'trust', label: 'Trust score' },
          { value: 'name', label: 'Application name' },
        ]} />
        <span className="toolbar-count">{filtered.length} applications</span>
      </div>
      {errors.apps && <div className="api-unavailable" role="alert">{errors.apps.message}</div>}
      {filtered.length ? (
        <div className="application-grid">
          {filtered.map((app) => {
            const permissions = Object.entries(app.permissions || {}).filter(([, permission]) => permission.enabled);
            const lastAccess = Object.values(app.permissions || {}).map((permission) => permission.lastAccessedAt).filter(Boolean).sort().at(-1);
            return (
              <article className="application-card" key={app.id}>
                <div className="application-card-top"><AppMark name={app.name} /><StatusBadge tone={app.status === APPLICATION_STATUS.ACTIVE ? 'success' : 'muted'}>{humanize(app.status)}</StatusBadge></div>
                <h2>{app.name}</h2><p className="application-description">{app.description}</p>
                <div className="application-card-score"><TrustRing score={app.trustScore} level={app.trustLevel} size="small" /><div><strong>{Number.isFinite(app.trustScore) ? app.trustScore : '—'} <small>/ 100</small></strong><span>{humanize(app.trustLevel)} trust</span></div></div>
                <div className="permission-chips">{permissions.length ? permissions.map(([resource]) => <span key={resource}>{humanize(resource)}</span>) : <span className="muted-chip">No permissions enabled</span>}</div>
                <div className="application-last-access"><span>Last accessed</span><strong>{formatDate(lastAccess)}</strong></div>
                <div className="application-card-actions">
                  <button className="button" type="button" onClick={() => onViewApp(app)}>Quick view</button>
                  <button className="button" type="button" onClick={() => onViewAppPage(app)}>Full details</button>
                  <button className={`button ${app.status === APPLICATION_STATUS.ACTIVE ? 'button-danger-quiet' : 'button-primary'}`} disabled={Boolean(busyAction)} onClick={() => onStatusChange(app)}>
                    {app.status === APPLICATION_STATUS.ACTIVE ? 'Suspend' : 'Reactivate'}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      ) : errors.apps ? null : <EmptyState title="No matching applications">Adjust the filters or search term and try again.</EmptyState>}
      <p className="data-note">Application scores and status are supplied by the backend. Access activity currently includes {events.length} API event records.</p>
    </>
  );
}
