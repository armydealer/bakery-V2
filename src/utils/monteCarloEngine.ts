import {
  ComputedWorkshopSummary,
  MonteCarloConfig,
  MonteCarloResult,
  WorkshopData,
} from '../types';
import { formatShortToman, safeDiv } from './formatters';

/**
 * Fast, deterministic Mulberry32 PRNG for reproducible Monte Carlo runs.
 */
function createSeededRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Box-Muller Transform for standard normal N(0, 1) draws.
 */
function sampleGaussian(rng: () => number): number {
  let u1 = rng();
  let u2 = rng();
  if (u1 < 1e-9) u1 = 1e-9;
  return Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
}

/**
 * 1,000-Iteration Monte Carlo Workshop Risk Simulator (<50ms pure TypeScript).
 */
export function runMonteCarloSimulation(
  data: WorkshopData,
  summary: ComputedWorkshopSummary,
  config: MonteCarloConfig
): MonteCarloResult {
  const start = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const iterations = Math.max(100, Math.min(5000, Math.round(config.iterations)));
  const rng = createSeededRng(config.seed || 140409);

  const demandVol = Math.max(0.01, config.demandVolatilityPct / 100);
  const costVol = Math.max(0.01, config.costVolatilityPct / 100);
  const spoilVol = Math.max(0.002, config.spoilageVolatilityPct / 100);

  const baseRev = summary.totalMonthlyRevenue;
  const baseMat = summary.totalMonthlyMaterialCost;
  const basePack = summary.totalMonthlyPackagingCost;
  const baseChan = summary.totalMonthlyChannelFees;
  const baseOvh = summary.totalMonthlyOverheadAndPayroll;
  const baseInfShift = summary.weightedMaterialInflationPct / 100;

  // Upcoming 30-day net issued Sayadi check obligation
  const dueIssuedChecks = data.checks
    .filter((c) => c.type === 'issued' && c.status !== 'پاس‌شده' && c.daysFromToday <= 35)
    .reduce((s, c) => s + c.amount, 0);
  const dueReceivedChecks = data.checks
    .filter((c) => c.type === 'received' && c.status !== 'پاس‌شده' && c.daysFromToday <= 35)
    .reduce((s, c) => s + c.amount, 0);
  const netCheckObligation = Math.max(0, dueIssuedChecks - dueReceivedChecks);
  const openingCash = data.settings.openingCashBalance;

  const profits = new Float64Array(iterations);
  let profitableCount = 0;
  let checkDefaultCount = 0;
  let sumProfit = 0;

  for (let i = 0; i < iterations; i++) {
    // Correlated shock: higher inflation slightly dampens demand (-0.25 correlation)
    const zCost = sampleGaussian(rng);
    const zDemandInd = sampleGaussian(rng);
    const zDemand = -0.25 * zCost + Math.sqrt(1 - 0.25 * 0.25) * zDemandInd;
    const zSpoil = sampleGaussian(rng);
    const zOvh = sampleGaussian(rng);

    const demandMult = Math.max(0.35, 1 + zDemand * demandVol);
    const costMult = Math.max(0.75, 1 + baseInfShift * 0.5 + zCost * costVol);
    const extraSpoilPenalty = Math.max(-0.02, zSpoil * spoilVol);
    const ovhMult = Math.max(0.9, 1 + zOvh * 0.03);

    const simRev = baseRev * demandMult;
    const simMat = baseMat * demandMult * costMult * (1 + extraSpoilPenalty);
    const simPack = basePack * demandMult * (1 + (costMult - 1) * 0.5);
    const simChan = baseChan * demandMult;
    const simOvh = baseOvh * ovhMult;

    const simProfit = simRev - simMat - simPack - simChan - simOvh;
    profits[i] = simProfit;
    sumProfit += simProfit;

    if (simProfit > 0) profitableCount++;

    // Liquidity check against Sayadi obligations (assume 45% of opening cash + simulated net cashflow available)
    const availableLiquidity = openingCash * 0.45 + simProfit;
    if (netCheckObligation > 0 && availableLiquidity < netCheckObligation) {
      checkDefaultCount++;
    }
  }

  profits.sort();

  const percentile = (p: number) => {
    const idx = Math.min(iterations - 1, Math.max(0, Math.floor(p * (iterations - 1))));
    return profits[idx];
  };

  const minVal = profits[0];
  const maxVal = profits[iterations - 1];
  const binCount = 15;
  const range = Math.max(1, maxVal - minVal);
  const binWidth = range / binCount;

  const bins = Array.from({ length: binCount }, (_, idx) => {
    const binStart = minVal + idx * binWidth;
    const binEnd = binStart + binWidth;
    const mid = (binStart + binEnd) / 2;
    return {
      binLabel: formatShortToman(mid, data.settings.usePersianDigits),
      binStart: Math.round(binStart),
      binEnd: Math.round(binEnd),
      count: 0,
      isLoss: mid < 0,
    };
  });

  for (let i = 0; i < iterations; i++) {
    const rawIdx = Math.floor((profits[i] - minVal) / binWidth);
    const clampedIdx = Math.min(binCount - 1, Math.max(0, rawIdx));
    bins[clampedIdx].count += 1;
  }

  const end = typeof performance !== 'undefined' ? performance.now() : Date.now();

  return {
    iterations,
    durationMs: Math.max(1, Math.round(end - start)),
    probabilityOfProfitPct: safeDiv(profitableCount, iterations, 0) * 100,
    medianProfit: Math.round(percentile(0.5)),
    profitAtRisk95: Math.round(percentile(0.05)),
    bestCase95: Math.round(percentile(0.95)),
    meanProfit: Math.round(safeDiv(sumProfit, iterations, 0)),
    checkDefaultRiskPct: safeDiv(checkDefaultCount, iterations, 0) * 100,
    histogram: bins,
  };
}
