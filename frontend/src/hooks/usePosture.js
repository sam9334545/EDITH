import { useEffect, useState } from 'react';

export function usePosture(load, dependencies = []) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    load()
      .then((result) => {
        if (active) {
          setData(result);
          setError(null);
        }
      })
      .catch((cause) => {
        if (active) setError(cause);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, dependencies);

  return { data, error, loading, setData, setError };
}
