import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ACCESS_STATUS, ACTIVITY_EVENT_TYPES, ALERT_SEVERITY, ALERT_TYPES, APPLICATION_STATUS,
  FINDING_STATUS, POSTURE_FINDING_TYPES, POSTURE_RISK_LEVELS, RECOMMENDATION_STATUS, RESOURCE_TYPES,
} from '@shared/contracts.js';
import { api } from '../services/api.js';
import AppMark from '../components/common/AppMark.jsx';
import EmptyState from '../components/common/EmptyState.jsx';
import LoadingState from '../components/common/LoadingState.jsx';
import PageHeader from '../components/common/PageHeader.jsx';
import Panel from '../components/common/Panel.jsx';
import StatusBadge from '../components/common/StatusBadge.jsx';
import TrustRing from '../components/common/TrustRing.jsx';
import PermissionGrid from '../components/security/PermissionGrid.jsx';
import {
  ALERT_LABELS, EVENT_LABELS, RESOURCE_LABELS, AlertRows, ApiUnavailable, Button, ErrorBlock,
  Icon, Pagination, SelectField, TextField, activityTone, appName, formatDate, humanize,
  levelLabel, usePagedRows,
} from '../components/common/LegacyControls.jsx';

export function TrustPage({ apps, selectedAppId, setSelectedAppId, selectedApp, trustData, trustError, events }) {
  const score = selectedApp?.trustScore;
  const level = selectedApp?.trustLevel;
  const historyData = trustData?.history || [];
  const maxScore = Math.max(100, ...historyData.map((item) => item.newScore || 0));

  return (
    <>
      <PageHeader eyebrow="Continuous evaluation" title="Trust analysis" description="Understand backend-calculated application trust and the recorded reasons behind changes." />
      <div className="trust-controls">
        <SelectField label="Application" value={selectedAppId} onChange={setSelectedAppId} options={apps.map((app) => ({ value: app.id, label: app.name }))} />
        {selectedApp && <StatusBadge tone={`trust-${level || 'unknown'}`}>{levelLabel(level)} trust</StatusBadge>}
      </div>
      {selectedApp ? (
        <div className="trust-analysis-grid">
          <Panel title="Current trust score" eyebrow={selectedApp.name} className="trust-score-panel">
            <div className="trust-score-content">
              <TrustRing score={score} level={level} />
              <div>
                <StatusBadge tone={`trust-${level || 'unknown'}`}>{levelLabel(level)}</StatusBadge>
                <p>The value shown is supplied by the backend. Trust thresholds: High 80–100, Moderate 60–79, Low 40–59, Critical 0–39.</p>
              </div>
            </div>
          </Panel>
          <Panel title="Score history" eyebrow="Backend record">
            {trustError ? <ErrorBlock error={trustError} endpoint="Trust score history" /> : trustData ? (
              historyData.length ? (
                <div className="score-history-list">
                  {historyData.map((item) => (
                    <article key={item.id} className="score-history-row">
                      <span className="score-history-change">{item.previousScore} <i>→</i> {item.newScore}</span>
                      <div><strong>{item.changeReason}</strong><time>{formatDate(item.timestamp)}</time></div>
                    </article>
                  ))}
                </div>
              ) : <EmptyState title="No score history">The backend returned no trust adjustments for this application.</EmptyState>
            ) : <LoadingState label="Loading backend score history" />}
          </Panel>
          <Panel title="Adjustment insights" eyebrow="No client-side scoring">
            {trustError ? <ErrorBlock error={trustError} endpoint="Trust score detail" /> : trustData ? (
              <ul className="explanation-list">
                {(trustData.explanation || []).map((line, index) => <li key={`${index}-${line}`}>{line}</li>)}
              </ul>
            ) : <p className="panel-note">Detailed trust history requires the security score endpoint. The {events.length} access records are not used to recalculate scores in the browser.</p>}
          </Panel>
          <Panel title="Score movement" eyebrow="Recorded changes">
            {trustError ? <ErrorBlock error={trustError} endpoint="Trust score history" /> : (
              historyData.length
                ? <ScoreChart records={historyData} maxScore={maxScore} />
                : <EmptyState title="No score movement">A trend chart will appear when the backend returns score history.</EmptyState>
            )}
          </Panel>
        </div>
      ) : <EmptyState title="No applications available">Connect to the backend to review trust scores.</EmptyState>}
    </>
  );
}

export function ScoreChart({ records, maxScore }) {
  const points = records.slice().reverse();
  return (
    <div className="score-change-chart">
      {points.map((item) => (
        <div className="score-change-column" key={item.id}>
          <div className="score-change-track">
            <i style={{ height: `${Math.min(100, Math.max(0, (item.newScore / maxScore) * 100))}%` }} />
          </div>
          <span>{item.newScore}</span>
          <small>{new Date(item.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</small>
        </div>
      ))}
    </div>
  );
}
