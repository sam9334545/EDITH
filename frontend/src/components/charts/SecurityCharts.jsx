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

export function DnaThreatModelGraph() {
  return (
    <div className="dna-threat-diagram-wrap" aria-label="Behavioral DNA Detection Architecture and Drift Model">
      <svg
        viewBox="0 0 500 205"
        className="svg-chart"
        role="img"
        aria-label="Baseline vs Observed Telemetry Drift with Frequency Spike"
      >
        <defs>
          <linearGradient id="dnaDriftFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#C94B4B" stopOpacity="0.18" />
            <stop offset="60%" stopColor="#C94B4B" stopOpacity="0.05" />
            <stop offset="100%" stopColor="#C94B4B" stopOpacity="0.0" />
          </linearGradient>
          <filter id="dnaDropShadow" x="-10%" y="-10%" width="120%" height="130%">
            <feDropShadow dx="0" dy="1.5" stdDeviation="2" floodOpacity="0.08" />
          </filter>
        </defs>

        {/* Clean card background */}
        <rect x="0.5" y="0.5" width="499" height="204" rx="10" fill="#F8FAF9" stroke="#E2ECE7" />

        {/* Subtle coordinate grid lines */}
        <g stroke="#EDF2EE" strokeDasharray="2 3">
          <line x1="24" y1="45" x2="476" y2="45" />
          <line x1="24" y1="85" x2="476" y2="85" />
          <line x1="24" y1="125" x2="476" y2="125" />
          <line x1="120" y1="20" x2="120" y2="165" />
          <line x1="240" y1="20" x2="240" y2="165" />
          <line x1="360" y1="20" x2="360" y2="165" />
        </g>

        {/* Normal Tolerance Window shaded band */}
        <rect x="25" y="128" width="450" height="26" rx="4" fill="rgba(38, 116, 92, 0.08)" />

        {/* Stable 7-Day Baseline (green dashed line) */}
        <line x1="25" y1="141" x2="475" y2="141" stroke="#26745C" strokeWidth="1.8" strokeDasharray="4 4" />

        {/* Application Node / DNA Profile on Baseline */}
        <g transform="translate(85, 141)" filter="url(#dnaDropShadow)">
          <circle cx="0" cy="0" r="22" fill="#FFFFFF" stroke="#26745C" strokeWidth="2" />
          <text x="0" y="-3" textAnchor="middle" fill="#123D32" fontSize="7" fontWeight="700" letterSpacing="0.05em">
            APP NODE
          </text>
          <text x="0" y="7" textAnchor="middle" fill="#26745C" fontSize="5.5" fontWeight="600" letterSpacing="0.05em">
            DNA PROFILE
          </text>
        </g>

        {/* Drift Threshold (50 pts) horizontal dashed line & label */}
        <line x1="150" y1="64" x2="475" y2="64" stroke="#C94B4B" strokeWidth="1.2" strokeDasharray="3 3" opacity="0.8" />
        <g transform="translate(355, 55)">
          <rect x="0" y="0" width="118" height="18" rx="4" fill="#FFF5F5" stroke="#FECACA" strokeWidth="0.8" />
          <text x="59" y="12" textAnchor="middle" fill="#C94B4B" fontSize="7.5" fontWeight="700" letterSpacing="0.04em">
            DRIFT THRESHOLD (50 pts)
          </text>
        </g>

        {/* Observed Telemetry Drift filled curve area */}
        <path
          d="M 25 142 L 130 140 C 165 137, 195 90, 225 40 C 235 24, 248 24, 258 40 C 285 85, 315 136, 375 140 L 475 141 L 475 160 L 25 160 Z"
          fill="url(#dnaDriftFill)"
        />

        {/* Observed Telemetry Drift stroke */}
        <path
          d="M 25 142 L 130 140 C 165 137, 195 90, 225 40 C 235 24, 248 24, 258 40 C 285 85, 315 136, 375 140 L 475 141"
          fill="none"
          stroke="#C94B4B"
          strokeWidth="2.4"
          strokeLinecap="round"
        />

        {/* Peak Frequency Spike Node */}
        <g transform="translate(242, 28)">
          <circle cx="0" cy="0" r="13" fill="#C94B4B" opacity="0.18" />
          <circle cx="0" cy="0" r="8" fill="#C94B4B" stroke="#FFFFFF" strokeWidth="2" />
          <text x="0" y="3.5" textAnchor="middle" fill="#FFFFFF" fontSize="9" fontWeight="900">
            !
          </text>
        </g>

        {/* Peak Callout Badge */}
        <g transform="translate(258, 16)" filter="url(#dnaDropShadow)">
          <rect x="0" y="0" width="138" height="24" rx="4" fill="#FFFFFF" stroke="#FECACA" strokeWidth="1" />
          <text x="8" y="11" fill="#C94B4B" fontSize="7.5" fontWeight="800" letterSpacing="0.04em">
            FREQUENCY SPIKE DETECTED
          </text>
          <text x="8" y="20" fill="#6C7D76" fontSize="6.5">
            Velocity 3x &gt; 3.0x Baseline
          </text>
        </g>

        {/* Legend at bottom */}
        <g transform="translate(0, 185)">
          {/* Stable baseline */}
          <circle cx="72" cy="0" r="3.5" fill="#26745C" />
          <text x="81" y="3" fill="#475569" fontSize="8" fontWeight="500">
            Stable 7-Day Baseline
          </text>

          {/* Drift */}
          <circle cx="212" cy="0" r="3.5" fill="#C94B4B" />
          <text x="221" y="3" fill="#475569" fontSize="8" fontWeight="500">
            Observed Telemetry Drift
          </text>

          {/* Tolerance window */}
          <rect x="345" y="-4" width="12" height="8" rx="2" fill="rgba(38, 116, 92, 0.25)" />
          <text x="362" y="3" fill="#475569" fontSize="8" fontWeight="500">
            Normal Tolerance Window
          </text>
        </g>
      </svg>
    </div>
  );
}

