/**
 * Controle Orçamentário - Paulo Afonso
 * Navegação: Consulta | Cadastro
 */

import { $ } from './utils.js';
import { createRenderer } from './render.js';
import { createPCA } from './pca.js';

const PCAS_URL = './data/pcas_enviados.json';
const ORGANS_URL = './data/organs.json';
let currentView = 'consulta';

async function loadJSON(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(
      `Não foi possível carregar ${url} (HTTP ${res.status}). Abra o projeto via servidor local (veja docs/README.md).`
    );
  }
  return res.json();
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
  const views = {
    consulta: $('viewConsulta'),
    pca: $('viewPCA')
  };
  const navs = {
    consulta: $('navConsulta'),
    pca: $('navPCA')
  };
  const exportBtn = $('exportBtn');
  const brandSub = $('brandSub');
  const footerSource = $('footerSource');
  const footerNote = $('footerNote');

  Object.entries(views).forEach(([key, el]) => {
    el.classList.toggle('hidden', key !== view);
  });
  Object.entries(navs).forEach(([key, el]) => {
    const active = key === view;
    el.classList.toggle('active', active);
    el.setAttribute('aria-current', active ? 'page' : 'false');
  });

  if (view === 'pca') {
    exportBtn.textContent = 'Exportar Cadastro';
    brandSub.textContent = 'Cadastro de demandas • PCA 2027';
    footerSource.textContent = 'PCA Municipal 2027 — base local de demandas e DFDs.';
    footerNote.textContent = 'Módulo de cadastro independente da consulta.';
  } else {
    exportBtn.textContent = 'Exportar';
    brandSub.textContent = 'PCAs enviados pelas secretarias • 2027';
    footerSource.textContent = 'Fonte: PCAs enviados pelas secretarias / órgãos (pasta PCAs_Enviados).';
    footerNote.textContent = 'Consulta dos valores totais e demandas dos PCAs já enviados. Separação por secretaria e setor.';
  }
}

async function main() {
  let db;
  let organCatalog;
  try {
    [db, organCatalog] = await Promise.all([
      loadJSON(PCAS_URL),
      loadJSON(ORGANS_URL)
    ]);
  } catch (err) {
    showFatal(err.message || String(err));
    return;
  }

  if (!db?.organs?.length) {
    showFatal('Nenhum PCA enviado encontrado em data/pcas_enviados.json.');
    return;
  }

  const catalog = Array.isArray(organCatalog)
    ? organCatalog.map((o) => ({ code: o.code, name: o.name }))
    : db.organs.map((o) => ({ code: o.code, name: o.name }));

  const ui = {
    orgSelect: $('orgSelect'),
    unitSelect: $('unitSelect'),
    search: $('search'),
    sort: $('sort'),
    overviewSection: $('overviewSection'),
    localsSection: $('localsSection'),
    detailSection: $('detailSection')
  };

  const renderer = createRenderer(db, ui);
  const pca = createPCA(catalog);

  ui.orgSelect.addEventListener('change', () => {
    ui.unitSelect.value = 'all';
    renderer.populateUnitSelect();
    ui.search.value = '';
    renderer.render();
  });
  ui.unitSelect.addEventListener('change', () => renderer.render());
  ui.search.addEventListener('input', () => renderer.renderDetail());
  ui.sort.addEventListener('change', () => {
    const prev = ui.orgSelect.value;
    renderer.populateOrgSelect();
    if ([...ui.orgSelect.options].some((o) => o.value === prev)) ui.orgSelect.value = prev;
    renderer.render();
  });

  $('resetBtn').addEventListener('click', () => {
    ui.orgSelect.value = 'all';
    renderer.populateUnitSelect();
    ui.search.value = '';
    ui.sort.value = 'totalDesc';
    renderer.populateOrgSelect();
    renderer.render();
  });

  $('exportBtn').addEventListener('click', () => {
    if (currentView === 'pca') pca.exportCSV();
    else renderer.exportCSV();
  });

  $('navConsulta').addEventListener('click', () => setView('consulta'));
  $('navPCA').addEventListener('click', () => {
    setView('pca');
    pca.render();
  });

  renderer.populateOrgSelect();
  renderer.populateUnitSelect();
  pca.bind();
  renderer.renderOverview();
  renderer.render();
  setView('consulta');
}

main();
