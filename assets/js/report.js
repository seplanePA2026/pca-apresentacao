/** Montagem e exportação do relatório PCA (PDF via impressão). */

import {
  $,
  esc,
  money,
  moneyWithDelta,
  moneyWithShare,
  pct,
  pctText,
  sum,
  variation,
  deltaBadge,
  shareBadge,
  sharePct
} from './utils.js';

const REPORT_SECTIONS = [
  { id: 'cover', label: 'Capa institucional (modelo SEPLANE)', defaultOn: true },
  { id: 'toc', label: 'Sumário', defaultOn: true },
  { id: 'criteria', label: 'Critérios e notas metodológicas', defaultOn: true },
  { id: 'scopeCards', label: 'Cards consolidados do escopo', defaultOn: true },
  { id: 'orgCards', label: 'Cards detalhados por secretaria/órgão', defaultOn: true },
  { id: 'units', label: 'Locais / unidades orçamentárias', defaultOn: true },
  { id: 'actions', label: 'Ações orçamentárias', defaultOn: true },
  { id: 'expenses', label: 'Detalhamento de despesas e fontes', defaultOn: true },
  { id: 'indicators', label: 'Indicadores percentuais', defaultOn: true }
];

function todayBR() {
  return new Date().toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });
}

function nowTimeBR() {
  return new Date().toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit'
  });
}

function stampBR() {
  const d = new Date();
  return {
    date: d.toLocaleDateString('pt-BR'),
    time: d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    longDate: todayBR()
  };
}

function cardsBlock(title, rec, parentInitial = null) {
  const p = pct(rec.balance, rec.updated);
  const committed = rec.updated - rec.balance;
  const cp = p === null ? null : 100 - p;
  const vUpd = variation(rec.initial, rec.updated);
  const shareInit = parentInitial == null ? null : sharePct(rec.initial, parentInitial);
  return `
  <section class="rep-cards">
    <h3 class="rep-cards-title">${esc(title)}</h3>
    <div class="rep-cards-grid">
      <article class="rep-card">
        <div class="rep-card-label">Dotação Inicial</div>
        <div class="rep-card-value">${money(rec.initial)} ${
          shareInit == null ? '' : shareBadge(shareInit)
        }</div>
        <div class="rep-card-sub">${shareInit == null ? 'Base inicial' : 'Participação no total inicial'}</div>
      </article>
      <article class="rep-card">
        <div class="rep-card-label">Dotação Atualizada</div>
        <div class="rep-card-value">${money(rec.updated)} ${deltaBadge(vUpd)}</div>
        <div class="rep-card-sub">Variação vs. inicial</div>
      </article>
      <article class="rep-card rep-card-green">
        <div class="rep-card-label">Saldo Disponível</div>
        <div class="rep-card-value">${money(rec.balance)}</div>
        <div class="rep-card-sub">${pctText(p)} da dotação atualizada</div>
      </article>
      <article class="rep-card">
        <div class="rep-card-label">Parcela não disponível</div>
        <div class="rep-card-value">${money(committed)}</div>
        <div class="rep-card-sub">${pctText(cp)} da dotação atualizada</div>
      </article>
    </div>
  </section>`;
}

function buildRunningFooter(stamp) {
  return `
  <div class="rep-running-footer">
    <div class="rep-running-footer-inner">
      <img src="./Logos/PMPA_logo_01.png" alt="Prefeitura Municipal de Paulo Afonso" class="rep-foot-logo">
      <div class="rep-foot-text">
        <strong>Secretaria Municipal de Planejamento Estratégico</strong>
        <span>PCA — Paulo Afonso · ${esc(stamp.date)} · ${esc(stamp.time)}</span>
      </div>
    </div>
  </div>`;
}

