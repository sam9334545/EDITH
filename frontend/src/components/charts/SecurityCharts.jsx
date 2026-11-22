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
        viewBox="0 0 540 240"
        className="svg-chart"
        role="img"
        aria-label="Baseline vs Observed Telemetry Drift with Frequency Spike"
      >
        <defs>
          <linearGradient id="dnaDriftFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#C94B4B" stopOpacity="0.22" />
            <stop offset="50%" stopColor="#C94B4B" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#C94B4B" stopOpacity="0.0" />
          </linearGradient>
          <filter id="dnaDropShadow" x="-10%" y="-10%" width="125%" height="135%">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#123D32" floodOpacity="0.10" />
          </filter>
        </defs>

        {/* Subtle coordinate grid lines */}
        <g stroke="#E5ECE8" strokeDasharray="3 3" strokeWidth="1">
          <line x1="20" y1="50" x2="520" y2="50" />
          <line x1="20" y1="95" x2="520" y2="95" />
          <line x1="20" y1="140" x2="520" y2="140" />
          <line x1="135" y1="20" x2="135" y2="195" />
          <line x1="270" y1="20" x2="270" y2="195" />
          <line x1="405" y1="20" x2="405" y2="195" />
        </g>

        {/* Normal Tolerance Window shaded band */}
        <rect x="20" y="150" width="500" height="32" rx="6" fill="rgba(38, 116, 92, 0.08)" stroke="rgba(38, 116, 92, 0.22)" strokeDasharray="3 3" />

        {/* Stable 7-Day Baseline (green dashed line) */}
        <line x1="20" y1="166" x2="520" y2="166" stroke="#26745C" strokeWidth="2.2" strokeDasharray="5 4" />

        {/* Application Node / DNA Profile on Baseline */}
        <g transform="translate(85, 166)" filter="url(#dnaDropShadow)">
          <circle cx="0" cy="0" r="26" fill="#FFFFFF" stroke="#26745C" strokeWidth="2.5" />
          <text x="0" y="-4" textAnchor="middle" fill="#123D32" fontSize="9.5" fontWeight="800" letterSpacing="0.06em">
            APP NODE
          </text>
          <text x="0" y="9" textAnchor="middle" fill="#26745C" fontSize="8" fontWeight="700" letterSpacing="0.04em">
            DNA PROFILE
          </text>
        </g>

        {/* Drift Threshold (50 req) horizontal dashed line & label */}
        <line x1="150" y1="88" x2="520" y2="88" stroke="#C94B4B" strokeWidth="1.5" strokeDasharray="4 4" opacity="0.85" />
        <g transform="translate(370, 75)" filter="url(#dnaDropShadow)">
          <rect x="0" y="0" width="145" height="24" rx="6" fill="#FFF5F5" stroke="#FECACA" strokeWidth="1.2" />
          <text x="72.5" y="16" textAnchor="middle" fill="#C94B4B" fontSize="9.5" fontWeight="800" letterSpacing="0.04em">
            DRIFT THRESHOLD (50 req)
          </text>
        </g>

        {/* Observed Telemetry Drift filled curve area */}
        <path
          d="M 20 166 L 140 165 C 185 160, 215 105, 255 52 C 265 34, 278 34, 288 52 C 320 105, 355 160, 420 165 L 520 166 L 520 190 L 20 190 Z"
          fill="url(#dnaDriftFill)"
        />

        {/* Observed Telemetry Drift stroke */}
        <path
          d="M 20 166 L 140 165 C 185 160, 215 105, 255 52 C 265 34, 278 34, 288 52 C 320 105, 355 160, 420 165 L 520 166"
          fill="none"
          stroke="#C94B4B"
          strokeWidth="3"
          strokeLinecap="round"
        />

        {/* Peak Frequency Spike Node */}
        <g transform="translate(272, 38)">
          <circle cx="0" cy="0" r="16" fill="#C94B4B" opacity="0.18" />
          <circle cx="0" cy="0" r="10" fill="#C94B4B" stroke="#FFFFFF" strokeWidth="2.5" />
          <text x="0" y="4.5" textAnchor="middle" fill="#FFFFFF" fontSize="12" fontWeight="900">
            !
          </text>
        </g>

        {/* Peak Callout Badge */}
        <g transform="translate(295, 20)" filter="url(#dnaDropShadow)">
          <rect x="0" y="0" width="180" height="34" rx="6" fill="#FFFFFF" stroke="#FECACA" strokeWidth="1.2" />
          <text x="10" y="15" fill="#C94B4B" fontSize="9.5" fontWeight="800" letterSpacing="0.04em">
            FREQUENCY SPIKE DETECTED
          </text>
          <text x="10" y="27" fill="#5A6E65" fontSize="8.5" fontWeight="600">
            Velocity 84 &gt; 3.0x Baseline (10 req/s)
          </text>
        </g>

        {/* Legend at bottom */}
        <g transform="translate(0, 222)">
          {/* Stable baseline */}
          <circle cx="65" cy="0" r="4.5" fill="#26745C" />
          <text x="76" y="4" fill="#334155" fontSize="10" fontWeight="600">
            Stable 7-Day Baseline
          </text>

          {/* Drift */}
          <circle cx="230" cy="0" r="4.5" fill="#C94B4B" />
          <text x="241" y="4" fill="#334155" fontSize="10" fontWeight="600">
            Observed Telemetry Drift
          </text>

          {/* Tolerance window */}
          <rect x="390" y="-5" width="14" height="10" rx="3" fill="rgba(38, 116, 92, 0.3)" />
          <text x="410" y="4" fill="#334155" fontSize="10" fontWeight="600">
            Normal Tolerance Window
          </text>
        </g>
      </svg>
    </div>
  );
}

