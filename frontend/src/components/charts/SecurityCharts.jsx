import { useMemo, useState } from 'react';
import { ACCESS_STATUS } from '@shared/contracts.js';
import { formatDate } from '../../utils/formatters.js';

export function AccessActivityChart({ events = [] }) {
  const [hoveredIndex, setHoveredIndex] = useState(null);

  const days = useMemo(() => {
    const end = new Date();
    end.setHours(0, 0, 0, 0);
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(end);
      date.setDate(end.getDate() - (6 - index));
      const key = date.toLocaleDateString();
      const dayEvents = events.filter((item) => new Date(item.timestamp).toLocaleDateString() === key);
      const allowed = dayEvents.filter((item) => item.status === ACCESS_STATUS.ALLOWED).length;
      const denied = dayEvents.filter((item) => item.status === ACCESS_STATUS.DENIED).length;
      return {
        key,
        label: date.toLocaleDateString(undefined, { weekday: 'short' }),
        dateLabel: date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        allowed,
        denied,
        total: allowed + denied,
      };
    });
  }, [events]);

  const maxVal = Math.max(1, ...days.map((d) => d.total));
  const chartW = 520;
  const chartH = 190;
  const pad = { top: 14, right: 16, bottom: 30, left: 34 };
  const plotW = chartW - pad.left - pad.right;
  const plotH = chartH - pad.top - pad.bottom;
  const colW = plotW / days.length;
  const barW = Math.min(28, colW * 0.44);
  const ticks = Array.from(new Set([0, Math.ceil(maxVal / 2), maxVal]));
  const active = hoveredIndex !== null ? days[hoveredIndex] : null;

  return (
    <div className="svg-chart-wrap" aria-label="Allowed and denied requests in the last seven days">
      <div className="svg-chart-header">
        <div className="chart-legend-inline">
          <span><i className="dot-allowed" />Allowed</span>
          <span><i className="dot-denied" />Denied</span>
        </div>
        <span className="chart-readout">
          {active
            ? `${active.dateLabel}: ${active.allowed} allowed · ${active.denied} denied`
            : 'Latest 200 API events'}
        </span>
      </div>
      <svg viewBox={`0 0 ${chartW} ${chartH}`} className="svg-chart" role="img" aria-label="7-day access request bar chart">
        {ticks.map((tick) => {
          const y = pad.top + plotH - (tick / maxVal) * plotH;
          return (
            <g key={`tick-${tick}`}>
              <line x1={pad.left} x2={chartW - pad.right} y1={y} y2={y} className="chart-grid-line" />
              <text x={pad.left - 8} y={y + 3.5} textAnchor="end" className="chart-axis-text">
                {tick}
              </text>
            </g>
          );
        })}

        {days.map((day, idx) => {
          const cx = pad.left + colW * idx + colW / 2;
          const x = cx - barW / 2;
          const totalH = (day.total / maxVal) * plotH;
          const allowedH = day.total ? (day.allowed / day.total) * totalH : 0;
          const deniedH = day.total ? (day.denied / day.total) * totalH : 0;
          const allowedY = pad.top + plotH - allowedH;
          const deniedY = allowedY - deniedH;

          return (
            <g
              key={day.key}
              className="chart-bar-group"
              onMouseEnter={() => setHoveredIndex(idx)}
              onMouseLeave={() => setHoveredIndex(null)}
            >
              <rect
                x={pad.left + colW * idx}
                y={pad.top}
                width={colW}
                height={plotH}
                fill={hoveredIndex === idx ? 'rgba(38, 116, 92, 0.05)' : 'transparent'}
                rx="4"
              />
              {day.total === 0 ? (
                <rect x={x} y={pad.top + plotH - 3} width={barW} height={3} rx="1.5" fill="#DCE7E1" />
              ) : (
                <>
                  {day.allowed > 0 && (
                    <rect
                      x={x}
                      y={allowedY}
                      width={barW}
                      height={Math.max(2, allowedH)}
                      rx={day.denied > 0 ? 0 : 4}
                      fill="#26745C"
                    />
                  )}
                  {day.denied > 0 && (
                    <rect
                      x={x}
                      y={deniedY}
                      width={barW}
                      height={Math.max(2, deniedH)}
                      rx="3"
                      fill="#C94B4B"
                    />
                  )}
                </>
              )}
              <text x={cx} y={chartH - 8} textAnchor="middle" className="chart-axis-text">
                {day.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

const DONUT_COLORS = {
  critical: '#C94B4B',
  high: '#D97706',
  medium: '#D99A32',
  moderate: '#D99A32',
  low: '#26745C',
};

export function RiskDonutChart({ items = [], centerLabel = 'Total', emptyText = 'No distribution data' }) {
  const total = items.reduce((sum, item) => sum + (item.count || 0), 0);
  if (!total) {
    return <p className="chart-empty-note">{emptyText}</p>;
  }

  const size = 148;
  const stroke = 16;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div className="donut-chart-layout">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="donut-svg" role="img" aria-label={`${centerLabel} distribution`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#E4F2EC" strokeWidth={stroke} />
        {items.map((item) => {
          if (!item.count) return null;
          const frac = item.count / total;
          const dash = Math.max(0, frac * circumference - (items.filter((i) => i.count > 0).length > 1 ? 2 : 0));
          const el = (
            <circle
              key={item.key}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={item.color || DONUT_COLORS[item.key] || '#26745C'}
              strokeWidth={stroke}
              strokeDasharray={`${dash} ${circumference}`}
              strokeDashoffset={-offset}
              strokeLinecap="butt"
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
          );
          offset += frac * circumference;
          return el;
        })}
        <text x="50%" y="47%" textAnchor="middle" className="donut-center-value">{total}</text>
        <text x="50%" y="62%" textAnchor="middle" className="donut-center-label">{centerLabel}</text>
      </svg>
      <div className="donut-legend">
        {items.map((item) => (
          <div className="donut-legend-row" key={item.key}>
            <span className="donut-legend-left">
              <i style={{ background: item.color || DONUT_COLORS[item.key] || '#26745C' }} />
              {item.label}
            </span>
            <strong>{item.count}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

export function TrustDistributionChart({ apps = [] }) {
  const tiers = [
    { key: 'high', label: 'High (80–100)', color: '#26745C' },
    { key: 'moderate', label: 'Moderate (60–79)', color: '#D99A32' },
    { key: 'low', label: 'Low (40–59)', color: '#EA580C' },
    { key: 'critical', label: 'Critical (0–39)', color: '#C94B4B' },
  ].map((tier) => ({
    ...tier,
    count: apps.filter((app) => app.trustLevel === tier.key).length,
  }));

  const total = apps.length;

  return (
    <div className="trust-dist-wrap">
      {total > 0 && (
        <div className="segmented-bar" aria-hidden="true">
          {tiers.map((tier) => tier.count > 0 && (
            <span
              key={tier.key}
              style={{ width: `${(tier.count / total) * 100}%`, background: tier.color }}
              title={`${tier.label}: ${tier.count}`}
            />
          ))}
        </div>
      )}
      <div className="distribution-compact">
        {tiers.map((tier) => (
          <div className="distribution-row-v2" key={tier.key}>
            <span className="dist-label">
              <i style={{ background: tier.color }} />
              {tier.label}
            </span>
            <div className="distribution-track">
              <i style={{ width: `${total ? (tier.count / total) * 100 : 0}%`, background: tier.color }} />
            </div>
            <strong>{tier.count}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

export function TrustTrajectoryChart({ records = [] }) {
  const [hoveredIdx, setHoveredIdx] = useState(null);
  const points = useMemo(() => {
    const ordered = records.slice().sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    return ordered.map((item, idx) => {
      const score = Number.isFinite(item.newScore)
        ? item.newScore
        : Number.isFinite(item.score)
          ? item.score
          : 0;
      const prev = Number.isFinite(item.previousScore) ? item.previousScore : score;
      const delta = score - prev;
      return {
        id: item.id || idx,
        score: Math.min(100, Math.max(0, score)),
        prev,
        delta,
        reason: item.changeReason || item.reason || 'Score recorded',
        timestamp: item.timestamp,
      };
    });
  }, [records]);

  if (!points.length) {
    return <p className="chart-empty-note">No recorded trust transitions yet for this application.</p>;
  }

  const w = 540;
  const h = 210;
  const pad = { top: 18, right: 22, bottom: 32, left: 36 };
  const plotW = w - pad.left - pad.right;
  const plotH = h - pad.top - pad.bottom;

  const coords = points.map((pt, idx) => {
    const x = points.length === 1 ? pad.left + plotW / 2 : pad.left + (idx / (points.length - 1)) * plotW;
    const y = pad.top + plotH - (pt.score / 100) * plotH;
    return { ...pt, x, y };
  });

  const linePath = coords.map((pt, idx) => `${idx === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`).join(' ');
  const areaPath = coords.length > 1
    ? `${linePath} L ${coords[coords.length - 1].x} ${pad.top + plotH} L ${coords[0].x} ${pad.top + plotH} Z`
    : '';

  const active = hoveredIdx !== null ? coords[hoveredIdx] : coords[coords.length - 1];

  return (
    <div className="svg-chart-wrap" aria-label="Trust score trajectory over recorded adjustments">
      <div className="svg-chart-header">
        <div className="chart-legend-inline">
          <span><i style={{ background: '#26745C' }} />Score trajectory</span>
          <span><i style={{ background: '#D99A32' }} />60 / 80 thresholds</span>
        </div>
        <span className="chart-readout">
          {active.score}/100 ({active.delta >= 0 ? `+${active.delta}` : active.delta}) · {formatDate(active.timestamp)}
        </span>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className="svg-chart" role="img" aria-label="Trust score history chart">
        <defs>
          <linearGradient id="trustAreaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#26745C" stopOpacity="0.24" />
            <stop offset="100%" stopColor="#26745C" stopOpacity="0.01" />
          </linearGradient>
        </defs>

        {[0, 40, 60, 80, 100].map((val) => {
          const y = pad.top + plotH - (val / 100) * plotH;
          const isGate = val === 60 || val === 80 || val === 40;
          return (
            <g key={val}>
              <line
                x1={pad.left}
                x2={w - pad.right}
                y1={y}
                y2={y}
                stroke={val === 40 ? 'rgba(201,75,75,0.28)' : val === 60 ? 'rgba(217,154,50,0.32)' : '#DCE7E1'}
                strokeDasharray={isGate ? '4 4' : undefined}
              />
              <text x={pad.left - 8} y={y + 3.5} textAnchor="end" className="chart-axis-text">
                {val}
              </text>
            </g>
          );
        })}

        {areaPath && <path d={areaPath} fill="url(#trustAreaGrad)" />}
        {coords.length > 1 && <path d={linePath} fill="none" stroke="#174F40" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />}

        {coords.map((pt, idx) => {
          const color = pt.score >= 80 ? '#26745C' : pt.score >= 60 ? '#D99A32' : '#C94B4B';
          const isHovered = hoveredIdx === idx;
          return (
            <g
              key={pt.id}
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
              style={{ cursor: 'pointer' }}
            >
              <circle cx={pt.x} cy={pt.y} r={isHovered ? 12 : 8} fill="transparent" />
              <circle cx={pt.x} cy={pt.y} r={isHovered ? 6 : 4.5} fill="#FFFFFF" stroke={color} strokeWidth="2.5" />
              {(idx === 0 || idx === coords.length - 1 || coords.length <= 6) && (
                <text x={pt.x} y={h - 9} textAnchor="middle" className="chart-axis-text">
                  {new Date(pt.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {active && (
        <p className="chart-footnote">
          <strong>Selected entry:</strong> {active.reason}
        </p>
      )}
    </div>
  );
}

export function ResourceBaselineChart({ baselines = [] }) {
  const maxFreq = Math.max(0.5, ...baselines.map((b) => Number(b.averageAccessFrequency) || 0));
  const maxCount = Math.max(1, ...baselines.map((b) => Number(b.accessCount) || 0));

  if (!baselines.length) {
    return <p className="chart-empty-note">No resource baseline vectors available for this application.</p>;
  }

  return (
    <div className="baseline-compare-chart" aria-label="Resource baseline frequency and call volume comparison">
      <div className="svg-chart-header">
        <div className="chart-legend-inline">
          <span><i style={{ background: '#26745C' }} />Baseline rate (/hr)</span>
          <span><i style={{ background: '#4D83B5' }} />Observed total calls</span>
        </div>
      </div>
      <div className="baseline-bars-list">
        {baselines.map((item) => {
          const freq = Number(item.averageAccessFrequency) || 0;
          const count = Number(item.accessCount) || 0;
          const freqPct = Math.min(100, (freq / maxFreq) * 100);
          const countPct = Math.min(100, (count / maxCount) * 100);
          return (
            <div className="baseline-bar-item" key={item.resource}>
              <div className="baseline-bar-label">
                <strong>{item.resource.charAt(0).toUpperCase() + item.resource.slice(1)}</strong>
                <span>{freq}/hr · {count} calls</span>
              </div>
              <div className="baseline-dual-tracks">
                <div className="baseline-track">
                  <i style={{ width: `${freq > 0 ? Math.max(4, freqPct) : 0}%`, background: '#26745C' }} />
                </div>
                <div className="baseline-track">
                  <i style={{ width: `${count > 0 ? Math.max(4, countPct) : 0}%`, background: '#4D83B5' }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function PostureTrendChart({ points = [] }) {
  const [hoveredIdx, setHoveredIdx] = useState(null);
  if (!points.length) {
    return <p className="chart-empty-note">No daily volume trend records available for the selected range.</p>;
  }

  const maxVal = Math.max(1, ...points.map((p) => (p.allowed || 0) + (p.blocked || 0)));
  const w = 640;
  const h = 190;
  const pad = { top: 14, right: 16, bottom: 28, left: 34 };
  const plotW = w - pad.left - pad.right;
  const plotH = h - pad.top - pad.bottom;
  const step = plotW / points.length;
  const barW = Math.max(4, Math.min(16, step * 0.48));
  const active = hoveredIdx !== null ? points[hoveredIdx] : null;
  const labelEvery = points.length > 14 ? 4 : points.length > 8 ? 2 : 1;

  return (
    <div className="svg-chart-wrap" aria-label="Security posture allowed versus blocked trend">
      <div className="svg-chart-header">
        <div className="chart-legend-inline">
          <span><i className="dot-allowed" />Allowed</span>
          <span><i className="dot-denied" />Blocked</span>
        </div>
        <span className="chart-readout">
          {active ? `${active.date}: ${active.allowed} allowed · ${active.blocked} blocked` : `${points.length}-day event cadence`}
        </span>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className="svg-chart" role="img" aria-label="Posture daily trend chart">
        {Array.from(new Set([0, Math.ceil(maxVal / 2), maxVal])).map((tick) => {
          const y = pad.top + plotH - (tick / maxVal) * plotH;
          return (
            <g key={`pt-${tick}`}>
              <line x1={pad.left} x2={w - pad.right} y1={y} y2={y} className="chart-grid-line" />
              <text x={pad.left - 8} y={y + 3.5} textAnchor="end" className="chart-axis-text">
                {tick}
              </text>
            </g>
          );
        })}

        {points.map((pt, idx) => {
          const cx = pad.left + step * idx + step / 2;
          const x = cx - barW / 2;
          const total = (pt.allowed || 0) + (pt.blocked || 0);
          const totalH = (total / maxVal) * plotH;
          const allowedH = total ? ((pt.allowed || 0) / total) * totalH : 0;
          const blockedH = total ? ((pt.blocked || 0) / total) * totalH : 0;
          const allowedY = pad.top + plotH - allowedH;
          const blockedY = allowedY - blockedH;

          return (
            <g
              key={pt.date}
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
            >
              <rect
                x={pad.left + step * idx}
                y={pad.top}
                width={step}
                height={plotH}
                fill={hoveredIdx === idx ? 'rgba(38,116,92,0.06)' : 'transparent'}
              />
              {total === 0 ? (
                <rect x={x} y={pad.top + plotH - 2} width={barW} height={2} fill="#DCE7E1" />
              ) : (
                <>
                  {pt.allowed > 0 && <rect x={x} y={allowedY} width={barW} height={Math.max(2, allowedH)} fill="#26745C" rx={pt.blocked > 0 ? 0 : 2.5} />}
                  {pt.blocked > 0 && <rect x={x} y={blockedY} width={barW} height={Math.max(2, blockedH)} fill="#C94B4B" rx="2.5" />}
                </>
              )}
              {idx % labelEvery === 0 && (
                <text x={cx} y={h - 8} textAnchor="middle" className="chart-axis-text">
                  {pt.date.slice(5)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

