import { useEffect, useState } from 'react';
import { incidentService } from '../services/incidentService.js';

export function useIncidentDetails({ eventId, findingId, reloadKey = 0 }) {
  const [data, setData] = useState({ incident: null, finding: null, findings: [], policies: [] });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setData({ incident: null, finding: null, findings: [], policies: [] });
    setError(null);
    setLoading(true);
    Promise.all([
      eventId ? incidentService.getIncident(eventId) : Promise.resolve(null),
      findingId ? incidentService.getFinding(findingId) : Promise.resolve(null),
      incidentService.getFindings(),
      incidentService.getPolicies(),
    ])
      .then(([incident, finding, findingsResult, policies]) => {
        if (active) setData({
          incident,
          finding,
          findings: findingsResult.items || [],
          policies,
        });
      })
      .catch((cause) => {
        if (active) setError(cause);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [eventId, findingId, reloadKey]);

  return { ...data, error, loading, setData };
}
