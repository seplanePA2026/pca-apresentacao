/** Dashboard Orçamento — Apresentação 2026 × previsão 2027. */

import { $, esc, money, normalize, pctText, intFmt } from './utils.js';
import { stackedShare, verticalBars, variationCompact, topN } from './charts.js';
import { recalculateBudget, parseBudgetValue } from './orcamento-model.js';

function shortMoney(v) {
  const n = Number(v) || 0;
  const abs = Math.abs(n);
  if (abs >= 1e9) return `${n < 0 ? '-' : ''}R$ ${(abs / 1e9).toFixed(2).replace('.', ',')} bi`;
  if (abs >= 1e6) return `${n < 0 ? '-' : ''}R$ ${(abs / 1e6).toFixed(1).replace('.', ',')} mi`;
  return money(n);
}

function deltaBadge(pct) {
  if (pct === null || pct === undefined || Number.isNaN(pct)) return '<span class="badge muted">—</span>';
  if (Math.abs(pct) < 0.5) return `<span class="badge muted">${pctText(pct)}</span>`;
  if (pct > 0) return `<span class="badge up">↑ ${pctText(pct)}</span>`;
  return `<span class="badge down">↓ ${pctText(Math.abs(pct))}</span>`;
}

function ppBadge(pp) {
  if (pp === null || pp === undefined) return '—';
  const sign = pp > 0 ? '+' : '';
  const cls = Math.abs(pp) < 0.05 ? 'muted' : pp > 0 ? 'up' : 'down';
  return `<span class="badge ${cls}">${sign}${pctText(pp).replace('%', '')} p.p.</span>`;
}

/**
 * @param {object} db
 */
