import { useCallback, useEffect, useState } from 'react';
import { APPLICATION_STATUS, RECOMMENDATION_STATUS, SUGGESTED_ACTIONS } from '@shared/contracts.js';
import { api } from '../services/api.js';
import { NAV_ITEMS } from '../components/layout/navigation.js';
import { ALERT_LABELS, RESOURCE_LABELS, humanize, safeDecode } from '../components/common/LegacyControls.jsx';

let nextToastId = 0;

export function useApplicationController() {
  const [page, setPage] = useState(() => {
    if (typeof window === 'undefined') return 'overview';
    const hash = window.location.hash.slice(1).split('/')[0];
    return [...NAV_ITEMS.map((item) => item.id), 'incident', 'application-details'].includes(hash) ? hash : 'overview';
  });
  const [selectedIncidentId, setSelectedIncidentId] = useState(() => {
    const [route, encodedTarget] = typeof window === 'undefined' ? [] : window.location.hash.slice(1).split('/');
    const target = safeDecode(encodedTarget || '');
    return route === 'incident' && target && !target.startsWith('finding:') ? target : '';
  });
  const [selectedFindingId, setSelectedFindingId] = useState(() => {
    const [route, encodedTarget] = typeof window === 'undefined' ? [] : window.location.hash.slice(1).split('/');
    const target = safeDecode(encodedTarget || '');
    return route === 'incident' && target.startsWith('finding:') ? target.slice(8) : '';
  });
  const [selectedDetailAppId, setSelectedDetailAppId] = useState(() => {
    const [route, encodedTarget] = typeof window === 'undefined' ? [] : window.location.hash.slice(1).split('/');
    return route === 'application-details' ? safeDecode(encodedTarget || '') : '';
  });
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [apps, setApps] = useState([]);
  const [events, setEvents] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [history, setHistory] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [stats, setStats] = useState(null);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [busyAction, setBusyAction] = useState('');
  const [selectedAppId, setSelectedAppId] = useState('');
  const [trustData, setTrustData] = useState(null);
  const [accessRequestResult, setAccessRequestResult] = useState(null);
  const [trustError, setTrustError] = useState(null);
  const [detailApp, setDetailApp] = useState(null);
  const [detailError, setDetailError] = useState(null);
  const [modal, setModal] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [refreshKey, setRefreshKey] = useState(0);

  const notify = useCallback((message, tone = 'success') => {
    nextToastId += 1;
    const id = `toast-${nextToastId}`;
    setToasts((current) => [...current, { id, message, tone }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 4200);
  }, []);

  const refresh = useCallback(async ({ quiet = false } = {}) => {
    if (!quiet) setBusy(true);
    const [appsResult, eventsResult, alertsResult, historyResult, statsResult] = await Promise.allSettled([
      api.getApps(),
      api.getEvents({ limit: 200 }),
      api.getAlerts({ limit: 200 }),
      api.getHistory({ limit: 100 }),
      api.getStats(),
    ]);

    const nextErrors = {};
    if (appsResult.status === 'fulfilled') {
      const value = Array.isArray(appsResult.value) ? appsResult.value : [];
      setApps(value);
      setSelectedAppId((current) => value.some((app) => app.id === current) ? current : (value[0]?.id || ''));
    } else {
      nextErrors.apps = appsResult.reason;
    }

    if (eventsResult.status === 'fulfilled') {
      setEvents(Array.isArray(eventsResult.value) ? eventsResult.value : []);
    } else {
      nextErrors.events = eventsResult.reason;
    }
    if (alertsResult.status === 'fulfilled') {
      setAlerts(Array.isArray(alertsResult.value) ? alertsResult.value : []);
    } else {
      nextErrors.alerts = alertsResult.reason;
    }
    if (historyResult.status === 'fulfilled') {
      setHistory(Array.isArray(historyResult.value) ? historyResult.value : []);
    } else {
      nextErrors.history = historyResult.reason;
    }
    if (statsResult.status === 'fulfilled') setStats(statsResult.value);
    else nextErrors.stats = statsResult.reason;
    setErrors(nextErrors);

    const currentApps = appsResult.status === 'fulfilled' && Array.isArray(appsResult.value)
      ? appsResult.value
      : [];
    if (currentApps.length) {
      const recResults = await Promise.allSettled(
        currentApps.map((app) => api.getRecommendations(app.id)),
      );
      const combined = [];
      const recommendationErrors = [];
      for (const result of recResults) {
        if (result.status === 'fulfilled' && Array.isArray(result.value)) combined.push(...result.value);
        else if (result.status === 'rejected') recommendationErrors.push(result.reason);
      }
      setRecommendations(combined);
      if (recommendationErrors.length) {
        setErrors((current) => ({ ...current, recommendations: recommendationErrors[0] }));
      }
    } else {
      setRecommendations([]);
    }
    if (!quiet) setBusy(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refreshKey, refresh]);

  useEffect(() => {
    if (page !== 'trust' || !selectedAppId) return undefined;
    let active = true;
    setTrustData(null);
    setTrustError(null);
    api.getTrustScore(selectedAppId)
      .then((data) => { if (active) setTrustData(data); })
      .catch((error) => { if (active) setTrustError(error); });
    return () => { active = false; };
  }, [page, selectedAppId]);

  const selectedApp = apps.find((app) => app.id === selectedAppId) || null;
  const activeAlerts = alerts.filter((alert) => !alert.acknowledged).length;
  const averageTrust = apps.length
    ? Math.round(apps.reduce((sum, app) => sum + (Number.isFinite(app.trustScore) ? app.trustScore : 0), 0) / apps.length)
    : null;

  const runAction = useCallback(async (key, action, successMessage) => {
    setBusyAction(key);
    try {
      await action();
      if (successMessage) notify(successMessage);
      setModal(null);
      setRefreshKey((current) => current + 1);
    } catch (error) {
      notify(error.message, 'error');
    } finally {
      setBusyAction('');
    }
  }, [notify]);

  function askPermissionChange(app, resource, enabled) {
    const action = enabled ? 'grant' : 'revoke';
    setModal({
      title: `${enabled ? 'Enable' : 'Disable'} ${RESOURCE_LABELS[resource]} access?`,
      description: `${action === 'grant' ? 'This gives' : 'This removes'} ${app.name} ${enabled ? 'permission to use' : 'access to'} ${RESOURCE_LABELS[resource].toLowerCase()}. The change will be recorded by the backend.`,
      confirmLabel: enabled ? 'Enable permission' : 'Disable permission',
      danger: !enabled,
      onConfirm: () => runAction(
        `${app.id}-${resource}`,
        () => api.updatePermission(app.id, resource, enabled),
        `${RESOURCE_LABELS[resource]} permission ${enabled ? 'enabled' : 'disabled'}.`,
      ),
    });
  }

  function askStatusChange(app) {
    const nextStatus = app.status === APPLICATION_STATUS.SUSPENDED
      ? APPLICATION_STATUS.ACTIVE
      : APPLICATION_STATUS.SUSPENDED;
    setModal({
      title: `${nextStatus === APPLICATION_STATUS.SUSPENDED ? 'Suspend' : 'Reactivate'} ${app.name}?`,
      description: nextStatus === APPLICATION_STATUS.SUSPENDED
        ? 'The backend will deny future simulated access requests from this application.'
        : 'This application will be allowed to request enabled permissions again.',
      confirmLabel: nextStatus === APPLICATION_STATUS.SUSPENDED ? 'Suspend application' : 'Reactivate application',
      danger: nextStatus === APPLICATION_STATUS.SUSPENDED,
      onConfirm: () => runAction(
        `status-${app.id}`,
        () => api.updateStatus(app.id, nextStatus),
        `${app.name} is now ${nextStatus}.`,
      ),
    });
  }

  async function openAppDetails(app) {
    setDetailApp(null);
    setDetailError(null);
    setModal({ type: 'detail', title: app.name });
    try {
      const data = await api.getApp(app.id);
      setDetailApp(data);
    } catch (error) {
      setDetailError(error);
    }
  }

  function openAlertDetails(alert) {
    setModal({
      type: 'alert-detail',
      alert,
      title: ALERT_LABELS[alert.type] || humanize(alert.type),
      onAcknowledge: askAcknowledge,
    });
  }

  function askAcknowledge(alert) {
    runAction(
      `ack-${alert.id}`,
      () => api.acknowledgeAlert(alert.id),
      'Alert acknowledged.',
    );
  }

  function askApplyRecommendation(recommendation) {
    const highImpact = recommendation.suggestedAction === SUGGESTED_ACTIONS.SUSPEND_APP
      || recommendation.suggestedAction === SUGGESTED_ACTIONS.REVOKE_PERMISSION;
    setModal({
      title: 'Apply this recommendation?',
      description: `${recommendation.title}. ${recommendation.description}`,
      confirmLabel: highImpact ? 'Apply recommendation' : 'Confirm',
      danger: recommendation.suggestedAction === SUGGESTED_ACTIONS.SUSPEND_APP,
      onConfirm: () => runAction(
        `rec-${recommendation.id}`,
        () => api.applyRecommendation(recommendation.id),
        'Recommendation applied.',
      ),
    });
  }

  async function simulate(payload) {
    setBusyAction('simulate');
    try {
      const result = await api.simulateEvents(payload);
      setAccessRequestResult(result);
      const summary = result?.summary;
      notify(
        `Simulation complete: ${summary?.allowed ?? 0} allowed, ${summary?.denied ?? 0} denied.`,
      );
      setRefreshKey((current) => current + 1);
      return result;
    } catch (error) {
      notify(error.message, 'error');
      throw error;
    } finally {
      setBusyAction('');
    }
  }

  function confirmReset() {
    setModal({
      title: 'Reset the demo environment?',
      description: 'This restores the backend’s deterministic seed data and clears simulated changes.',
      confirmLabel: 'Reset demo',
      danger: true,
      onConfirm: () => runAction('reset-demo', api.resetDemo, 'Demo environment reset.'),
    });
  }

  function confirmRunDemo() {
    setModal({
      title: 'Run the demo scenario?',
      description: 'This resets seed data, simulates the access scenario, applies the generated location recommendation, and records the follow-up request.',
      confirmLabel: 'Run scenario',
      onConfirm: async () => {
        setBusyAction('demo');
        try {
          await api.resetDemo();
          const start = Date.now();
          await api.simulateEvents({
            appId: 'app_01', resource: 'location', reason: 'Workout route tracking', count: 3,
            startTime: new Date(start).toISOString(),
          });
          await api.simulateEvents({
            appId: 'app_01', resource: 'location', reason: 'Background route update', count: 25,
            startTime: new Date(start + 120000).toISOString(),
          });
          await api.simulateEvents({
            appId: 'app_01', resource: 'contacts', reason: 'Find friends for activity', count: 1,
            startTime: new Date(start + 240000).toISOString(),
          });
          const recs = await api.getRecommendations('app_01');
          const locationRecommendation = recs.find((item) => (
            item.resource === 'location' && item.status === RECOMMENDATION_STATUS.PENDING
          ));
          if (locationRecommendation) await api.applyRecommendation(locationRecommendation.id);
          await api.simulateEvents({
            appId: 'app_01', resource: 'location', reason: 'Follow-up location request', count: 1,
            startTime: new Date(start + 300000).toISOString(),
          });
          notify('Demo scenario completed.');
          setModal(null);
          setRefreshKey((current) => current + 1);
        } catch (error) {
          notify(error.message, 'error');
          setModal(null);
        } finally {
          setBusyAction('');
        }
      },
    });
  }

  useEffect(() => {
    const handleHash = () => {
      const [route, encodedTarget] = window.location.hash.slice(1).split('/');
      if (![...NAV_ITEMS.map((item) => item.id), 'incident', 'application-details'].includes(route)) return;
      setPage(route);
      if (route === 'application-details' && encodedTarget) {
        setSelectedDetailAppId(decodeURIComponent(encodedTarget));
      } else {
        setSelectedDetailAppId('');
      }
      if (route === 'incident' && encodedTarget) {
        const target = safeDecode(encodedTarget);
        setSelectedFindingId(target.startsWith('finding:') ? target.slice(8) : '');
        setSelectedIncidentId(target.startsWith('finding:') ? '' : target);
      } else {
        setSelectedFindingId('');
        setSelectedIncidentId('');
      }
    };
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  const navigate = (nextPage, { eventId = '', findingId = '', appId = '' } = {}) => {
    setPage(nextPage);
    if (nextPage === 'incident') {
      setSelectedIncidentId(eventId);
      setSelectedFindingId(findingId);
    } else {
      setSelectedIncidentId('');
      setSelectedFindingId('');
    }
    setSelectedDetailAppId(nextPage === 'application-details' ? appId : '');
    if (typeof window !== 'undefined') {
      window.location.hash = nextPage === 'incident' && eventId
        ? `incident/${encodeURIComponent(eventId)}`
        : nextPage === 'incident' && findingId
          ? `incident/${encodeURIComponent(`finding:${findingId}`)}`
        : nextPage === 'application-details' && appId
          ? `application-details/${encodeURIComponent(appId)}`
        : nextPage;
    }
    setMobileNavOpen(false);
  };

  return {
    page, selectedIncidentId, selectedFindingId, selectedDetailAppId, mobileNavOpen, setMobileNavOpen,
    apps, events, alerts, history, recommendations, stats, errors, busy, busyAction,
    selectedAppId, setSelectedAppId, trustData, accessRequestResult, trustError,
    detailApp, detailError, modal, setModal, toasts, setToasts, refreshKey, setRefreshKey,
    notify, navigate, selectedApp, activeAlerts, averageTrust,
    askPermissionChange, askStatusChange, openAppDetails, openAlertDetails,
    askAcknowledge, askApplyRecommendation, simulate, confirmReset, confirmRunDemo,
  };
}
