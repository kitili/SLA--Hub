const STORAGE_KEY = 'silverleaf-onboarding-progress';

const defaultState = {
  readItems: [],
  passedCheckpoints: [],
};

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...defaultState };
    return { ...defaultState, ...JSON.parse(raw) };
  } catch {
    return { ...defaultState };
  }
}

function save(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function saveProgress(state) {
  save(state);
}

export function getProgress() {
  return load();
}

export function markItemRead(itemId) {
  const state = load();
  if (!state.readItems.includes(itemId)) {
    state.readItems = [...state.readItems, itemId];
    save(state);
  }
  return state;
}

export function unmarkItemRead(itemId) {
  const state = load();
  state.readItems = state.readItems.filter((id) => id !== itemId);
  save(state);
  return state;
}

export function markCheckpointPassed(checkpointId) {
  const state = load();
  if (!state.passedCheckpoints.includes(checkpointId)) {
    state.passedCheckpoints = [...state.passedCheckpoints, checkpointId];
    save(state);
  }
  return state;
}

export function isItemRead(itemId) {
  return load().readItems.includes(itemId);
}

export function isCheckpointPassed(checkpointId) {
  return load().passedCheckpoints.includes(checkpointId);
}

export function isItemComplete(itemId) {
  return isCheckpointPassed(itemId);
}

export function resetCheckpoint(checkpointId, linkedItemId = null) {
  const state = load();
  state.passedCheckpoints = state.passedCheckpoints.filter((id) => id !== checkpointId);
  if (linkedItemId) {
    state.readItems = state.readItems.filter((id) => id !== linkedItemId);
  }
  save(state);
  return state;
}

export function getCompletionStats(checkpointIds) {
  const passed = load().passedCheckpoints;
  const total = checkpointIds.length;
  const completed = checkpointIds.filter((id) => passed.includes(id)).length;
  return { total, completed, pct: total ? Math.round((completed / total) * 100) : 0 };
}

export function resetAllProgress() {
  save({ ...defaultState });
}
