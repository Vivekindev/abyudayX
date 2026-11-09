'use client';
// Per-browser progress (done days, notes, nailed flashcards). Export/import moves it between devices.
import { createContext, useCallback, useContext, useEffect, useState } from 'react';

const KEY = 'sdm_v1';
const EMPTY = { done: {}, notes: {}, known: {} };
const Ctx = createContext(null);

export function ProgressProvider({ children }) {
  const [state, setState] = useState(EMPTY);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try { setState({ ...EMPTY, ...JSON.parse(localStorage.getItem(KEY) || '{}') }); } catch {}
    setReady(true);
  }, []);
  useEffect(() => { if (ready) try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {} }, [state, ready]);

  const update = useCallback((field, key, value) => setState(s => {
    const next = { ...s[field] };
    if (value === undefined || value === '' || value === false) delete next[key]; else next[key] = value;
    return { ...s, [field]: next };
  }), []);

  const api = {
    ...state, ready,
    toggleDone: id => update('done', id, state.done[id] ? undefined : new Date().toISOString().slice(0, 10)),
    setNote: (id, text) => update('notes', id, text),
    setKnown: (q, v) => update('known', q, v ? 1 : undefined),
    replaceAll: d => setState({ done: d.done || {}, notes: d.notes || {}, known: d.known || {} }),
  };
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export const useProgress = () => useContext(Ctx);
