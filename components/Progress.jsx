'use client';
// Per-browser progress (done days, notes, nailed flashcards). Export/import moves it between devices.
import { createContext, useCallback, useContext, useEffect, useState } from 'react';

const KEY = 'sdm_v1';
const EMPTY = { done: {}, notes: {}, known: {}, rev: {} };
const Ctx = createContext(null);

// Spaced review: a finished topic comes back the next day, then after each interval below once you recall it.
// rev[id] = [successful recalls so far, next due date]. Forgetting it resets to "tomorrow".
const STEPS = [3, 7, 16, 35, 60];
const day = (plus = 0, from) => { const d = from ? new Date(from) : new Date(); d.setUTCDate(d.getUTCDate() + plus); return d.toISOString().slice(0, 10); };
export const isDue = (p, id) => !!p.done[id] && (p.rev[id]?.[1] ?? day(1, p.done[id])) <= day();

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
    toggleDone: id => update('done', id, state.done[id] ? undefined : day()),
    review: (id, ok) => { const n = ok ? (state.rev[id]?.[0] || 0) + 1 : 0; update('rev', id, [n, day(ok ? STEPS[Math.min(n, STEPS.length) - 1] : 1)]); },
    setNote: (id, text) => update('notes', id, text),
    setKnown: (q, v) => update('known', q, v ? 1 : undefined),
    replaceAll: d => setState({ done: d.done || {}, notes: d.notes || {}, known: d.known || {}, rev: d.rev || {} }),
  };
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export const useProgress = () => useContext(Ctx);
