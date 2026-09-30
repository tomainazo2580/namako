// Révision espacée, séries et badges. Fonctions simples, sans accès à l'écran.
import { state, activeLessons } from './db.js';

// Intervalles (en jours) selon la « boîte » de la leçon : 0 à 5
export const INTERVALS = [1, 3, 7, 14, 30, 60];
const DAYS = ['di', 'lu', 'ma', 'me', 'je', 've', 'sa'];

export const startOfDay = (ts) => { const d = new Date(ts); d.setHours(0, 0, 0, 0); return d.getTime(); };
export const dayKey = (ts) => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const parseKey = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d, 12); };
export const addDays = (key, n) => { const d = parseKey(key); d.setDate(d.getDate() + n); return dayKey(d.getTime()); };

export const isDue = (l, now = Date.now()) => !l.nextReviewAt || l.nextReviewAt <= now;

// 0 « À revoir » -> demain ; 1 « Encore un effort » -> 3 jours ;
// 2 « Je maîtrise » -> 7 jours, puis 14, 30 et 60 aux réussites suivantes.
export function nextBox(box, rating) {
  if (rating === 0) return 0;
  if (rating === 1) return 1;
  return Math.min(5, Math.max(2, (box || 0) + 1));
}

export function schedule(lesson, rating, now = Date.now()) {
  const box = nextBox(lesson.box, rating);
  return { box, mastery: rating, lastReviewedAt: now, nextReviewAt: startOfDay(now) + INTERVALS[box] * 864e5 };
}

export const intervalLabel = (days) => (days === 1 ? 'demain' : `${days} jours`);

// Leçons à réviser : d'abord les plus en retard, puis les nouvelles
export function dueLessons(subjectId, now = Date.now(), limit = 20) {
  const list = activeLessons(subjectId || undefined).filter((l) => isDue(l, now));
  const late = list.filter((l) => l.nextReviewAt).sort((a, b) => a.nextReviewAt - b.nextReviewAt);
  const fresh = list.filter((l) => !l.nextReviewAt).sort((a, b) => a.createdAt - b.createdAt);
  return [...late, ...fresh].slice(0, limit);
}

export function streaks(now = Date.now()) {
  const days = new Set(state.reviews.map((r) => r.day));
  const today = dayKey(now);
  let cur = 0;
  let d = days.has(today) ? today : addDays(today, -1);
  while (days.has(d)) { cur++; d = addDays(d, -1); }
  let best = 0, run = 0, prev = null;
  for (const k of [...days].sort()) {
    run = prev && addDays(prev, 1) === k ? run + 1 : 1;
    best = Math.max(best, run);
    prev = k;
  }
  return { cur, best, doneToday: days.has(today) };
}

export function lastDays(n = 7, now = Date.now()) {
  const counts = {};
  for (const r of state.reviews) counts[r.day] = (counts[r.day] || 0) + 1;
  const today = dayKey(now);
  return Array.from({ length: n }, (_, i) => {
    const key = addDays(today, i - (n - 1));
    return { key, label: DAYS[parseKey(key).getDay()], count: counts[key] || 0 };
  });
}

export function breakdown() {
  const ls = activeLessons();
  return {
    fresh: ls.filter((l) => !l.nextReviewAt).length,
    learning: ls.filter((l) => l.nextReviewAt && (l.box || 0) < 2).length,
    mastered: ls.filter((l) => (l.box || 0) >= 2 && l.nextReviewAt).length,
  };
}

export function badges() {
  const total = state.reviews.length;
  const { best } = streaks();
  const mastered = breakdown().mastered;
  return [
    { name: 'Premier pas', desc: 'Réviser une première leçon', ok: total >= 1 },
    { name: '3 jours d’affilée', desc: 'Réviser 3 jours de suite', ok: best >= 3 },
    { name: '7 jours d’affilée', desc: 'Réviser 7 jours de suite', ok: best >= 7 },
    { name: '30 jours d’affilée', desc: 'Réviser 30 jours de suite', ok: best >= 30 },
    { name: '50 révisions', desc: 'Atteindre 50 révisions', ok: total >= 50 },
    { name: '200 révisions', desc: 'Atteindre 200 révisions', ok: total >= 200 },
    { name: '10 leçons maîtrisées', desc: 'Maîtriser 10 leçons', ok: mastered >= 10 },
  ];
}