export function AdaptiveTrustFlowChart({ score = 84, level = 'high' }) {
  const numericScore = Math.max(0, Math.min(100, Math.round(Number(score) || 84)));
  const circumference = 2 * Math.PI * 82; // ~515.22
  const strokeDashoffset = circumference * (1 - numericScore / 100);

  const levelColor = numericScore >= 75 ? '#26745C' : numericScore >= 50 ? '#D99A32' : '#C94B4B';
  const levelText = numericScore >= 75 ? 'HIGH TRUST' : numericScore >= 50 ? 'MODERATE' : 'RESTRICTED';

  return (
    <div className="adaptive-flowchart-svg-wrap" aria-label="Adaptive trust scoring continuous evaluation flow">
      <svg
        viewBox="0 0 1140 420"
        className="svg-chart"
        role="img"
        aria-label="Adaptive trust dynamic scoring architecture flowchart"
      >
        <defs>
          {/* Bold, prominent high-resolution flow markers */}
          <marker id="flowArrowGreen" viewBox="0 0 14 14" refX="10" refY="7" markerWidth="9" markerHeight="9" orient="auto">
            <path d="M 0 2 L 12 7 L 0 12 z" fill="#26745C" />
          </marker>
          <marker id="flowArrowAmber" viewBox="0 0 14 14" refX="10" refY="7" markerWidth="9" markerHeight="9" orient="auto">
            <path d="M 0 2 L 12 7 L 0 12 z" fill="#D99A32" />
          </marker>
          <marker id="flowArrowRed" viewBox="0 0 14 14" refX="10" refY="7" markerWidth="9" markerHeight="9" orient="auto">
            <path d="M 0 2 L 12 7 L 0 12 z" fill="#C94B4B" />
          </marker>
          <filter id="flowCardShadow" x="-10%" y="-10%" width="125%" height="135%">
            <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#123D32" floodOpacity="0.08" />
          </filter>
        </defs>

        {/* Flow Connectors: Left side (Positive / Green) flowing into center */}
        {/* Top left card -> Center gauge top-left */}
        <path
          d="M 300 69 C 390 69, 420 120, 474 142"
          fill="none"
          stroke="#26745C"
          strokeWidth="3.2"
          strokeDasharray="7 5"
          markerEnd="url(#flowArrowGreen)"
        />

        {/* Middle left card -> Center gauge middle-left */}
        <path
          d="M 300 210 C 370 210, 410 210, 460 210"
          fill="none"
          stroke="#26745C"
          strokeWidth="3.2"
          strokeDasharray="7 5"
          markerEnd="url(#flowArrowGreen)"
        />

        {/* Bottom left card -> Center gauge bottom-left */}
        <path
          d="M 300 351 C 390 351, 420 300, 474 278"
          fill="none"
          stroke="#26745C"
          strokeWidth="3.2"
          strokeDasharray="7 5"
          markerEnd="url(#flowArrowGreen)"
        />

        {/* Flow Connectors: Right side (Negative / Red & Amber) flowing from cards to center */}
        {/* Top right card -> Center gauge top-right */}
        <path
          d="M 840 69 C 750 69, 720 120, 666 142"
          fill="none"
          stroke="#D99A32"
          strokeWidth="3.2"
          strokeDasharray="7 5"
          markerEnd="url(#flowArrowAmber)"
        />

        {/* Middle right card -> Center gauge middle-right */}
        <path
          d="M 840 210 C 770 210, 730 210, 680 210"
          fill="none"
          stroke="#C94B4B"
          strokeWidth="3.2"
          strokeDasharray="7 5"
          markerEnd="url(#flowArrowRed)"
        />

        {/* Bottom right card -> Center gauge bottom-right */}
        <path
          d="M 840 351 C 750 351, 720 300, 666 278"
          fill="none"
          stroke="#C94B4B"
          strokeWidth="3.2"
          strokeDasharray="7 5"
          markerEnd="url(#flowArrowRed)"
        />

        {/* ================= LEFT CARDS (Positive Rebuilding) ================= */}
        {/* Card 1: Clean Usage Streak */}
        <g transform="translate(25, 25)" filter="url(#flowCardShadow)">
          <rect x="0" y="0" width="275" height="88" rx="14" fill="#FFFFFF" stroke="#DCE7E1" strokeWidth="1.8" />
          <circle cx="40" cy="44" r="24" fill="#E4F2EC" />
          <text x="40" y="53" textAnchor="middle" fill="#26745C" fontSize="26" fontWeight="700">+</text>
          <text x="76" y="38" fill="#182A25" fontSize="16" fontWeight="700">Clean Usage Streak</text>
          <text x="76" y="62" fill="#5A6E65" fontSize="13">10 clean requests: +2 pts</text>
        </g>

        {/* Card 2: Corrective Action */}
        <g transform="translate(25, 166)" filter="url(#flowCardShadow)">
          <rect x="0" y="0" width="275" height="88" rx="14" fill="#FFFFFF" stroke="#DCE7E1" strokeWidth="1.8" />
          <circle cx="40" cy="44" r="24" fill="#E4F2EC" />
          <text x="40" y="51" textAnchor="middle" fill="#26745C" fontSize="22" fontWeight="700">✓</text>
          <text x="76" y="38" fill="#182A25" fontSize="16" fontWeight="700">Corrective Action</text>
          <text x="76" y="62" fill="#5A6E65" fontSize="13">Policy remediation: +5 pts</text>
        </g>

        {/* Card 3: Administrative Credit */}
        <g transform="translate(25, 307)" filter="url(#flowCardShadow)">
          <rect x="0" y="0" width="275" height="88" rx="14" fill="#FFFFFF" stroke="#DCE7E1" strokeWidth="1.8" />
          <circle cx="40" cy="44" r="24" fill="#E4F2EC" />
          <text x="40" y="51" textAnchor="middle" fill="#26745C" fontSize="22" fontWeight="700">⚡</text>
          <text x="76" y="38" fill="#182A25" fontSize="16" fontWeight="700">Administrative Credit</text>
          <text x="76" y="62" fill="#5A6E65" fontSize="13">Audited override: +1-50 pts</text>
        </g>

        {/* ================= CENTER CIRCULAR TRUST GAUGE ================= */}
        <g transform="translate(570, 210)" filter="url(#flowCardShadow)">
          <circle cx="0" cy="0" r="100" fill="#FFFFFF" stroke="#D2E3DA" strokeWidth="2.5" />
          {/* Background track */}
          <circle cx="0" cy="0" r="82" fill="none" stroke="#E4F2EC" strokeWidth="12" />
          {/* Progress arc */}
          <circle
            cx="0"
            cy="0"
            r="82"
            fill="none"
            stroke={levelColor}
            strokeWidth="12"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            transform="rotate(-90 0 0)"
          />
          {/* Score & Labels */}
          <text x="0" y="-8" textAnchor="middle" fill="#123D32" fontSize="56" fontWeight="800">
            {numericScore}
          </text>
          <text x="0" y="24" textAnchor="middle" fill={levelColor} fontSize="15" fontWeight="700" letterSpacing="0.08em">
            {levelText}
          </text>
          <text x="0" y="45" textAnchor="middle" fill="#6C7D76" fontSize="12">
            Score Ceiling: 100
          </text>
        </g>

        {/* ================= RIGHT CARDS (Penalties & Escalation) ================= */}
        {/* Card 1: Excessive Access */}
        <g transform="translate(840, 25)" filter="url(#flowCardShadow)">
          <rect x="0" y="0" width="275" height="88" rx="14" fill="#FFFFFF" stroke="#FDE68A" strokeWidth="1.8" />
          <circle cx="40" cy="44" r="24" fill="#FEF3C7" />
          <text x="40" y="53" textAnchor="middle" fill="#D99A32" fontSize="28" fontWeight="800">–</text>
          <text x="76" y="38" fill="#182A25" fontSize="16" fontWeight="700">Excessive Access</text>
          <text x="76" y="62" fill="#5A6E65" fontSize="13">&gt;10 req/min: -15 pts</text>
        </g>

        {/* Card 2: Repeated Violation */}
        <g transform="translate(840, 166)" filter="url(#flowCardShadow)">
          <rect x="0" y="0" width="275" height="88" rx="14" fill="#FFFFFF" stroke="#FECACA" strokeWidth="1.8" />
          <circle cx="40" cy="44" r="24" fill="#FEE2E2" />
          <text x="40" y="51" textAnchor="middle" fill="#C94B4B" fontSize="22" fontWeight="800">!</text>
          <text x="76" y="38" fill="#182A25" fontSize="16" fontWeight="700">Repeated Violation</text>
          <text x="76" y="62" fill="#5A6E65" fontSize="13">1.5x Multiplier Escalation</text>
        </g>

        {/* Card 3: Unauthorized Resource */}
        <g transform="translate(840, 307)" filter="url(#flowCardShadow)">
          <rect x="0" y="0" width="275" height="88" rx="14" fill="#FFFFFF" stroke="#FECACA" strokeWidth="1.8" />
          <circle cx="40" cy="44" r="24" fill="#FEE2E2" />
          <text x="40" y="52" textAnchor="middle" fill="#C94B4B" fontSize="22" fontWeight="800">×</text>
          <text x="76" y="38" fill="#182A25" fontSize="16" fontWeight="700">Unauthorized Resource</text>
          <text x="76" y="62" fill="#5A6E65" fontSize="13">Disabled access: -8 pts</text>
        </g>
      </svg>
    </div>
  );
}


