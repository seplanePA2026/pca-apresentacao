/**
 * Controle Orçamentário - Paulo Afonso
 * Navegação: Consulta | PCA 2027 | Exportação contextual
 */

import { $ } from './utils.js';
import { validateDB } from './validation.js';
import { createRenderer } from './render.js';
import { createReportExporter } from './report.js';
import { createPCA } from './pca.js';

const DATA_URL = './data/organs.json';
let currentView = 'consulta';

async function loadOrgans() {
  const res = await fetch(DATA_URL);
  if (!res.ok) {
    throw new Error(
      `Não foi possível carregar ${DATA_URL} (HTTP ${res.status}). Abra o projeto via servidor local (veja docs/README.md).`
    );
  }
  const data = await res.json();
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error('Base orçamentária vazia ou inválida.');
  }
  return data;
}

function showFatal(message) {
  console.error(message);
  document.body.insertAdjacentHTML(
    'afterbegin',
    `<div class="callout" style="margin:16px 24px;border-color:var(--red);color:var(--red)">${message}</div>`
  );
}

function setView(view) {
  currentView = view;
  const consulta = $('viewConsulta');
  const pca = $('viewPCA');
  const navConsulta = $('navConsulta');
  const navPCA = $('navPCA');
  const exportBtn = $('exportBtn');
  const brandSub = $('brandSub');
  const footerSource = $('footerSource');
  const footerNote = $('footerNote');

  const isPCA = view === 'pca';
  consulta.classList.toggle('hidden', isPCA);
  pca.classList.toggle('hidden', !isPCA);

  navConsulta.classList.toggle('active', !isPCA);
  navPCA.classList.toggle('active', isPCA);
  navConsulta.setAttribute('aria-current', isPCA ? 'false' : 'page');
  navPCA.setAttribute('aria-current', isPCA ? 'page' : 'false');
  exportBtn.textContent = isPCA ? 'Exportar PCA' : 'Exportar';
  brandSub.textContent = isPCA ? 'Planejamento de contratações • PCA 2027' : 'Base orçamentária consolidada • Agosto/2026';
  footerSource.textContent = isPCA ? 'PCA Municipal 2027 — base local de demandas e DFDs.' : 'Fonte: Demonstrativos de Despesa Orçamentária — Prefeitura Municipal de Paulo Afonso — Agosto/2026.';
  footerNote.textContent = isPCA ? 'O módulo de planejamento é independente da execução orçamentária nesta etapa.' : 'Interface de consulta da base orçamentária. A formalização das contratações permanece vinculada aos DFDs e ao fluxo do PCA.';
}

async function main() {
  let organs;
  try {
    organs = await loadOrgans();
  } catch (err) {
    showFatal(err.message || String(err));
    return;
  }

  const ui = {
    orgSelect: $('orgSelect'),
    unitSelect: $('unitSelect'),
    search: $('search'),
    availability: $('availability'),
    sort: $('sort'),
    overviewSection: $('overviewSection'),
    localsSection: $('localsSection'),
    detailSection: $('detailSection')
  };

  const state = { expandAll: false };
  const renderer = createRenderer(organs, ui, state);
  const report = createReportExporter(organs);
  const pca = createPCA(organs);

  ui.orgSelect.addEventListener('change', () => {
    ui.unitSelect.value = 'all';
    renderer.populateUnitSelect();
    ui.search.value = '';
    renderer.render();
  });
  ui.unitSelect.addEventListener('change', renderer.render);
  ui.search.addEventListener('input', renderer.renderDetail);
  ui.availability.addEventListener('change', renderer.renderDetail);
  ui.sort.addEventListener('change', renderer.renderDetail);

  $('resetBtn').addEventListener('click', () => {
    ui.orgSelect.value = 'all';
    renderer.populateUnitSelect();
    ui.search.value = '';
    ui.availability.value = 'all';
    ui.sort.value = 'code';
    state.expandAll = false;
    $('expandBtn').textContent = 'Expandir ações';
    renderer.render();
  });

  $('expandBtn').addEventListener('click', () => {
    state.expandAll = !state.expandAll;
    $('expandBtn').textContent = state.expandAll ? 'Recolher ações' : 'Expandir ações';
    renderer.renderDetail();
  });

  $('exportBtn').addEventListener('click', () => {
    if (currentView === 'pca') pca.exportCSV();
    else report.open();
  });

  $('navConsulta').addEventListener('click', () => setView('consulta'));
  $('navPCA').addEventListener('click', () => {
    setView('pca');
    pca.render();
  });

  renderer.populateOrgSelect();
  renderer.populateUnitSelect();
  report.bind();
  pca.bind();
  validateDB(organs);
  renderer.renderOverview();
  renderer.render();
  setView('consulta');
}

main();
