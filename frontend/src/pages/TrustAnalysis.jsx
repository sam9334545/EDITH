import { RefreshCw } from 'lucide-react';
import AppMark from '../components/common/AppMark.jsx';
import EmptyState from '../components/common/EmptyState.jsx';
import LoadingState from '../components/common/LoadingState.jsx';
import PageHeader from '../components/common/PageHeader.jsx';
import Panel from '../components/common/Panel.jsx';
import StatusBadge from '../components/common/StatusBadge.jsx';
import TrustRing from '../components/common/TrustRing.jsx';
import { TrustDistributionChart, TrustTrajectoryChart } from '../components/charts/SecurityCharts.jsx';
import { ErrorBlock, SelectField, formatDate, levelLabel } from '../components/common/LegacyControls.jsx';

export function TrustPage({
  apps = [],
  selectedAppId,
  setSelectedAppId,
  selectedApp,
  trustData,
  trustError,
  events = [],
  onRefresh,
}) {
  const score = selectedApp?.trustScore;
  const level = selectedApp?.trustLevel;
  const historyData = trustData?.history || [];

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Continuous mathematical trust scoring"
        title="Trust analysis"
        description="Inspect backend-computed trust scores, workspace distribution tiers, and audited score change explanations."
        actions={onRefresh && (
          <button type="button" className="button" onClick={onRefresh}>
            <RefreshCw size={14} aria-hidden="true" /> Refresh scores
          </button>
        )}
      />

      <div className="trust-controls-panel">
        <SelectField
          label="Inspect application"
          value={selectedAppId}
          onChange={setSelectedAppId}
          options={apps.map((app) => ({ value: app.id, label: `${app.name} (${app.trustScore ?? '—'}/100)` }))}
        />
        {selectedApp && (
          <div className="selected-app-pill-row">
            <AppMark name={selectedApp.name} size="sm" />
            <span>{selectedApp.name}</span>
            <StatusBadge tone={`trust-${level || 'unknown'}`}>{levelLabel(level)} trust</StatusBadge>
          </div>
        )}
      </div>

      {selectedApp ? (
        <div className="trust-analysis-grid">
          <Panel title="Current trust standing" eyebrow={selectedApp.name} className="trust-score-panel">
            <div className="trust-score-content">
              <TrustRing score={score} level={level} />
              <div>
                <StatusBadge tone={`trust-${level || 'unknown'}`}>{levelLabel(level)} Trust</StatusBadge>
                <p>
                  All trust calculations occur on the backend: High (80–100), Moderate (60–79), Low (40–59), Critical (0–39). Penalties deduct by severity (-3 Low, -8 Medium, -15 High, -25 Critical).
                </p>
              </div>
            </div>
          </Panel>

          <Panel title="Workspace trust distribution" eyebrow={`${apps.length} registered applications`}>
            {apps.length ? (
              <TrustDistributionChart apps={apps} />
            ) : (
              <EmptyState title="No application data">Distribution appears once applications load.</EmptyState>
            )}
          </Panel>

          <Panel title="Score movement trajectory" eyebrow="Chronological backend changes">
            {trustError ? (
              <ErrorBlock error={trustError} endpoint="Trust score history" />
            ) : trustData ? (
              <TrustTrajectoryChart records={historyData} />
            ) : (
              <LoadingState label="Loading backend score trajectory" />
            )}
          </Panel>

          <Panel title="Score history ledger" eyebrow="Persisted audit entries">
            {trustError ? (
              <ErrorBlock error={trustError} endpoint="Trust score history" />
            ) : trustData ? (
              historyData.length ? (
                <div className="score-history-list">
                  {historyData.map((item) => {
                    const delta = (item.newScore ?? 0) - (item.previousScore ?? 0);
                    return (
                      <article key={item.id} className="score-history-row">
                        <div className="score-history-badges">
                          <span className="score-history-change mono-num">
                            {item.previousScore} <i>→</i> {item.newScore}
                          </span>
                          <StatusBadge tone={delta < 0 ? 'danger' : delta > 0 ? 'success' : 'neutral'}>
                            {delta > 0 ? `+${delta}` : delta}
                          </StatusBadge>
                        </div>
                        <div>
                          <strong>{item.changeReason}</strong>
                          <time>{formatDate(item.timestamp)}</time>
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <EmptyState title="No score history">
                  The backend returned no trust adjustments for this application.
                </EmptyState>
              )
            ) : (
              <LoadingState label="Loading backend score history" />
            )}
          </Panel>

          <Panel title="Adjustment insights" eyebrow="Backend explainability" className="span-full">
            {trustError ? (
              <ErrorBlock error={trustError} endpoint="Trust score detail" />
            ) : trustData ? (
              <ul className="explanation-list">
                {(trustData.explanation || []).map((line, index) => (
                  <li key={`${index}-${line}`}>{line}</li>
                ))}
              </ul>
            ) : (
              <p className="panel-note">
                Detailed trust history requires the security score endpoint. The {events.length} access records are not used to recalculate scores in the browser.
              </p>
            )}
          </Panel>
        </div>
      ) : (
        <EmptyState title="No applications available">
          Connect to the backend to review trust scores.
        </EmptyState>
      )}
    </div>
  );
}

export function ScoreChart({ records, maxScore }) {
  return <TrustTrajectoryChart records={records} maxScore={maxScore} />;
}
