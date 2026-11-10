import MainLayout from './components/layout/MainLayout.jsx';
import { ConfirmationModal } from './components/common/ConfirmationModal.jsx';
import { useApplicationController } from './hooks/useApplicationController.js';
import SecurityFindings from './pages/SecurityFindings.jsx';
import IncidentDetails from './pages/IncidentDetails.jsx';
import PolicyManagement from './pages/PolicyManagement.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Applications from './pages/Applications.jsx';
import ApplicationDetails from './pages/ApplicationDetails.jsx';
import PermissionManagement from './pages/PermissionManagement.jsx';
import { HistoryPage } from './pages/History.jsx';
import { MonitoringPage } from './pages/Monitoring.jsx';
import { PosturePage } from './pages/PosturePage.jsx';
import { RecommendationsPage } from './pages/Recommendations.jsx';
import { SecurityPage } from './pages/SecurityAlerts.jsx';
import { TrustPage } from './pages/TrustAnalysis.jsx';
import { BehaviouralDnaPage } from './pages/BehaviouralDnaPage.jsx';
import { AdaptiveTrustPage } from './pages/AdaptiveTrustPage.jsx';

export default function App() {
  const controller = useApplicationController();
  const {
    page, selectedIncidentId, selectedFindingId, selectedDetailAppId, mobileNavOpen,
    setMobileNavOpen, apps, events, alerts, history, recommendations, stats, errors,
    busy, busyAction, selectedAppId, setSelectedAppId, trustData, accessRequestResult,
    trustError, detailApp, detailError, modal, setModal, toasts, setToasts, refreshKey,
    setRefreshKey, notify, navigate, selectedApp, activeAlerts, averageTrust,
    askPermissionChange, askStatusChange, openAppDetails, openAlertDetails,
    askAcknowledge, askApplyRecommendation, simulate, confirmReset, confirmRunDemo,
  } = controller;

  const shared = {
    apps, events, alerts, history, recommendations, selectedAppId, selectedApp,
    setSelectedAppId, errors, busyAction, onPermissionChange: askPermissionChange,
    onStatusChange: askStatusChange, onAcknowledge: askAcknowledge,
    onApplyRecommendation: askApplyRecommendation, onViewAlert: openAlertDetails,
    onSimulate: simulate, onViewApp: openAppDetails,
  };
  let content;
  switch (page) {
    case 'applications':
      content = <Applications {...shared} onViewAppPage={(app) => navigate('application-details', { appId: app.id })} />;
      break;
    case 'application-details':
      content = <ApplicationDetails
        appId={selectedDetailAppId}
        onBack={() => navigate('applications')}
        onOpenFinding={(finding, eventId) => navigate('incident', {
          eventId: eventId || finding?.relatedEventIds?.[0] || '',
          findingId: finding?.id || '',
        })}
      />;
      break;
    case 'posture':
      content = <PosturePage apps={apps} refreshKey={refreshKey} onNotify={notify} />;
      break;
    case 'findings':
      content = <SecurityFindings
        onOpenIncident={(eventId) => navigate('incident', { eventId })}
        onOpenFinding={(finding) => navigate('incident', {
          eventId: finding.relatedEventIds?.[0] || '', findingId: finding.id,
        })}
        onNotify={notify}
      />;
      break;
    case 'incident':
      content = <IncidentDetails
        eventId={selectedIncidentId} findingId={selectedFindingId}
        onBack={() => navigate('findings')} onNotify={notify}
      />;
      break;
    case 'policies': content = <PolicyManagement onNotify={notify} />; break;
    case 'dna': content = <BehaviouralDnaPage apps={apps} onNotify={notify} />; break;
    case 'adaptive': content = <AdaptiveTrustPage apps={apps} onNotify={notify} />; break;
    case 'permissions': content = <PermissionManagement {...shared} />; break;
    case 'monitoring': content = <MonitoringPage {...shared} accessRequestResult={accessRequestResult} />; break;
    case 'security': content = <SecurityPage {...shared} />; break;
    case 'trust': content = <TrustPage
      {...shared} trustData={trustData} trustError={trustError}
      onRefresh={() => setRefreshKey((current) => current + 1)}
    />; break;
    case 'recommendations': content = <RecommendationsPage {...shared} />; break;
    case 'history': content = <HistoryPage {...shared} />; break;
    default: content = <Dashboard
      {...shared} stats={stats} averageTrust={averageTrust} activeAlerts={activeAlerts}
      onRunDemo={confirmRunDemo} onReset={confirmReset} onNavigate={navigate}
    />;
  }

  return (
    <MainLayout
      page={page === 'application-details' ? 'applications' : page}
      navigate={navigate} mobileNavOpen={mobileNavOpen}
      onToggleNavigation={() => setMobileNavOpen((open) => !open)}
      onRefresh={() => setRefreshKey((current) => current + 1)}
      overlays={<>
        {modal && <ConfirmationModal
          modal={modal} busy={Boolean(busyAction)} detailApp={detailApp} detailError={detailError}
          apps={apps} events={events} alerts={alerts} history={history}
          onAcknowledgeAlert={askAcknowledge}
          onCancel={() => { if (!busyAction) setModal(null); }}
        />}
        <div className="toast-stack" aria-live="polite" aria-atomic="false">
          {toasts.map((toast) => <div className={`toast toast-${toast.tone}`} key={toast.id} role="status">
            <i /><span>{toast.message}</span>
            <button type="button" aria-label="Dismiss notification" onClick={() => setToasts((current) => current.filter((item) => item.id !== toast.id))}>×</button>
          </div>)}
        </div>
      </>}
    >
      {busy && page === 'overview' && <div className="refresh-indicator"><span className="spinner" />Refreshing live data</div>}
      {content}
    </MainLayout>
  );
}