function buildCover(scopeLabel, scopeRec, selectedCount, stamp) {
  const p = pct(scopeRec.balance, scopeRec.updated);
  return `
  <section class="rep-cover">
    <div class="rep-cover-banner-wrap">
      <img class="rep-cover-banner" src="./Logos/capa_seplane.png" alt="Secretaria Municipal de Planejamento Estratégico — Paulo Afonso">
    </div>
    <div class="rep-cover-body">
      <div class="rep-cover-brandline">
        <img class="rep-cover-logo" src="./Logos/PMPA_logo_01.png" alt="Prefeitura de Paulo Afonso">
        <div>
          <p class="rep-cover-eyebrow">Prefeitura Municipal de Paulo Afonso — Bahia</p>
          <p class="rep-cover-seplane">Secretaria Municipal de Planejamento Estratégico</p>
        </div>
      </div>
      <div class="rep-cover-rule"></div>
      <h1>Relatório Orçamentário</h1>
      <p class="rep-cover-subtitle">PCA — Plano de Contratações Anual</p>
      <p class="rep-cover-scope">${esc(scopeLabel)}</p>
      <p class="rep-cover-tagline">Base financeira oficial • Consulta e consolidação orçamentária</p>
      <ul class="rep-cover-bullets">
        <li><strong>Órgãos no relatório:</strong> ${selectedCount}</li>
        <li><strong>Dotação Inicial:</strong> ${money(scopeRec.initial)}</li>
        <li><strong>Dotação Atualizada:</strong> ${money(scopeRec.updated)}</li>
        <li><strong>Saldo Disponível:</strong> ${money(scopeRec.balance)} (${pctText(p)})</li>
      </ul>
      <div class="rep-cover-meta">
        <span><strong>Emissão:</strong> ${esc(stamp.longDate)} às ${esc(stamp.time)}</span>
        <span><strong>Competência:</strong> Agosto/2026</span>
        <span><strong>Versão:</strong> 1.0</span>
      </div>
      <p class="rep-cover-sources">Fontes: Demonstrativos de Despesa Orçamentária — Consolidado (Agosto/2026). Valores oficiais sem arredondamento analítico.</p>
    </div>
  </section>`;
}

function buildToc(entries) {
  return `
  <section class="rep-section rep-toc">
    <h2>Sumário</h2>
    <ol class="rep-toc-list">
      ${entries.map((e) => `<li><span class="toc-num">${esc(e.num)}</span><span class="toc-label">${esc(e.label)}</span></li>`).join('')}
    </ol>
  </section>`;
}

/**
 * @param {object[]} organs
 * @param {{ organCodes: string[], sections: Set<string> }} opts
 */