export function createOrcamento(db) {
  db = structuredClone(db);
  const storageKey = 'seplane.orcamento.edits.v1';
  const sourceKey = JSON.stringify(db);
  let savedEdits = {};
  let savedTitles = {};
  const fields = {};
  const addField = (key, target, prop, label) => { fields[key] = { target, prop, label }; };
  for (const prop of ['planned2026', 'collectedSep9', 'forecast2027']) {
    addField(prop, db.revenue, prop, { planned2026: 'Receita prevista 2026', collectedSep9: 'Receita arrecadada até 09/09', forecast2027: 'Receita prevista 2027 / base da distribuição' }[prop]);
  }
  db.organs.forEach((o, i) => {
    addField(`${i}.name`, o, 'name', 'Nome da secretaria / órgão');
    if (db.formulaRules[i].fixedShare !== null) addField(`${i}.fixedShare`, db.formulaRules[i], 'fixedShare', 'Participação na base 2027 (%)');
    for (const prop of ['initial2026', 'paid', 'updated', 'forecast2027']) {
      if (prop === 'forecast2027' && !db.formulaRules[i].fixedForecast) continue;
      addField(`${i}.${prop}`, o, prop, `${o.name} — ${{ initial2026: 'orçamento inicial', paid: 'despesas pagas', updated: 'dotação atualizada', forecast2027: 'previsão fixa 2027' }[prop]}`);
    }
  });
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    if (saved?.source === sourceKey && saved.values && Object.entries(saved.values).every(([k, v]) => fields[k] && (fields[k].prop === 'name' ? typeof v === 'string' && v.trim().length > 0 && v.length <= 120 : Number.isFinite(v) && v >= 0 && v <= Number.MAX_SAFE_INTEGER / 100))) {
      savedEdits = saved.values;
      if (saved.titles && typeof saved.titles === 'object') {
        savedTitles = Object.fromEntries(Object.entries(saved.titles).filter(([, value]) =>
          typeof value === 'string' && value.trim().length > 0 && value.length <= 120));
      }
      for (const [k, v] of Object.entries(savedEdits)) fields[k].target[fields[k].prop] = v;
    }
  } catch (error) { console.warn('Não foi possível carregar as edições do orçamento.', error); }
  recalculateBudget(db);
  const organs = db.organs || [];
  const totals = db.totals || {};
  const revenue = db.revenue || {};

  const ui = {
    search: $('orcSearch'),
    trend: $('orcTrend'),
    sort: $('orcSort'),
    reset: $('orcReset'),
    body: $('orcTableBody')
  };

  function filtered() {
    const q = normalize(ui.search.value);
    let list = organs.filter((o) => {
      if (q && !normalize(o.name).includes(q)) return false;
      const d = o.deltaPct;
      if (ui.trend.value === 'up' && !(d > 0.5)) return false;
      if (ui.trend.value === 'down' && !(d < -0.5)) return false;
      if (ui.trend.value === 'flat' && !(Math.abs(d) <= 0.5)) return false;
      return true;
    });

    const mode = ui.sort.value;
    list = [...list].sort((a, b) => {
      if (mode === 'deltaAsc') return a.deltaValue - b.deltaValue;
      if (mode === 'pctDesc') return (b.deltaPct ?? -Infinity) - (a.deltaPct ?? -Infinity);
      if (mode === 'pctAsc') return (a.deltaPct ?? Infinity) - (b.deltaPct ?? Infinity);
      if (mode === 'forecastDesc') return b.forecast2027 - a.forecast2027;
      if (mode === 'name') return a.name.localeCompare(b.name, 'pt-BR');
      return b.deltaValue - a.deltaValue;
    });
    return list;
  }

  function renderKpis() {
    $('orcMUpdated').textContent = money(totals.updated);
    $('orcMPaid').textContent = money(totals.paid);
    $('orcM2026').textContent = money(totals.initial2026);
    $('orcMDec').textContent = money(totals.forecastDec2026);
    $('orcM2027').textContent = money(totals.forecast2027);
    $('orcMDelta').textContent = money(totals.deltaValue);
    $('orcMDeltaSub').innerHTML = deltaBadge(totals.deltaPct);

    $('orcR2026').textContent = money(revenue.planned2026);
    $('orcRCollected').textContent = money(revenue.collectedSep9);
    const collPct = revenue.planned2026
      ? (revenue.collectedSep9 / revenue.planned2026) * 100
      : 0;
    $('orcRCollectedSub').textContent = `${pctText(collPct)} da receita prevista`;
    $('orcRDec').textContent = money(revenue.forecastDec2026);
    $('orcR2027').textContent = money(revenue.forecast2027);
    $('orcRBalance').textContent = money(revenue.balanceSep9);
    $('orcRBalanceDec').textContent = money(revenue.balanceForecastDec2026);
  }

  function renderCharts(list) {
    const share2026 = topN(
      list.map((o) => ({
        code: o.name.slice(0, 12),
        label: o.name,
        value: o.initial2026,
        meta: `${money(o.initial2026)} • ${pctText(o.share2026)}`
      })),
      8,
      (r) => r.value
    ).map((r) => (r.isOther ? { ...r, value: r.value } : r));

    const share2027 = topN(
      list.map((o) => ({
        code: o.name.slice(0, 12),
        label: o.name,
        value: o.forecast2027,
        meta: `${money(o.forecast2027)} • ${pctText(o.share2027)}`
      })),
      8,
      (r) => r.value
    );

    $('orcChart2026').innerHTML = stackedShare(share2026);
    $('orcChart2027').innerHTML = stackedShare(share2027);

    const varRows = [...list]
      .filter((o) => o.deltaPct !== null)
      .sort((a, b) => Math.abs(b.deltaPct) - Math.abs(a.deltaPct))
      .slice(0, 14)
      .map((o) => ({
        code: o.name,
        label: o.name,
        value: o.deltaPct
      }));
    $('orcChartVar').innerHTML = variationCompact(varRows, { padL: 168, padR: 72, width: 720 });
    const upCount = list.filter((o) => o.deltaPct > 0.5).length;
    const downCount = list.filter((o) => o.deltaPct < -0.5).length;
    $('orcVarMeta').textContent = `${upCount} em alta • ${downCount} em redução`;

    const ups = [...list]
      .filter((o) => o.deltaValue > 0)
      .sort((a, b) => b.deltaValue - a.deltaValue)
      .slice(0, 6)
      .map((o) => ({
        code: o.name.slice(0, 12),
        label: o.name,
        value: o.deltaValue,
        meta: shortMoney(o.deltaValue)
      }));
    const downs = [...list]
      .filter((o) => o.deltaValue < 0)
      .sort((a, b) => a.deltaValue - b.deltaValue)
      .slice(0, 6)
      .map((o) => ({
        code: o.name.slice(0, 12),
        label: o.name,
        value: Math.abs(o.deltaValue),
        meta: shortMoney(o.deltaValue)
      }));

    $('orcTopUp').innerHTML = ups.length
      ? verticalBars(ups, { height: 210, format: shortMoney })
      : '<div class="empty">Nenhum aumento no filtro atual.</div>';
    $('orcTopDown').innerHTML = downs.length
      ? verticalBars(downs, { height: 210, format: shortMoney })
      : '<div class="empty">Nenhuma redução no filtro atual.</div>';
  }

  function renderTable(list) {
    const footer = ui.body.closest('table').tFoot || ui.body.closest('table').createTFoot();
    footer.innerHTML = `<tr><td>Total geral</td>${[
      money(totals.initial2026), pctText(totals.initial2026 ? 100 : 0),
      money(totals.updated), pctText(totals.updated ? 100 : 0), money(totals.paid),
      money(totals.forecastDec2026), money(totals.forecast2027), pctText(totals.forecast2027 ? 100 : 0),
      money(totals.deltaValue), deltaBadge(totals.deltaPct), ppBadge((totals.forecast2027 ? 100 : 0) - (totals.initial2026 ? 100 : 0))
    ].map((v) => `<td class="num">${v}</td>`).join('')}</tr>`;
    $('orcListMeta').textContent = `${intFmt.format(list.length)} secretarias • Δ total ${money(totals.deltaValue)} (${pctText(totals.deltaPct)})`;
    if (!list.length) {
      ui.body.innerHTML = `<tr><td colspan="12" class="empty">Nenhum órgão corresponde aos filtros.</td></tr>`;
      return;
    }
    ui.body.innerHTML = list
      .map((o) => {
        const i = organs.indexOf(o);
        const columns = ['name', 'initial2026', 'share2026', 'updated', 'shareUpdated', 'paid', 'forecastDec2026', 'forecast2027', 'share2027', 'deltaValue', 'deltaPct', 'shareDeltaPp'];
        return `<tr>${columns.map((prop) => {
          const value = prop === 'name' ? esc(o.name) : prop === 'deltaPct' ? deltaBadge(o[prop]) : prop === 'shareDeltaPp' ? ppBadge(o[prop]) : prop.startsWith('share') ? pctText(o[prop]) : money(o[prop]);
          return `<td class="${prop === 'name' ? 'org-cell' : 'num'}"><button type="button" class="orc-cell-edit" data-row="${i}" data-prop="${prop}" aria-label="Editar ${esc(o.name)}: ${prop}">${value}<span aria-hidden="true"> ✎</span></button></td>`;
        }).join('')}</tr>`;
      })
      .join('');
  }

  function render() {
    const list = filtered();
    renderKpis();
    renderCharts(list);
    renderTable(list);
  }

  function exportCSV() {
    const list = filtered();
    const headers = [
      'Secretaria',
      'Orçamento 2026',
      '% 2026',
      'Dotação atualizada',
      '% atualizado',
      'Despesas pagas',
      'Previsão Dez/2026',
      'Previsão 2027',
      '% 2027',
      'Δ R$ 2027-2026',
      'Δ %',
      'Δ p.p. participação'
    ];
    const rows = list.map((o) => [
      o.name,
      o.initial2026,
      o.share2026,
      o.updated,
      o.shareUpdated,
      o.paid,
      o.forecastDec2026,
      o.forecast2027,
      o.share2027,
      o.deltaValue,
      o.deltaPct,
      o.shareDeltaPp
    ]);
    const escCell = (v) => {
      const s = String(v ?? '');
      return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = '\uFEFF' + [headers, ...rows].map((r) => r.map(escCell).join(';')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `Orcamento_2026_2027_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function bind() {
    bindEditors();
    ui.search.addEventListener('input', render);
    ui.trend.addEventListener('change', render);
    ui.sort.addEventListener('change', render);
    ui.reset.addEventListener('click', () => {
      ui.search.value = '';
      ui.trend.value = 'all';
      ui.sort.value = 'deltaDesc';
      render();
    });
    render();
  }

  return { bind, render, exportCSV };

  function bindEditors() {
    const byProp = (prop) => Object.keys(fields).filter((k) => k.endsWith(`.${prop}`));
    const forecast = ['forecast2027', ...byProp('updated'), ...byProp('forecast2027')];
    const initial = byProp('initial2026'), paid = byProp('paid');
    const configs = {
      orcMUpdated: [byProp('updated'), 'Soma das dotações atualizadas das secretarias.'],
      orcMPaid: [paid, 'Soma das despesas pagas das secretarias.'],
      orcM2026: [initial, 'Soma dos orçamentos iniciais das secretarias.'],
      orcMDec: [paid, 'Projeção = despesas pagas ÷ 252 × 365, conforme a planilha.'],
      orcM2027: [forecast, 'Soma das previsões: percentuais da dotação atualizada × base 2027. Câmara e Administração têm valores fixos; Educação usa 32,22% e Saúde 29,01%.'],
      orcMDelta: [[...initial, ...forecast], 'Diferença = previsão 2027 − orçamento 2026.'],
      orcR2026: [['planned2026'], 'Receita orçamentária prevista, informada separadamente na planilha.'],
      orcRCollected: [['collectedSep9'], 'Atualiza a projeção da receita, o percentual arrecadado e os saldos.'],
      orcRDec: [['collectedSep9'], 'Receita projetada = receita arrecadada ÷ 252 × 365.'],
      orcR2027: [['forecast2027'], 'Atualiza também a distribuição das despesas previstas para 2027.'],
      orcRBalance: [['collectedSep9', ...paid], 'Saldo = receita arrecadada − soma das despesas pagas.'],
      orcRBalanceDec: [['collectedSep9', ...paid], 'Saldo previsto = receita projetada − despesas projetadas (÷ 252 × 365).']
    };
    const dialog = document.createElement('dialog');
    dialog.className = 'orc-editor';
    dialog.setAttribute('aria-labelledby', 'orcEditorTitle');
    document.body.append(dialog);
    const format = (n) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    ui.body.addEventListener('click', (event) => {
      const cell = event.target.closest('[data-row]');
      if (!cell) return;
      const i = Number(cell.dataset.row), prop = cell.dataset.prop;
      const rule = db.formulaRules[i];
      const forecastKeys = rule.fixedForecast ? [`${i}.forecast2027`] : ['forecast2027', rule.fixedShare !== null ? `${i}.fixedShare` : `${i}.updated`];
      const dependencies = {
        name: [`${i}.name`], initial2026: [`${i}.initial2026`],
        share2026: [`${i}.initial2026`], updated: [`${i}.updated`],
        shareUpdated: [`${i}.updated`], paid: [`${i}.paid`],
        forecastDec2026: [`${i}.paid`], forecast2027: forecastKeys,
        share2027: forecastKeys, deltaValue: [`${i}.initial2026`, ...forecastKeys],
        deltaPct: [`${i}.initial2026`, ...forecastKeys],
        shareDeltaPp: [`${i}.initial2026`, ...forecastKeys]
      };
      const keys = dependencies[prop];
      if (!keys) return;
      const heading = cell.closest('table').querySelectorAll('th')[cell.closest('td').cellIndex].textContent;
      const computed = !['name', 'initial2026', 'updated', 'paid'].includes(prop) && !(prop === 'forecast2027' && rule.fixedForecast);
      const explanations = {
        share2026: 'Participação = orçamento da secretaria ÷ orçamento total × 100.',
        shareUpdated: 'Participação = dotação da secretaria ÷ dotação total × 100.',
        forecastDec2026: 'Previsão = despesas pagas ÷ 252 × 365.',
        forecast2027: 'Previsão = participação da secretaria × receita prevista 2027. A participação segue a dotação atualizada ou o percentual fixo da planilha.',
        share2027: 'Participação = previsão da secretaria ÷ previsão total × 100.',
        deltaValue: 'Diferença = previsão 2027 − orçamento inicial 2026.',
        deltaPct: 'Variação = (previsão 2027 − orçamento inicial) ÷ orçamento inicial × 100.',
        shareDeltaPp: 'Variação de participação = participação 2027 − participação 2026.'
      };
      dialog.innerHTML = `<form><h2 id="orcEditorTitle">${esc(organs[i].name)} — ${esc(heading)}</h2><p>${computed ? `${esc(explanations[prop])} Edite os valores abaixo para recalcular esta célula e os totais.` : 'Edite o valor e salve para atualizar a tabela e os totais.'}</p><div class="orc-editor-fields">${keys.map((k, n) => {
        const f = fields[k];
        return `<label for="orcCell${n}">${esc(f.label)}<input class="control" id="orcCell${n}" name="${k}" ${f.prop === 'name' ? 'maxlength="120"' : 'inputmode="decimal"'} value="${esc(f.prop === 'name' ? f.target[f.prop] : format(f.target[f.prop]))}" required></label>`;
      }).join('')}</div><p class="orc-editor-error" role="alert"></p><div class="orc-editor-actions"><button class="btn" type="button">Cancelar</button><button class="btn primary" type="submit">Salvar alterações</button></div></form>`;
      const form = dialog.querySelector('form');
      form.querySelector('[type="button"]').onclick = () => dialog.close();
      form.onsubmit = (e) => {
        e.preventDefault();
        const edits = { ...savedEdits };
        for (const k of keys) {
          const input = form.elements.namedItem(k);
          const value = fields[k].prop === 'name' ? input.value.trim() : parseBudgetValue(input.value);
          if (value === null || value === '' || (fields[k].prop === 'fixedShare' && value > 100)) {
            dialog.querySelector('[role="alert"]').textContent = 'Informe um nome ou valor válido. Percentuais devem estar entre 0 e 100.';
            input.focus();
            return;
          }
          edits[k] = value;
        }
        try { localStorage.setItem(storageKey, JSON.stringify({ source: sourceKey, values: edits, titles: savedTitles })); }
        catch {
          dialog.querySelector('[role="alert"]').textContent = 'Não foi possível salvar as alterações no navegador.';
          return;
        }
        savedEdits = edits;
        for (const [k, v] of Object.entries(edits)) fields[k].target[fields[k].prop] = v;
        recalculateBudget(db);
        render();
        dialog.close();
        ui.body.querySelector(`[data-row="${i}"][data-prop="${prop}"]`)?.focus();
      };
      dialog.showModal();
    });
    for (const [id, [keys, description]] of Object.entries(configs)) {
      const card = $(id).closest('.metric');
      const label = card.querySelector('.metric-label');
      let title = savedTitles[id] || label.textContent;
      label.textContent = title;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'orc-edit-button';
      button.setAttribute('aria-label', `Editar ${title}`);
      button.title = `Editar ${title}`;
      button.innerHTML = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m16 3 5 5M3 21l5-1L21 7a2 2 0 0 0-5-5L3 15z"/></svg>';
      card.append(button);
      button.addEventListener('click', () => {
        dialog.innerHTML = `<form><h2 id="orcEditorTitle">Editar ${esc(title)}</h2><p>${esc(description)}</p><p>Valores em reais. As alterações ficam salvas neste navegador.</p><div class="orc-editor-fields"><label for="orcEditTitle">Título do card<input class="control" id="orcEditTitle" name="cardTitle" maxlength="120" value="${esc(title)}" required></label>${keys.map((k, i) => `<label for="orcEdit${i}">${esc(fields[k].label)}<input class="control" id="orcEdit${i}" name="${k}" inputmode="decimal" value="${format(fields[k].target[fields[k].prop])}" required></label>`).join('')}</div><p class="orc-editor-error" role="alert"></p><div class="orc-editor-actions"><button class="btn" type="button">Cancelar</button><button class="btn primary" type="submit">Salvar alterações</button></div></form>`;
        const form = dialog.querySelector('form');
        form.querySelector('[type="button"]').onclick = () => dialog.close();
        form.onsubmit = (event) => {
          event.preventDefault();
          const titleInput = form.elements.namedItem('cardTitle');
          const nextTitle = titleInput.value.trim();
          if (!nextTitle) {
            dialog.querySelector('[role="alert"]').textContent = 'Informe um título para o card.';
            titleInput.focus();
            return;
          }
          const titles = { ...savedTitles, [id]: nextTitle };
          const edits = { ...savedEdits };
          for (const k of keys) {
            const input = form.elements.namedItem(k);
            const value = parseBudgetValue(input.value);
            if (value === null) {
              dialog.querySelector('[role="alert"]').textContent = 'Informe um valor válido, não negativo, como 1.234,56.';
              input.focus();
              return;
            }
            edits[k] = value;
          }
          try { localStorage.setItem(storageKey, JSON.stringify({ source: sourceKey, values: edits, titles })); }
          catch {
            dialog.querySelector('[role="alert"]').textContent = 'Não foi possível salvar neste navegador. Libere espaço ou permita o armazenamento local e tente novamente.';
            return;
          }
          savedEdits = edits;
          savedTitles = titles;
          title = nextTitle;
          label.textContent = title;
          button.title = `Editar ${title}`;
          button.setAttribute('aria-label', `Editar ${title}`);
          for (const [k, v] of Object.entries(edits)) fields[k].target[fields[k].prop] = v;
          recalculateBudget(db);
          render();
          dialog.close();
        };
        dialog.showModal();
      });
    }
  }
}
