import test from 'node:test';
import assert from 'node:assert/strict';
import { createDemoWorkshopData } from '../data/demoData';
import {
  computeCashVsCheckArbitrage,
  computeDiscountRequiredVolumeIncreasePct,
  computeSnappfoodShieldPrice,
  computeStockpileArbitrage,
  computeTrueMonthlyStaffCost,
  computeWorkshopSummary,
  solveGoalSeekPaths,
} from './costEngine';
import { runSeasonalForecast } from './forecastEngine';
import { runMonteCarloSimulation } from './monteCarloEngine';
import { runTornadoSensitivity } from './sensitivityEngine';
import { parseLocaleNumber, roundToStep } from './formatters';

test('parseLocaleNumber converts Persian and Arabic numerals accurately', () => {
  assert.equal(parseLocaleNumber('۴,۶۵۰,۰۰۰'), 4650000);
  assert.equal(parseLocaleNumber('١٢٥٠٫٥'), 1250.5);
  assert.equal(parseLocaleNumber('12,500'), 12500);
  assert.equal(parseLocaleNumber('invalid'), 0);
});

test('Iranian Labor Law true staff cost includes 23% insurance + Eidi (2/12) + Sanavat (1/12)', () => {
  const res = computeTrueMonthlyStaffCost({
    id: 's1',
    name: 'Test',
    role: 'Chef',
    baseMonthlySalary: 24_000_000,
    monthlyBenefits: 2_000_000,
    includeInsurance23: true,
    includeEidi: true,
    includeSanavat: true,
    active: true,
  });
  assert.equal(res.insurance23, 5_520_000);
  assert.equal(res.eidiAccrual, 4_000_000);
  assert.equal(res.sanavatAccrual, 2_000_000);
  assert.equal(res.totalTrueCost, 37_520_000);
});

test('Workshop summary calculates coherent Real Safe Owner Draw and cascades ingredient price changes', () => {
  const demo = createDemoWorkshopData();
  const baseSummary = computeWorkshopSummary(demo);

  assert.ok(baseSummary.totalMonthlyRevenue > 0);
  assert.ok(baseSummary.nominalMonthlyProfit > 0);
  assert.ok(baseSummary.inventoryReplacementReserve > 0);
  assert.ok(baseSummary.realSafeOwnerDraw < baseSummary.nominalMonthlyProfit);
  assert.equal(baseSummary.recipeMetrics.length, 6);

  // Cascade test: increase butter price by +40%
  const shocked = {
    ...demo,
    ingredients: demo.ingredients.map((i) =>
      i.id === 'ing-butter' ? { ...i, packPrice: Math.round(i.packPrice * 1.4) } : i
    ),
  };
  const shockedSummary = computeWorkshopSummary(shocked);
  assert.ok(shockedSummary.nominalMonthlyProfit < baseSummary.nominalMonthlyProfit);
  assert.ok(shockedSummary.totalMonthlyMaterialCost > baseSummary.totalMonthlyMaterialCost);
});

test('SnappFood Shield Price and Discount Trap math are mathematically exact', () => {
  const shield = computeSnappfoodShieldPrice(460000, 18, 14000, 0.6, 10000);
  assert.equal(shield, roundToStep((460000 * 0.994 + 14000) / 0.82, 10000));
  assert.ok(shield >= 570000);

  const trap = computeDiscountRequiredVolumeIncreasePct(30, 15);
  assert.equal(trap.impossible, false);
  assert.equal(Math.round(trap.requiredVolumeIncreasePct), 100);

  const impossibleTrap = computeDiscountRequiredVolumeIncreasePct(20, 25);
  assert.equal(impossibleTrap.impossible, true);
});

test('Iranian Bazaar Arbitrage calculators produce accurate verdicts', () => {
  const stockpile = computeStockpileArbitrage({
    purchaseAmountToman: 100_000_000,
    expectedPriceJumpPct: 22,
    holdingMonths: 2,
    monthlyCapitalCostPct: 4,
    spoilageRiskPct: 2,
  });
  assert.equal(stockpile.verdict, 'stockpile');
  assert.equal(Math.round(stockpile.netBenefit), 12_000_000);

  const cashVsCheck = computeCashVsCheckArbitrage({
    invoiceAmountToman: 100_000_000,
    cashDiscountPct: 5,
    checkDays: 60,
    monthlyCapitalCostPct: 4.5,
  });
  // 5M discount vs 95M * 9% = 8.55M value of money -> buying by check wins
  assert.equal(cashVsCheck.verdict, 'buy_check');
});

test('12-Month Seasonal Forecast widens P10/P90 confidence bands with horizon', () => {
  const demo = createDemoWorkshopData();
  const summary = computeWorkshopSummary(demo);
  const fc = runSeasonalForecast(demo, summary, {
    horizonMonths: 12,
    monthlyDemandGrowthPct: 1,
    annualMaterialInflationPct: 38,
    pricePassThroughPct: 85,
  });
  assert.equal(fc.length, 12);
  const m1RelSpread = (fc[0].revenueP90 - fc[0].revenueP10) / fc[0].revenueBase;
  const m12RelSpread = (fc[11].revenueP90 - fc[11].revenueP10) / fc[11].revenueBase;
  assert.ok(m12RelSpread > m1RelSpread * 2.5);
});

test('Monte Carlo 1,000-iteration engine is deterministic, fast, and properly ordered', () => {
  const demo = createDemoWorkshopData();
  const summary = computeWorkshopSummary(demo);
  const cfg = {
    demandVolatilityPct: 14,
    costVolatilityPct: 11,
    spoilageVolatilityPct: 2.5,
    iterations: 1000,
    seed: 140409,
  };
  const run1 = runMonteCarloSimulation(demo, summary, cfg);
  const run2 = runMonteCarloSimulation(demo, summary, cfg);

  assert.equal(run1.medianProfit, run2.medianProfit);
  assert.equal(run1.profitAtRisk95, run2.profitAtRisk95);
  assert.ok(run1.profitAtRisk95 <= run1.medianProfit);
  assert.ok(run1.medianProfit <= run1.bestCase95);
  assert.equal(run1.histogram.length, 15);
  assert.equal(
    run1.histogram.reduce((s, b) => s + b.count, 0),
    1000
  );
  assert.ok(run1.durationMs < 200);
});

test('Tornado Sensitivity sorts 7 drivers descending by total Toman impact spread', () => {
  const demo = createDemoWorkshopData();
  const summary = computeWorkshopSummary(demo);
  const tornado = runTornadoSensitivity(demo, summary);
  assert.equal(tornado.length, 7);
  for (let i = 1; i < tornado.length; i++) {
    assert.ok(tornado[i - 1].totalSpread >= tornado[i].totalSpread);
  }
  const paths = solveGoalSeekPaths(summary, summary.realSafeOwnerDraw + 80_000_000, demo.settings);
  assert.equal(paths.length, 3);
});