export function buildReportHTML(organs, opts) {
  const stamp = stampBR();
  const selected =
    opts.organCodes.includes('all') || opts.organCodes.length === 0
      ? organs
      : organs.filter((o) => opts.organCodes.includes(o.code));

  const sections = opts.sections;
  const scopeRec = {
    initial: sum(selected, 'initial'),
    updated: sum(selected, 'updated'),
    balance: sum(selected, 'balance')
  };

  const scopeLabel =
    selected.length === organs.length
      ? 'Consolidado municipal — todos os órgãos carregados'
      : selected.length === 1
        ? `${selected[0].code} — ${selected[0].name}`
        : `${selected.length} órgãos selecionados`;

  const toc = [];
  let chapter = 1;
  const parts = [];

  parts.push(buildRunningFooter(stamp));

  if (sections.has('cover')) {
    parts.push(buildCover(scopeLabel, scopeRec, selected.length, stamp));
  }

  if (sections.has('criteria')) {
    toc.push({ num: String(chapter), label: 'Critérios e notas metodológicas' });
  }
  if (sections.has('scopeCards')) {
    toc.push({ num: String(chapter + (sections.has('criteria') ? 1 : 0)), label: 'Visão consolidada do escopo' });
  }

  let detailChapter = chapter + (sections.has('criteria') ? 1 : 0) + (sections.has('scopeCards') ? 1 : 0);
  if (sections.has('orgCards') || sections.has('units') || sections.has('actions') || sections.has('expenses')) {
    toc.push({ num: String(detailChapter), label: 'Detalhamento por secretaria / órgão' });
    selected.forEach((o, i) => {
      toc.push({ num: `${detailChapter}.${i + 1}`, label: `${o.code} — ${o.name}` });
    });
  }

  if (sections.has('toc') && toc.length) {
    parts.push(buildToc(toc));
  }

  if (sections.has('criteria')) {
    parts.push(`
    <section class="rep-section">
      <h2>${chapter}. Critérios e notas metodológicas</h2>
      <p>Este relatório apresenta exclusivamente <strong>Dotação Inicial</strong>, <strong>Dotação Atualizada</strong> e <strong>Saldo Disponível</strong>, extraídos dos demonstrativos oficiais do município.</p>
      <ul>
        <li><strong>% disponível</strong> = Saldo Disponível ÷ Dotação Atualizada × 100.</li>
        <li><strong>Parcela não disponível</strong> = Dotação Atualizada − Saldo Disponível.</li>
        <li><strong>Variação da dotação</strong> = ((Atualizada − Inicial) ÷ Inicial) × 100; quando a inicial for zero, registra-se N/A.</li>
        <li>Totais hierárquicos respeitam a estrutura órgão → unidade → ação → elemento/fonte, sem somar níveis mistos.</li>
        <li>Valores orçamentários não representam, por si sós, contratações do PCA (DFD).</li>
      </ul>
    </section>`);
    chapter += 1;
  }

  if (sections.has('scopeCards')) {
    parts.push(`
    <section class="rep-section">
      <h2>${chapter}. Visão consolidada do escopo</h2>
      <p class="rep-lead">${esc(scopeLabel)}</p>
      ${cardsBlock('Indicadores consolidados', scopeRec, scopeRec.initial)}
      ${
        sections.has('indicators')
          ? `<div class="rep-note">Participação no orçamento municipal atualizado: ${pctText(
              organs.length ? (scopeRec.updated / sum(organs, 'updated')) * 100 : null
            )}.</div>`
          : ''
      }
    </section>`);
    chapter += 1;
  }

  if (sections.has('orgCards') || sections.has('units') || sections.has('actions') || sections.has('expenses')) {
    parts.push(`<section class="rep-section"><h2>${chapter}. Detalhamento por secretaria / órgão</h2></section>`);

    selected.forEach((org, idx) => {
      const orgP = pct(org.balance, org.updated);
      let block = `
      <section class="rep-org">
        <h3>${chapter}.${idx + 1} ${esc(org.code)} — ${esc(org.name)}</h3>`;

      if (sections.has('orgCards')) {
        block += cardsBlock('Cards do órgão', org, scopeRec.initial);
        if (sections.has('indicators')) {
          block += `<div class="rep-note">% disponível do órgão: <strong>${pctText(orgP)}</strong> · Unidades: ${org.units.length} · Ações: ${org.units.reduce(
            (t, u) => t + u.actions.length,
            0
          )}</div>`;
        }
      }

      if (sections.has('units')) {
        block += `
        <h4>Locais / Unidades</h4>
        <table class="rep-table">
          <thead>
            <tr>
              <th>Código</th><th>Unidade</th>
              <th class="num">Dotação Inicial</th>
              <th class="num">Dotação Atualizada</th>
              <th class="num">Saldo Disponível</th>
              <th class="num">% disp.</th>
            </tr>
          </thead>
          <tbody>
            ${org.units
              .map(
                (u) => `<tr>
              <td>${esc(u.code)}</td>
              <td>${esc(u.name)}</td>
              <td class="num">${moneyWithShare(
                u.initial,
                sharePct(u.initial, org.initial),
                'Participação na Dotação Inicial do órgão'
              )}</td>
              <td class="num">${moneyWithDelta(
                u.updated,
                variation(u.initial, u.updated),
                'Variação vs. Dotação Inicial'
              )}</td>
              <td class="num">${money(u.balance)}</td>
              <td class="num">${pctText(pct(u.balance, u.updated))}</td>
            </tr>`
              )
              .join('')}
          </tbody>
        </table>`;
      }

      if (sections.has('actions') || sections.has('expenses')) {
        for (const u of org.units) {
          block += `<h4>${esc(u.code)} — ${esc(u.name)}</h4>`;
          if (sections.has('actions')) {
            block += cardsBlock(`Totais da unidade ${u.code}`, u, org.initial);
          }

          for (const a of u.actions) {
            if (sections.has('actions')) {
              block += `
              <div class="rep-action">
                <div class="rep-action-head">
                  <strong>${esc(a.code)}</strong>
                  <span>${esc(a.name)}</span>
                </div>
                <div class="rep-action-metrics">
                  <span class="rep-metric-line">Inicial: ${moneyWithShare(
                    a.initial,
                    sharePct(a.initial, u.initial),
                    'Participação na Dotação Inicial da unidade'
                  )}</span>
                  <span class="rep-metric-line">Atualizada: ${moneyWithDelta(
                    a.updated,
                    variation(a.initial, a.updated),
                    'Variação vs. Dotação Inicial'
                  )}</span>
                  <span>Saldo: ${money(a.balance)}</span>
                  <span>${pctText(pct(a.balance, a.updated))} disponível</span>
                </div>`;
            }

            if (sections.has('expenses')) {
              block += `
              <table class="rep-table rep-table-sm">
                <thead>
                  <tr>
                    <th>Elemento / Especificação</th>
                    <th>Fonte</th>
                    <th class="num">Inicial</th>
                    <th class="num">Atualizada</th>
                    <th class="num">Saldo</th>
                    <th class="num">% disp.</th>
                  </tr>
                </thead>
                <tbody>
                  ${a.items
                    .map(
                      (i) => `<tr>
                    <td><div class="rep-item-name">${esc(i.name)}</div><div class="rep-item-code">${esc(i.code)}</div></td>
                    <td>${esc(i.source)}</td>
                    <td class="num">${moneyWithShare(
                      i.initial,
                      sharePct(i.initial, a.initial),
                      'Participação na Dotação Inicial da ação'
                    )}</td>
                    <td class="num">${moneyWithDelta(
                      i.updated,
                      variation(i.initial, i.updated),
                      'Variação vs. Dotação Inicial'
                    )}</td>
                    <td class="num">${money(i.balance)}</td>
                    <td class="num">${pctText(pct(i.balance, i.updated))}</td>
                  </tr>`
                    )
                    .join('')}
                </tbody>
              </table>`;
            }

            if (sections.has('actions')) block += `</div>`;
          }
        }
      }

      block += `</section>`;
      parts.push(block);
    });
  }

  parts.push(`
  <section class="rep-endnote">
    <p>PCA — Paulo Afonso · Relatório gerado em ${esc(stamp.longDate)} às ${esc(stamp.time)} · Competência Agosto/2026</p>
    <p>Documento de consulta orçamentária. A formalização das contratações permanece vinculada aos DFDs e ao fluxo do PCA.</p>
  </section>`);

  return parts.join('\n');
}

