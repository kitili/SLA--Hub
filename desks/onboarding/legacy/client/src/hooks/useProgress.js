import { useState, useEffect, useCallback, useMemo } from 'react';
import * as store from '../utils/progressStore';
import { api } from '../utils/api';
import { useStaff } from '../context/StaffContext';

const defaultProgress = { readItems: [], passedCheckpoints: [] };

export function useProgress() {
  const { staff, dbOnline } = useStaff();
  const [progress, setProgress] = useState(defaultProgress);
  const [syncing, setSyncing] = useState(false);

  const applyProgress = useCallback((data) => {
    const next = { ...defaultProgress, ...data };
    setProgress(next);
    store.saveProgress(next);
  }, []);

  const loadProgress = useCallback(async () => {
    if (!staff) return;

    if (dbOnline && staff.id && !staff.id.startsWith('local-')) {
      try {
        const { progress: remote } = await api.getProgress(staff.id);
        applyProgress(remote);
        return;
      } catch {
        // fall through to local
      }
    }

    applyProgress(store.getProgress());
  }, [staff, dbOnline, applyProgress]);

  useEffect(() => {
    loadProgress();
  }, [loadProgress]);

  const syncAction = useCallback(async (action) => {
    if (!staff) return;

    setSyncing(true);
    try {
      if (dbOnline && staff.id && !staff.id.startsWith('local-')) {
        const result = await action();
        if (result?.progress) applyProgress(result.progress);
        return;
      }
    } catch (err) {
      console.warn('API sync failed, using local storage:', err.message);
    } finally {
      setSyncing(false);
    }
  }, [staff, dbOnline, applyProgress]);

  const markItemRead = useCallback(async (id) => {
    const local = store.markItemRead(id);
    applyProgress(local);
    if (staff?.id && !staff.id.startsWith('local-')) {
      await syncAction(() => api.markRead(staff.id, id));
    }
  }, [staff, applyProgress, syncAction]);

  const unmarkItemRead = useCallback((id) => {
    const local = store.unmarkItemRead(id);
    applyProgress(local);
  }, [applyProgress]);

  const markCheckpointPassed = useCallback(async (id) => {
    const local = store.markCheckpointPassed(id);
    applyProgress(local);
    if (staff?.id && !staff.id.startsWith('local-')) {
      await syncAction(() => api.markCheckpoint(staff.id, id));
    }
  }, [staff, applyProgress, syncAction]);

  const resetCheckpoint = useCallback(async (checkpointId, linkedItemId) => {
    const local = store.resetCheckpoint(checkpointId, linkedItemId);
    applyProgress(local);
    if (staff?.id && !staff.id.startsWith('local-')) {
      await syncAction(() => api.resetCheckpoint(staff.id, checkpointId, linkedItemId));
    }
  }, [staff, applyProgress, syncAction]);

  const resetAll = useCallback(() => {
    store.resetAllProgress();
    applyProgress(defaultProgress);
  }, [applyProgress]);

  return useMemo(() => ({
    progress,
    syncing,
    refresh: loadProgress,
    markItemRead,
    unmarkItemRead,
    markCheckpointPassed,
    resetCheckpoint,
    isItemRead: (id) => progress.readItems.includes(id),
    isCheckpointPassed: (id) => progress.passedCheckpoints.includes(id),
    resetAll,
  }), [progress, syncing, loadProgress, markItemRead, unmarkItemRead, markCheckpointPassed, resetCheckpoint, resetAll]);
}
