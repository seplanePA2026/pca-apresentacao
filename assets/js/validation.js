/** Validação hierárquica da base (órgão → unidade → ação → itens). */

import { $, cents, sum } from './utils.js';

/**
 * Compara totais informados com a soma dos filhos.
 * NÃO altera nenhum valor — apenas sinaliza divergências.
 */
export function validateDB(organs) {
  let divergences = 0;
  const details = [];

  for (const o of organs) {
    for (const key of ['initial', 'updated', 'balance']) {
      const informed = cents(o[key]);
      const computed = cents(sum(o.units, key));
      if (computed !== informed) {
        divergences++;
        details.push({
          level: 'orgao',
          org: o.code,
          unit: null,
          action: null,
          field: key,
          informed: o[key],
          computed: sum(o.units, key),
          diff: sum(o.units, key) - o[key]
        });
      }
    }

    for (const u of o.units) {
      for (const key of ['initial', 'updated', 'balance']) {
        const informed = cents(u[key]);
        const computed = cents(sum(u.actions, key));
        if (computed !== informed) {
          divergences++;
          details.push({
            level: 'unidade',
            org: o.code,
            unit: u.code,
            action: null,
            field: key,
            informed: u[key],
            computed: sum(u.actions, key),
            diff: sum(u.actions, key) - u[key]
          });
        }
      }

      for (const a of u.actions) {
        for (const key of ['initial', 'updated', 'balance']) {
          const informed = cents(a[key]);
          const computed = cents(sum(a.items, key));
          if (computed !== informed) {
            divergences++;
            details.push({
              level: 'acao',
              org: o.code,
              unit: u.code,
              action: a.code,
              field: key,
              informed: a[key],
              computed: sum(a.items, key),
              diff: sum(a.items, key) - a[key]
            });
          }
        }
      }
    }
  }

  const el = $('validationBadge');
  if (!el) {
    if (divergences > 0) {
      console.warn('VALIDAÇÃO DA BASE — divergências (valores oficiais preservados):', details);
    }
    return { divergences, details };
  }

  if (divergences === 0) {
    el.innerHTML = '<span class="validation-dot"></span><span>Base validada • 0 divergências de soma</span>';
  } else {
    el.innerHTML = `<span class="validation-dot" style="background:var(--red)"></span><span>${divergences} divergência(s) detectada(s)</span>`;
    console.warn('VALIDAÇÃO DA BASE — divergências (valores oficiais preservados):', details);
  }

  return { divergences, details };
}
