export default function StatCard({ label, value, suffix = '', detail, icon, tone = 'neutral' }) {
  return (
    <article className={`kpi-card kpi-${tone}`}>
      <div className="kpi-topline">
        <span>{label}</span>
        {icon && <span className="kpi-icon" aria-hidden="true">{icon}</span>}
      </div>
      <div className="kpi-value">
        {value ?? '—'}
        {suffix && <small>{suffix}</small>}
      </div>
      {detail && <p>{detail}</p>}
    </article>
  );
}