/**
 * Abre o modal de configuração do relatório.
 * @param {object[]} organs
 */
export function createReportExporter(organs) {
  const modal = $('exportModal');
  const organList = $('exportOrganList');
  const sectionList = $('exportSectionList');
  const scopeAll = $('exportScopeAll');
  const scopeSelected = $('exportScopeSelected');
  const preview = $('reportDocument');

  function renderOrganChecks() {
    organList.innerHTML = organs
      .map(
        (o) => `<label class="export-check">
      <input type="checkbox" name="exportOrg" value="${esc(o.code)}" checked>
      <span><strong>${esc(o.code)}</strong> — ${esc(o.name)}</span>
    </label>`
      )
      .join('');
  }

  function renderSectionChecks() {
    sectionList.innerHTML = REPORT_SECTIONS.map(
      (s) => `<label class="export-check">
      <input type="checkbox" name="exportSection" value="${esc(s.id)}" ${s.defaultOn ? 'checked' : ''}>
      <span>${esc(s.label)}</span>
    </label>`
    ).join('');
  }

  function updateScopeMode() {
    const all = scopeAll.checked;
    organList.classList.toggle('is-disabled', all);
    organList.querySelectorAll('input').forEach((inp) => {
      inp.disabled = all;
    });
  }

  function selectedOrganCodes() {
    if (scopeAll.checked) return ['all'];
    return [...organList.querySelectorAll('input[name="exportOrg"]:checked')].map((i) => i.value);
  }

  function selectedSections() {
    return new Set([...sectionList.querySelectorAll('input[name="exportSection"]:checked')].map((i) => i.value));
  }

  function open() {
    modal.classList.remove('hidden');
    document.body.classList.add('modal-open');
  }

  function close() {
    modal.classList.add('hidden');
    document.body.classList.remove('modal-open');
  }

  function generateAndPrint() {
    const codes = selectedOrganCodes();
    const sections = selectedSections();
    if (!scopeAll.checked && codes.length === 0) {
      alert('Selecione ao menos uma secretaria/órgão.');
      return;
    }
    if (sections.size === 0) {
      alert('Selecione ao menos uma seção do relatório.');
      return;
    }

    preview.innerHTML = buildReportHTML(organs, { organCodes: codes, sections });
    document.body.classList.add('printing-report');
    close();

    requestAnimationFrame(() => {
      window.print();
      setTimeout(() => {
        document.body.classList.remove('printing-report');
      }, 500);
    });
  }

  function bind() {
    renderOrganChecks();
    renderSectionChecks();
    updateScopeMode();

    scopeAll.addEventListener('change', updateScopeMode);
    scopeSelected.addEventListener('change', updateScopeMode);
    $('exportCloseBtn')?.addEventListener('click', close);
    $('exportCancelBtn')?.addEventListener('click', close);
    $('exportSelectAllOrgs')?.addEventListener('click', () => {
      organList.querySelectorAll('input').forEach((i) => {
        i.checked = true;
      });
    });
    $('exportClearOrgs')?.addEventListener('click', () => {
      organList.querySelectorAll('input').forEach((i) => {
        i.checked = false;
      });
      scopeSelected.checked = true;
      updateScopeMode();
    });
    $('exportGenerateBtn')?.addEventListener('click', generateAndPrint);

    modal.addEventListener('click', (e) => {
      if (e.target === modal) close();
    });
  }

  return { open, close, bind };
}
