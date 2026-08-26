/** Busca, filtro de disponibilidade e ordenação de ações. */

import { normalize, pct } from './utils.js';

export function filterByAvailability(balance, updated, availabilityValue) {
  const f = availabilityValue;
  const p = pct(balance, updated);
  if (f === 'all') return true;
  if (f === 'zero') return Math.abs(balance) < 0.005;
  if (p === null) return false;
  if (f === 'high') return p >= 75;
  if (f === 'mid') return p >= 25 && p < 75;
  if (f === 'low') return p < 25;
  return true;
}

export function actionMatches(a, term) {
  if (!term) return true;
  const hay = [a.code, a.name, ...a.items.flatMap((i) => [i.code, i.source, i.name])]
    .map(normalize)
    .join(' ');
  return hay.includes(term);
}

export function sortActions(list, sortMode) {
  return [...list].sort((a, b) => {
    if (sortMode === 'updatedDesc') return b.updated - a.updated;
    if (sortMode === 'balanceDesc') return b.balance - a.balance;
    if (sortMode === 'pctDesc') {
      return (pct(b.balance, b.updated) ?? -Infinity) - (pct(a.balance, a.updated) ?? -Infinity);
    }
    if (sortMode === 'pctAsc') {
      return (pct(a.balance, a.updated) ?? Infinity) - (pct(b.balance, b.updated) ?? Infinity);
    }
    return String(a.code).localeCompare(String(b.code), 'pt-BR', { numeric: true });
  });
}

export function filteredItems(a, term) {
  if (!term) return a.items;
  const direct = normalize(`${a.code} ${a.name}`).includes(term);
  if (direct) return a.items;
  return a.items.filter((i) => normalize(`${i.code} ${i.source} ${i.name}`).includes(term));
}
