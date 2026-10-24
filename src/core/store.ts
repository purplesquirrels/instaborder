export interface Store<T> {
  getSnapshot: () => T;
  setState: (fn: (state: T) => T) => void;
  subscribe: (listener: () => void) => () => void;
}

export function createStore<T>(initialState: T): Store<T> {
  let state = initialState;
  const getSnapshot = () => state;
  const listeners = new Set<() => void>();
  const setState = (fn: (state: T) => T) => {
    state = fn(state);
    listeners.forEach((l: () => void) => l());
  };
  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };
  return { getSnapshot, setState, subscribe };
}
