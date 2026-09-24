// Fórmulas da aba Luquinha. Valores fixos de 2027 e percentuais legais
// permanecem explícitos; os demais órgãos seguem a dotação atualizada.
export function recalculateBudget(db) {
  const t = db.totals, r = db.revenue;
  const round = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
  const sum = (key) => db.organs.reduce((v, o) => v + o[key], 0);
  t.initial2026 = round(sum('initial2026'));
  t.updated = round(sum('updated'));
  t.paid = round(sum('paid'));
  for (const [i, o] of db.organs.entries()) {
    const rule = db.formulaRules[i];
    o.forecastDec2026 = o.paid / 252 * 365;
    o.shareUpdated = t.updated ? o.updated / t.updated * 100 : 0;
    if (!rule.fixedForecast) {
      o.forecast2027 = (rule.fixedShare ?? o.shareUpdated) / 100 * r.forecast2027;
    }
  }
  t.forecastDec2026 = round(sum('forecastDec2026'));
  t.forecast2027 = round(sum('forecast2027'));
  t.deltaValue = round(t.forecast2027 - t.initial2026);
  t.deltaPct = t.initial2026 ? t.deltaValue / t.initial2026 * 100 : null;
  t.executionPct = t.updated ? t.paid / t.updated * 100 : 0;
  for (const o of db.organs) {
    o.share2026 = t.initial2026 ? o.initial2026 / t.initial2026 * 100 : 0;
    o.share2027 = t.forecast2027 ? o.forecast2027 / t.forecast2027 * 100 : 0;
    o.shareDeltaPp = o.share2027 - o.share2026;
    o.deltaValue = round(o.forecast2027 - o.initial2026);
    o.deltaPct = o.initial2026 ? o.deltaValue / o.initial2026 * 100 : null;
  }
  r.forecastDec2026 = round(r.collectedSep9 / 252 * 365);
  r.balanceSep9 = round(r.collectedSep9 - t.paid);
  r.balanceForecastDec2026 = round(r.forecastDec2026 - t.forecastDec2026);
  return db;
}

export function parseBudgetValue(text) {
  const value = text.trim().replace(/^R\$\s*/, '');
  if (!/^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/.test(value)) return null;
  const n = Number(value.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) && n <= Number.MAX_SAFE_INTEGER / 100 ? n : null;
}
