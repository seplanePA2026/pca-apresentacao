# Controle Orçamentário + PCA Interativo — Paulo Afonso (BA)

Projeto local com dois módulos independentes:

1. **Consulta Orçamentária** — leitura da base oficial consolidada de agosto/2026, usando Dotação Inicial, Dotação Atualizada e Saldo Disponível.
2. **PCA Municipal 2027** — planejamento de demandas/DFDs conforme a Planilha PCA Municipal, sem transformar dotações em contratações automaticamente.

## PCA 2027 implementado

O módulo **PCA** possui:

- cadastro, edição, duplicação e exclusão de demandas/itens;
- campos: Nº DFD/Item, Secretaria Requisitante, Setor/Departamento, Tipo de Objeto, Descrição, Quantidade, Unidade de Medida, Valor Unitário, Valor Total automático, Prioridade, Trimestre e Vinculação Orçamentária;
- cadastro de setores/departamentos reais por secretaria;
- filtros por secretaria, setor, tipo, prioridade, trimestre e vinculação;
- indicadores consolidados, distribuição trimestral e prioridades;
- consolidação por Secretaria/Órgão;
- importação CSV validada;
- exportação CSV do filtro atual;
- download de modelo CSV;
- backup JSON;
- impressão;
- persistência local no navegador via `localStorage`.

**Importante:** a base do PCA inicia vazia. Nenhum DFD, setor ou contratação é inventado. Os 19 órgãos de `data/organs.json` são utilizados apenas como lista oficial de Secretaria/Órgão. O campo de vinculação orçamentária, nesta etapa, registra somente **Sim / Não / A Indicar**.

## Estrutura

```text
PCA/
├── index.html
├── assets/
│   ├── css/
│   │   ├── variables.css
│   │   ├── base.css
│   │   ├── components.css
│   │   ├── pca.css
│   │   └── ...
│   └── js/
│       ├── app.js
│       ├── pca.js
│       └── ...
├── data/
│   └── organs.json
├── QDD/
├── Logos/
└── docs/README.md
```

## Como abrir localmente

Os arquivos JSON são carregados via `fetch`, portanto abra por servidor local.

### Python

```bash
python -m http.server 8080
```

Depois acesse `http://localhost:8080`.

### Node

```bash
npx --yes serve .
```

### VS Code / Cursor

Use **Open with Live Server** em `index.html`.

## Persistência do PCA

Os cadastros do PCA ficam no `localStorage` do navegador sob uma chave versionada. Isso permite testar toda a interface sem backend. O botão **Backup JSON** deve ser usado antes de limpar dados ou trocar de navegador/computador.

## Próxima camada

A vinculação detalhada de cada demanda com Unidade Orçamentária → Ação → Natureza → Fonte → Dotação será implementada depois, de forma explícita. O módulo atual não presume essa relação.
