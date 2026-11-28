#!/usr/bin/env node
/**
 * AGENTE 7 — Validador Automatizado de Calidad, Integridad Referencial y Normalización
 * Audita los 23 archivos CSV de `research/market-intelligence-colombia-2026/`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const baseDir = path.resolve(__dirname, '..');

function parseCsvStrict(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const rows = [];
  let row = [];
  let cur = '';
  let inQuotes = false;

  for (let i = 0; i < content.length; i++) {
    const ch = content[i];
    if (inQuotes) {
      if (ch === '"') {
        if (content[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(cur);
      cur = '';
    } else if (ch === '\n') {
      row.push(cur.replace(/\r$/, ''));
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
      cur = '';
    } else {
      cur += ch;
    }
  }
  if (cur.length > 0 || row.length > 0) {
    row.push(cur.replace(/\r$/, ''));
    if (row.length > 1 || row[0] !== '') rows.push(row);
  }
  if (inQuotes) {
    throw new Error(`Unclosed quote in ${filePath}`);
  }
  const headers = rows[0];
  const data = rows.slice(1).map((cols, idx) => {
    if (cols.length !== headers.length) {
      throw new Error(
        `Column count mismatch in ${path.relative(baseDir, filePath)} row ${idx + 2}: expected ${headers.length}, got ${cols.length}`
      );
    }
    const obj = {};
    headers.forEach((h, j) => {
      obj[h] = cols[j];
    });
    return obj;
  });
  return { headers, data };
}

const errors = [];
const fileCounts = {};

function load(relPath, pkField = null) {
  const full = path.join(baseDir, relPath);
  if (!fs.existsSync(full)) {
    errors.push(`Missing required CSV: ${relPath}`);
    return [];
  }
  const { data } = parseCsvStrict(full);
  fileCounts[relPath] = data.length;
  if (pkField) {
    const seen = new Set();
    for (const r of data) {
      const k = r[pkField];
      if (!k) errors.push(`${relPath}: empty PK ${pkField}`);
      if (seen.has(k)) errors.push(`${relPath}: duplicate PK ${pkField}=${k}`);
      seen.add(k);
    }
  }
  return data;
}

const catalogAudit = load('catalog/catalog_audit.csv', 'procedure_id');
const missingProcs = load('catalog/missing_procedures.csv', 'procedure_id');
const procVariants = load('catalog/procedure_variants.csv', 'variant_id');

const priceObs = load('pricing/price_observations.csv', 'observation_id');
const priceBench = load('pricing/price_benchmarks.csv', 'benchmark_id');
const cityComp = load('pricing/city_price_comparison.csv');

const techSpecs = load('technical/procedure_technical_specs.csv', 'procedure_id');
const techDur = load('technical/procedure_durations.csv', 'duration_id');
const techCons = load('technical/procedure_consumption.csv', 'consumption_id');

const suppliers = load('products/supplier_directory.csv', 'supplier_id');
const products = load('products/product_catalog.csv', 'product_id');
const productPrices = load('products/product_prices.csv', 'product_price_id');
const productSubs = load('products/product_substitutes.csv', 'substitute_group_id');

const commModels = load('financial/commission_benchmarks.csv', 'commission_model_id');
const costModels = load('financial/procedure_cost_models.csv', 'cost_model_id');
const scenarios = load('financial/profitability_scenarios.csv', 'scenario_id');

const compMatrix = load('competition/competitor_matrix.csv', 'competitor_id');
const compFeatures = load('competition/competitor_features.csv', 'competitor_id');
const compPricing = load('competition/competitor_pricing.csv', 'pricing_row_id');

const demandObs = load('commercial/demand_observations.csv', 'demand_obs_id');
const servicePop = load('commercial/service_popularity.csv', 'procedure_id');
const seasonality = load('commercial/seasonality.csv');

const regMatrix = load('regulatory/regulatory_matrix.csv', 'reg_req_id');

// Canonical sets
const canonicalProcIds = new Set([
  ...catalogAudit.map((r) => r.procedure_id),
  ...missingProcs.map((r) => r.procedure_id),
]);

if (canonicalProcIds.size !== 193) {
  errors.push(`Expected 193 canonical procedure_ids, found ${canonicalProcIds.size}`);
}

const productIds = new Set(products.map((r) => r.product_id));
const supplierIds = new Set(suppliers.map((r) => r.supplier_id));
const competitorIds = new Set(compMatrix.map((r) => r.competitor_id));
const commIds = new Set(commModels.map((r) => r.commission_model_id));

// Foreign key checks
const checkProcFk = (rows, label, field = 'procedure_id') => {
  for (const r of rows) {
    if (r[field] && !canonicalProcIds.has(r[field])) {
      errors.push(`${label}: unknown ${field}=${r[field]}`);
    }
  }
};

checkProcFk(procVariants, 'procedure_variants');
checkProcFk(priceObs, 'price_observations');
checkProcFk(priceBench, 'price_benchmarks');
checkProcFk(techSpecs, 'procedure_technical_specs');
checkProcFk(techDur, 'procedure_durations');
checkProcFk(techCons, 'procedure_consumption');
checkProcFk(costModels, 'procedure_cost_models');
checkProcFk(servicePop, 'service_popularity');
checkProcFk(servicePop, 'service_popularity.upsell', 'recommended_upsell_procedure_id');
checkProcFk(servicePop, 'service_popularity.cross_sell', 'recommended_cross_sell_procedure_id');

for (const r of productPrices) {
  if (!productIds.has(r.product_id)) errors.push(`product_prices: unknown product_id=${r.product_id}`);
  if (!supplierIds.has(r.supplier_id)) errors.push(`product_prices: unknown supplier_id=${r.supplier_id}`);
}
for (const r of productSubs) {
  if (!productIds.has(r.econ_product_id)) errors.push(`product_substitutes: unknown econ=${r.econ_product_id}`);
  if (!productIds.has(r.std_product_id)) errors.push(`product_substitutes: unknown std=${r.std_product_id}`);
  if (!productIds.has(r.prem_product_id)) errors.push(`product_substitutes: unknown prem=${r.prem_product_id}`);
  if (!(Number(r.econ_unit_price_cop) < Number(r.std_unit_price_cop) && Number(r.std_unit_price_cop) < Number(r.prem_unit_price_cop))) {
    errors.push(`product_substitutes ${r.substitute_group_id}: violated econ < std < prem`);
  }
}
for (const r of compFeatures) {
  if (!competitorIds.has(r.competitor_id)) errors.push(`competitor_features: unknown ${r.competitor_id}`);
}
for (const r of compPricing) {
  if (!competitorIds.has(r.competitor_id)) errors.push(`competitor_pricing: unknown ${r.competitor_id}`);
}
for (const r of costModels) {
  if (!commIds.has(r.commission_model_id)) errors.push(`procedure_cost_models: unknown comm=${r.commission_model_id}`);
  const gm = Number(r.gross_margin_cop);
  const cm = Number(r.contribution_margin_cop);
  const op = Number(r.operating_profit_cop);
  if (!(gm >= cm && cm >= op)) {
    errors.push(`procedure_cost_models ${r.cost_model_id}: margin hierarchy violated (${gm}, ${cm}, ${op})`);
  }
}

// Statistical & duration invariants
for (const b of priceBench) {
  const vals = [b.min_observed_cop, b.p25_cop, b.median_cop, b.p75_cop, b.max_observed_cop].map(Number);
  for (let i = 0; i < vals.length - 1; i++) {
    if (vals[i] > vals[i + 1]) {
      errors.push(`price_benchmarks ${b.benchmark_id}: quantile order violated ${vals.join(' <= ')}`);
      break;
    }
  }
  if (!(Number(b.recommended_econ_cop) < Number(b.recommended_std_cop) && Number(b.recommended_std_cop) < Number(b.recommended_prem_cop))) {
    errors.push(`price_benchmarks ${b.benchmark_id}: recommended order violated`);
  }
}

for (const d of techDur) {
  const sum = Number(d.prep_min) + Number(d.exec_min_typical) + Number(d.processing_pose_min) + Number(d.cleanup_min);
  if (sum !== Number(d.total_chair_min_typical)) {
    errors.push(`procedure_durations ${d.duration_id}: sum=${sum} != total=${d.total_chair_min_typical}`);
  }
  if (Number(d.specialist_active_min_typical) > Number(d.total_chair_min_typical)) {
    errors.push(`procedure_durations ${d.duration_id}: active > total_chair`);
  }
}

// Confidence distribution across key datasets
const confDist = { high: 0, medium: 0, low: 0, unverified: 0 };
for (const dataset of [priceObs, priceBench, techSpecs, productPrices, costModels, compMatrix, demandObs, regMatrix]) {
  for (const r of dataset) {
    const c = r.confidence_level;
    if (c in confDist) confDist[c]++;
  }
}

const totalCsvRecords = Object.values(fileCounts).reduce((a, b) => a + b, 0);

// Top dispersion & high ticket from price_benchmarks
const topHighestPrice = [...priceBench]
  .sort((a, b) => Number(b.recommended_std_cop) - Number(a.recommended_std_cop))
  .slice(0, 8)
  .map((b) => ({ id: b.procedure_id, std: Number(b.recommended_std_cop), prem: Number(b.recommended_prem_cop) }));

const topDispersionIqr = [...priceBench]
  .sort((a, b) => Number(b.iqr_dispersion_cop) - Number(a.iqr_dispersion_cop))
  .slice(0, 8)
  .map((b) => ({ id: b.procedure_id, iqr: Number(b.iqr_dispersion_cop), min: Number(b.min_observed_cop), max: Number(b.max_observed_cop) }));

if (errors.length > 0) {
  console.error('VALIDATION FAILED:', JSON.stringify(errors, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({
  status: 'PASSED_ZERO_ERRORS',
  csvFilesValidated: Object.keys(fileCounts).length,
  totalCsvRecords,
  fileCounts,
  confidenceDistribution: confDist,
  topHighestPrice,
  topDispersionIqr,
}, null, 2));