export function AdaptiveTrustFlowChart({ score = 84, level = 'high' }) {
  const numericScore = Math.max(0, Math.min(100, Math.round(Number(score) || 84)));
  const circumference = 2 * Math.PI * 92; // ~578.05
  const strokeDashoffset = circumference * (1 - numericScore / 100);

  const levelColor = numericScore >= 75 ? '#26745C' : numericScore >= 50 ? '#D99A32' : '#C94B4B';
  const levelText = numericScore >= 75 ? 'HIGH TRUST' : numericScore >= 50 ? 'MODERATE' : 'RESTRICTED';

  return (
    <div className="adaptive-flowchart-svg-wrap" aria-label="Adaptive trust scoring continuous evaluation flow">
      <svg
        viewBox="0 0 1200 460"
        className="svg-chart"
        role="img"
        aria-label="Adaptive trust dynamic scoring architecture flowchart"
      >
        <defs>
          {/* High-visibility flow markers */}
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
            <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="#123D32" floodOpacity="0.08" />
          </filter>
        </defs>

        {/* ================= FLOW CONNECTORS ================= */}
        {/* Left Side: Positive Rebuilding connectors into Center Gauge */}
        {/* Card 1 (Streak) -> Center Top-Left */}
        <path
          d="M 350 74 C 440 74, 465 125, 498 152"
          fill="none"
          stroke="#26745C"
          strokeWidth="3.2"
          strokeDasharray="7 5"
          markerEnd="url(#flowArrowGreen)"
        />
        {/* Pill Badge on Card 1 path */}
        <g transform="translate(415, 88)">
          <rect x="0" y="0" width="56" height="22" rx="11" fill="#E4F2EC" stroke="#26745C" strokeWidth="1" />
          <text x="28" y="15" textAnchor="middle" fill="#26745C" fontSize="11" fontWeight="800">+2 pts</text>
        </g>

        {/* Card 2 (Corrective) -> Center Middle-Left */}
        <path
          d="M 350 230 C 400 230, 440 230, 482 230"
          fill="none"
          stroke="#26745C"
          strokeWidth="3.2"
          strokeDasharray="7 5"
          markerEnd="url(#flowArrowGreen)"
        />
        {/* Pill Badge on Card 2 path */}
        <g transform="translate(398, 206)">
          <rect x="0" y="0" width="56" height="22" rx="11" fill="#E4F2EC" stroke="#26745C" strokeWidth="1" />
          <text x="28" y="15" textAnchor="middle" fill="#26745C" fontSize="11" fontWeight="800">+5 pts</text>
        </g>

        {/* Card 3 (Admin Credit) -> Center Bottom-Left */}
        <path
          d="M 350 386 C 440 386, 465 335, 498 308"
          fill="none"
          stroke="#26745C"
          strokeWidth="3.2"
          strokeDasharray="7 5"
          markerEnd="url(#flowArrowGreen)"
        />
        {/* Pill Badge on Card 3 path */}
        <g transform="translate(412, 350)">
          <rect x="0" y="0" width="62" height="22" rx="11" fill="#E4F2EC" stroke="#26745C" strokeWidth="1" />
          <text x="31" y="15" textAnchor="middle" fill="#26745C" fontSize="11" fontWeight="800">+Override</text>
        </g>

        {/* Right Side: Penalties & Degradation connectors from Right Cards to Center Gauge */}
        {/* Card 1 (Excessive) -> Center Top-Right */}
        <path
          d="M 850 74 C 760 74, 735 125, 702 152"
          fill="none"
          stroke="#D99A32"
          strokeWidth="3.2"
          strokeDasharray="7 5"
          markerEnd="url(#flowArrowAmber)"
        />
        {/* Pill Badge on Card 1 path */}
        <g transform="translate(730, 88)">
          <rect x="0" y="0" width="58" height="22" rx="11" fill="#FEF3C7" stroke="#D99A32" strokeWidth="1" />
          <text x="29" y="15" textAnchor="middle" fill="#B45309" fontSize="11" fontWeight="800">-15 pts</text>
        </g>

        {/* Card 2 (Repeated Violation) -> Center Middle-Right */}
        <path
          d="M 850 230 C 800 230, 760 230, 718 230"
          fill="none"
          stroke="#C94B4B"
          strokeWidth="3.2"
          strokeDasharray="7 5"
          markerEnd="url(#flowArrowRed)"
        />
        {/* Pill Badge on Card 2 path */}
        <g transform="translate(745, 206)">
          <rect x="0" y="0" width="56" height="22" rx="11" fill="#FEE2E2" stroke="#C94B4B" strokeWidth="1" />
          <text x="28" y="15" textAnchor="middle" fill="#C94B4B" fontSize="11" fontWeight="800">x1.5</text>
        </g>

        {/* Card 3 (Unauthorized Resource) -> Center Bottom-Right */}
        <path
          d="M 850 386 C 760 386, 735 335, 702 308"
          fill="none"
          stroke="#C94B4B"
          strokeWidth="3.2"
          strokeDasharray="7 5"
          markerEnd="url(#flowArrowRed)"
        />
        {/* Pill Badge on Card 3 path */}
        <g transform="translate(730, 350)">
          <rect x="0" y="0" width="58" height="22" rx="11" fill="#FEE2E2" stroke="#C94B4B" strokeWidth="1" />
          <text x="29" y="15" textAnchor="middle" fill="#C94B4B" fontSize="11" fontWeight="800">-8 pts</text>
        </g>

        {/* ================= LEFT CARDS (Positive Rebuilding) ================= */}
        {/* Card 1: Clean Usage Streak */}
        <g transform="translate(30, 25)" filter="url(#flowCardShadow)">
          <rect x="0" y="0" width="320" height="98" rx="16" fill="#FFFFFF" stroke="#D2E3DA" strokeWidth="2" />
          <circle cx="44" cy="49" r="26" fill="#E4F2EC" />
          <text x="44" y="58" textAnchor="middle" fill="#26745C" fontSize="28" fontWeight="800">+</text>
          <text x="84" y="42" fill="#123D32" fontSize="17" fontWeight="700">Clean Usage Streak</text>
          <text x="84" y="68" fill="#5A6E65" fontSize="13">10 clean requests: +2 pts</text>
          <rect x="232" y="18" width="74" height="24" rx="12" fill="#EAF6F0" stroke="#BFE0D1" strokeWidth="1" />
          <text x="269" y="34" textAnchor="middle" fill="#26745C" fontSize="11.5" fontWeight="700">+2 PTS</text>
        </g>

        {/* Card 2: Corrective Action */}
        <g transform="translate(30, 181)" filter="url(#flowCardShadow)">
          <rect x="0" y="0" width="320" height="98" rx="16" fill="#FFFFFF" stroke="#D2E3DA" strokeWidth="2" />
          <circle cx="44" cy="49" r="26" fill="#E4F2EC" />
          <text x="44" y="56" textAnchor="middle" fill="#26745C" fontSize="24" fontWeight="800">✓</text>
          <text x="84" y="42" fill="#123D32" fontSize="17" fontWeight="700">Corrective Action</text>
          <text x="84" y="68" fill="#5A6E65" fontSize="13">Policy remediation: +5 pts</text>
          <rect x="232" y="18" width="74" height="24" rx="12" fill="#EAF6F0" stroke="#BFE0D1" strokeWidth="1" />
          <text x="269" y="34" textAnchor="middle" fill="#26745C" fontSize="11.5" fontWeight="700">+5 PTS</text>
        </g>

        {/* Card 3: Administrative Credit */}
        <g transform="translate(30, 337)" filter="url(#flowCardShadow)">
          <rect x="0" y="0" width="320" height="98" rx="16" fill="#FFFFFF" stroke="#D2E3DA" strokeWidth="2" />
          <circle cx="44" cy="49" r="26" fill="#E4F2EC" />
          <text x="44" y="57" textAnchor="middle" fill="#26745C" fontSize="24" fontWeight="800">⚡</text>
          <text x="84" y="42" fill="#123D32" fontSize="17" fontWeight="700">Administrative Credit</text>
          <text x="84" y="68" fill="#5A6E65" fontSize="13">Audited override: +1–50 pts</text>
          <rect x="232" y="18" width="74" height="24" rx="12" fill="#EAF6F0" stroke="#BFE0D1" strokeWidth="1" />
          <text x="269" y="34" textAnchor="middle" fill="#26745C" fontSize="11.5" fontWeight="700">+RESTORE</text>
        </g>

        {/* ================= CENTER CIRCULAR TRUST GAUGE ================= */}
        <g transform="translate(600, 230)" filter="url(#flowCardShadow)">
          <circle cx="0" cy="0" r="112" fill="#FFFFFF" stroke="#CFE2D8" strokeWidth="2.5" />
          {/* Background track */}
          <circle cx="0" cy="0" r="92" fill="none" stroke="#E4F2EC" strokeWidth="14" />
          {/* Progress arc */}
          <circle
            cx="0"
            cy="0"
            r="92"
            fill="none"
            stroke={levelColor}
            strokeWidth="14"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            transform="rotate(-90 0 0)"
          />
          {/* Score & Labels */}
          <text x="0" y="-10" textAnchor="middle" fill="#123D32" fontSize="62" fontWeight="900">
            {numericScore}
          </text>
          <text x="0" y="24" textAnchor="middle" fill={levelColor} fontSize="16" fontWeight="800" letterSpacing="0.08em">
            {levelText}
          </text>
          <text x="0" y="47" textAnchor="middle" fill="#6C7D76" fontSize="13" fontWeight="600">
            Score Ceiling: 100
          </text>
        </g>

        {/* ================= RIGHT CARDS (Penalties & Escalation) ================= */}
        {/* Card 1: Excessive Access */}
        <g transform="translate(850, 25)" filter="url(#flowCardShadow)">
          <rect x="0" y="0" width="320" height="98" rx="16" fill="#FFFFFF" stroke="#FDE68A" strokeWidth="2" />
          <circle cx="44" cy="49" r="26" fill="#FEF3C7" />
          <text x="44" y="59" textAnchor="middle" fill="#D99A32" fontSize="30" fontWeight="900">–</text>
          <text x="84" y="42" fill="#182A25" fontSize="17" fontWeight="700">Excessive Access</text>
          <text x="84" y="68" fill="#5A6E65" fontSize="13">&gt;10 req/min: -15 pts</text>
          <rect x="232" y="18" width="74" height="24" rx="12" fill="#FEF3C7" stroke="#FCD34D" strokeWidth="1" />
          <text x="269" y="34" textAnchor="middle" fill="#B45309" fontSize="11.5" fontWeight="700">-15 PTS</text>
        </g>

        {/* Card 2: Repeated Violation */}
        <g transform="translate(850, 181)" filter="url(#flowCardShadow)">
          <rect x="0" y="0" width="320" height="98" rx="16" fill="#FFFFFF" stroke="#FECACA" strokeWidth="2" />
          <circle cx="44" cy="49" r="26" fill="#FEE2E2" />
          <text x="44" y="57" textAnchor="middle" fill="#C94B4B" fontSize="24" fontWeight="900">!</text>
          <text x="84" y="42" fill="#182A25" fontSize="17" fontWeight="700">Repeated Violation</text>
          <text x="84" y="68" fill="#5A6E65" fontSize="13">1.5x Multiplier Escalation</text>
          <rect x="232" y="18" width="74" height="24" rx="12" fill="#FEE2E2" stroke="#FCA5A5" strokeWidth="1" />
          <text x="269" y="34" textAnchor="middle" fill="#C94B4B" fontSize="11.5" fontWeight="700">x1.5</text>
        </g>

        {/* Card 3: Unauthorized Resource */}
        <g transform="translate(850, 337)" filter="url(#flowCardShadow)">
          <rect x="0" y="0" width="320" height="98" rx="16" fill="#FFFFFF" stroke="#FECACA" strokeWidth="2" />
          <circle cx="44" cy="49" r="26" fill="#FEE2E2" />
          <text x="44" y="58" textAnchor="middle" fill="#C94B4B" fontSize="24" fontWeight="900">×</text>
          <text x="84" y="42" fill="#182A25" fontSize="17" fontWeight="700">Unauthorized Resource</text>
          <text x="84" y="68" fill="#5A6E65" fontSize="13">Disabled access: -8 pts</text>
          <rect x="232" y="18" width="74" height="24" rx="12" fill="#FEE2E2" stroke="#FCA5A5" strokeWidth="1" />
          <text x="269" y="34" textAnchor="middle" fill="#C94B4B" fontSize="11.5" fontWeight="700">-8 PTS</text>
        </g>
      </svg>
    </div>
  );
}


