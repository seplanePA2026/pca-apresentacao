/** Renderização da visão geral, locais, escopo e detalhamento. */

import {
  $,
  availabilityClass,
  clamp,
  deltaBadge,
  esc,
  money,
  moneyWithDelta,
  moneyWithShare,
  normalize,
  pct,
  pctText,
  shareBadge,
  sharePct,
  sum,
  variation
} from './utils.js';
import { actionMatches, filterByAvailability, filteredItems, sortActions } from './filters.js';

/**
 * @param {object[]} organs
 * @param {object} ui
 * @param {{ expandAll: boolean }} state
 */
export function createRenderer(organs, ui, state) {
  const {
    orgSelect,
    unitSelect,
    search,
    availability,
    sort,
    overviewSection,
    localsSection,
    detailSection
  } = ui;

  const municipalInitial = sum(organs, 'initial');

  function activeOrg() {
    return organs.find((o) => o.code === orgSelect.value) || null;
  }

  function activeUnits() {
    const o = activeOrg();
    if (!o) return organs.flatMap((x) => x.units);
    if (unitSelect.value === 'all') return o.units;
    return o.units.filter((u) => u.code === unitSelect.value);
  }

  function scopeRecord() {
    const o = activeOrg();
    if (!o) {
      return {
        initial: sum(organs, 'initial'),
        updated: sum(organs, 'updated'),
        balance: sum(organs, 'balance')
      };
    }
    if (unitSelect.value === 'all') return o;
    return o.units.find((u) => u.code === unitSelect.value) || o;
  }

  function populateOrgSelect() {
    orgSelect.innerHTML =
      '<option value="all">Todos os órgãos</option>' +
      organs.map((o) => `<option value="${esc(o.code)}">${esc(o.code)} — ${esc(o.name)}</option>`).join('');
  }

  function populateUnitSelect() {
    const o = activeOrg();
    if (!o) {
      unitSelect.innerHTML = '<option value="all">Todos os locais</option>';
      unitSelect.disabled = true;
      return;
    }
    unitSelect.disabled = false;
    const prev = unitSelect.value;
    unitSelect.innerHTML =
      '<option value="all">Todos os locais / unidades</option>' +
      o.units.map((u) => `<option value="${esc(u.code)}">${esc(u.code)} — ${esc(u.name)}</option>`).join('');
    if ([...unitSelect.options].some((x) => x.value === prev)) unitSelect.value = prev;
  }

  function renderScope() {
    const rec = scopeRecord();
    const p = pct(rec.balance, rec.updated);
    const committed = rec.updated - rec.balance;
    const cp = p === null ? null : 100 - p;
    const shareInit = sharePct(rec.initial, municipalInitial);
    const vUpdated = variation(rec.initial, rec.updated);

    $('mInitial').textContent = money(rec.initial);
    $('mUpdated').textContent = money(rec.updated);
    $('mBalance').textContent = money(rec.balance);
    $('mCommitted').textContent = money(committed);

    $('mInitialDelta').innerHTML = shareBadge(shareInit, {
      title: 'Participação na Dotação Inicial municipal'
    });
    $('mUpdatedDelta').innerHTML = deltaBadge(vUpdated, {
      title: 'Variação da Dotação Atualizada em relação à Inicial'
    });
    $('mInitialSub').textContent = 'Participação no total inicial municipal';
    $('mVariation').textContent =
      vUpdated === 0 ? 'Sem alteração frente à inicial' : 'Variação frente à dotação inicial';

    $('mBalancePct').textContent = `${pctText(p)} da dotação atualizada`;
    $('mCommittedPct').textContent = `${pctText(cp)} da dotação atualizada`;
    $('balanceBar').style.width = `${clamp(p)}%`;
    $('committedBar').style.width = `${clamp(cp)}%`;
  }

  function renderOverview() {
    const body = $('overviewBody');
    const totalUpdated = sum(organs, 'updated');
    body.innerHTML = organs
      .map((o) => {
        const p = pct(o.balance, o.updated);
        const cl = availabilityClass(p, o.balance);
        return `<tr>
      <td class="org-cell"><div class="code">${esc(o.code)}</div><div class="name">${esc(o.name)}</div></td>
      <td class="num">${moneyWithShare(
        o.initial,
        sharePct(o.initial, municipalInitial),
        'Participação na Dotação Inicial municipal'
      )}</td>
      <td class="num">${moneyWithDelta(
        o.updated,
        variation(o.initial, o.updated),
        'Variação vs. Dotação Inicial'
      )}</td>
      <td class="num">${money(o.balance)}</td>
      <td class="num"><span class="badge ${cl}">${pctText(p)}</span></td>
      <td class="num"><button class="row-btn open-org" data-code="${esc(o.code)}" type="button">Abrir</button></td>
    </tr>`;
      })
      .join('');
    $('overviewMeta').textContent = `${organs.length} órgãos • ${money(totalUpdated)} de dotação atualizada`;
    body.querySelectorAll('.open-org').forEach((b) =>
      b.addEventListener('click', () => {
        orgSelect.value = b.dataset.code;
        unitSelect.value = 'all';
        populateUnitSelect();
        render();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      })
    );
  }

  function renderLocals() {
    const o = activeOrg();
    if (!o) {
      localsSection.classList.add('hidden');
      return;
    }
    localsSection.classList.remove('hidden');
    const cards = $('localCards');
    const allActive = unitSelect.value === 'all';
    const allP = pct(o.balance, o.updated);
    const blocks = [
      `<button class="local-card ${allActive ? 'active' : ''}" data-unit="all" type="button">
    <div class="code">TODOS</div><div class="name">Todos os locais / unidades</div>
    <div class="summary"><span>${money(o.updated)}</span><span>${pctText(allP)} disponível</span></div>
  </button>`
    ];
    for (const u of o.units) {
      const p = pct(u.balance, u.updated);
      blocks.push(`<button class="local-card ${unitSelect.value === u.code ? 'active' : ''}" data-unit="${esc(
        u.code
      )}" type="button">
      <div class="code">${esc(u.code)}</div><div class="name">${esc(u.name)}</div>
      <div class="summary"><span>${money(u.updated)}</span><span>${pctText(p)} disponível</span></div>
    </button>`);
    }
    cards.innerHTML = blocks.join('');
    $('localsMeta').textContent = `${o.units.length} ${o.units.length === 1 ? 'unidade' : 'unidades'} no órgão`;
    cards.querySelectorAll('.local-card').forEach((c) =>
      c.addEventListener('click', () => {
        unitSelect.value = c.dataset.unit;
        render();
      })
    );
  }

  function actionHTML(a, term, unitInitial) {
    const p = pct(a.balance, a.updated);
    const cl = availabilityClass(p, a.balance);
    const shareInit = sharePct(a.initial, unitInitial);
    const dUpd = variation(a.initial, a.updated);
    const items = filteredItems(a, term).filter((i) =>
      filterByAvailability(i.balance, i.updated, availability.value)
    );
    return `<article class="action ${state.expandAll ? 'open' : ''}">
    <button class="action-head" type="button" aria-expanded="${state.expandAll ? 'true' : 'false'}">
      <div class="action-title">
        <div class="code">${esc(a.code)}</div>
        <div class="name">${esc(a.name)}</div>
      </div>
      <div class="action-stat initial">
        <div class="label">Dotação Inicial</div>
        <div class="value money-delta">
          <span class="money-delta-val">${money(a.initial)}</span>
          ${shareBadge(shareInit, { title: 'Participação na Dotação Inicial da unidade' })}
        </div>
      </div>
      <div class="action-stat updated">
        <div class="label">Dotação Atualizada</div>
        <div class="value money-delta">
          <span class="money-delta-val">${money(a.updated)}</span>
          ${deltaBadge(dUpd, { title: 'Variação vs. Dotação Inicial da ação' })}
        </div>
      </div>
      <div class="action-stat balance">
        <div class="label">Saldo Disponível</div><div class="value">${money(a.balance)}</div>
        <span class="badge ${cl}" style="margin-top:5px">${pctText(p)}</span>
      </div>
      <div class="chev">⌄</div>
    </button>
    <div class="action-body"><div class="items-wrap"><table class="items-table">
      <thead><tr><th>Especificação</th><th class="num">Dotação Inicial</th><th class="num">Dotação Atualizada</th><th class="num">Saldo Disponível</th></tr></thead>
      <tbody>${items
        .map((i) => {
          const ip = pct(i.balance, i.updated);
          const icl = availabilityClass(ip, i.balance);
          return `<tr>
          <td class="item-spec"><div class="item-title">${esc(i.name)}</div><div class="item-meta">Elemento ${esc(
            i.code
          )} • Fonte ${esc(i.source)}</div></td>
          <td class="num">${moneyWithShare(
            i.initial,
            sharePct(i.initial, a.initial),
            'Participação na Dotação Inicial da ação'
          )}</td>
          <td class="num">${moneyWithDelta(
            i.updated,
            variation(i.initial, i.updated),
            'Variação vs. Dotação Inicial da linha'
          )}</td>
          <td class="num balance-cell">
            <div class="balance-line"><span>${money(i.balance)}</span><span class="badge ${icl}">${pctText(
              ip
            )}</span></div>
            <div class="mini-track"><div class="mini-fill" style="width:${clamp(ip)}%"></div></div>
          </td>
        </tr>`;
        })
        .join('')}</tbody>
    </table></div></div>
  </article>`;
  }

  function renderDetail() {
    const o = activeOrg();
    if (!o) {
      detailSection.classList.add('hidden');
      return;
    }
    detailSection.classList.remove('hidden');
    const units = activeUnits();
    const term = normalize(search.value.trim());
    let shownActions = 0;
    let shownItems = 0;
    const groups = [];
    for (const u of units) {
      let acts = u.actions
        .filter((a) => actionMatches(a, term))
        .filter(
          (a) =>
            filterByAvailability(a.balance, a.updated, availability.value) ||
            a.items.some((i) => filterByAvailability(i.balance, i.updated, availability.value))
        );
      acts = sortActions(acts, sort.value);
      if (!acts.length) continue;
      shownActions += acts.length;
      shownItems += acts.reduce(
        (t, a) =>
          t +
          filteredItems(a, term).filter((i) =>
            filterByAvailability(i.balance, i.updated, availability.value)
          ).length,
        0
      );
      groups.push(`<section class="unit-group">
      <div class="unit-header">
        <div class="unit-header-left"><div class="code">${esc(u.code)}</div><div class="name">${esc(u.name)}</div></div>
        <div class="unit-total">${money(u.updated)} atualizada • ${pctText(pct(u.balance, u.updated))} disponível</div>
      </div>
      ${acts.map((a) => actionHTML(a, term, u.initial)).join('')}
    </section>`);
    }
    const root = $('actionGroups');
    root.innerHTML = groups.join('');
    $('emptyState').classList.toggle('hidden', groups.length > 0);
    $('detailMeta').textContent = `${shownActions} ${shownActions === 1 ? 'ação' : 'ações'} • ${shownItems} linhas exibidas`;
    const selectedUnit = unitSelect.value === 'all' ? 'Todos os locais / unidades' : units[0]?.name || '';
    $('detailSubtitle').textContent = `${o.name} • ${selectedUnit}`;
    root.querySelectorAll('.action-head').forEach((head) =>
      head.addEventListener('click', () => {
        const card = head.closest('.action');
        card.classList.toggle('open');
        head.setAttribute('aria-expanded', card.classList.contains('open') ? 'true' : 'false');
      })
    );
  }

  function renderVisibility() {
    const o = activeOrg();
    overviewSection.classList.toggle('hidden', !!o);
  }

  function render() {
    renderVisibility();
    renderScope();
    renderLocals();
    renderDetail();
  }

  return {
    activeOrg,
    activeUnits,
    populateOrgSelect,
    populateUnitSelect,
    renderOverview,
    renderDetail,
    render
  };
}
