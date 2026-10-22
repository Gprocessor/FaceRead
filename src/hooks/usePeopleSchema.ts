import { useCallback, useEffect, useState } from 'react';
import { getPeopleSchema, DEFAULT_LABELS, type PeopleSchema } from '@/services/peopleService';

let cache: PeopleSchema | null = null;
let inflight: Promise<PeopleSchema> | null = null;
const listeners = new Set<(s: PeopleSchema) => void>();

function publish(s: PeopleSchema) { cache = s; listeners.forEach((l) => l(s)); }
export function setPeopleSchemaCache(s: PeopleSchema) { publish(s); }
export function clearPeopleSchemaCache() { cache = null; }

async function fetchSchema(force = false) {
  if (cache && !force) return cache;
  if (!inflight) inflight = getPeopleSchema().then((s) => { publish(s); return s; }).finally(() => { inflight = null; });
  return inflight;
}

export function usePeopleSchema() {
  const [schema, setSchema] = useState<PeopleSchema | null>(cache);
  const [loading, setLoading] = useState(!cache);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listeners.add(setSchema);
    if (!cache) {
      fetchSchema()
        .catch((e) => setError(e instanceof Error ? e.message : 'Could not load field settings'))
        .finally(() => setLoading(false));
    }
    return () => { listeners.delete(setSchema); };
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try { await fetchSchema(true); setError(null); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not load field settings'); }
    finally { setLoading(false); }
  }, []);

  return { schema, labels: schema?.labels ?? DEFAULT_LABELS, fields: schema?.fields ?? [], loading, error, refresh };
}
