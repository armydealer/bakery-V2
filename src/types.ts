export type BaseUnit = 'gram' | 'ml' | 'piece';

export type IngredientCategory =
  | 'flour_sugar'
  | 'butter_oil'
  | 'nuts_spice'
  | 'dairy_egg'
  | 'chocolate_flavor'
  | 'packaging';

export interface PriceHistoryPoint {
  dateShamsi: string;
  packPrice: number;
}

export interface Ingredient {
  id: string;
  name: string;
  category: IngredientCategory;
  packLabel: string; // e.g., "کیسه ۴۰ کیلویی", "مثقال ۴.۶۰۸ گرمی"
  packQuantityInBase: number; // grams, ml, or pieces per pack
  baseUnit: BaseUnit;
  packPrice: number; // Toman per pack
  previousPackPrice: number; // For inflation tracking
  monthlyInflationPct: number; // Expected monthly inflation % for real profit reserve
  currentStockInBase: number;
  safetyStockInBase: number;
  supplierName?: string;
  history: PriceHistoryPoint[];
}

export interface RecipeLineItem {
  id: string;
  kind: 'ingredient' | 'subRecipe';
  refId: string;
  amount: number; // grams, ml, or pieces
}

export interface SubRecipe {
  id: string;
  name: string;
  yieldGrams: number; // Final usable grams
  bakingChangePct: number; // Negative for shrinkage, positive for syrup/water absorption
  items: RecipeLineItem[];
  notes?: string;
}

export type SalesChannelKey = 'storefront' | 'cafeB2B' | 'snappfood' | 'customEvent';

export interface ChannelMix {
  storefrontPct: number;
  cafeB2BPct: number;
  snappfoodPct: number;
  customEventPct: number;
}

export interface Recipe {
  id: string;
  name: string;
  category: 'خشک' | 'تر و خامه‌ای' | 'سنتی و باقلوا' | 'کافه‌ای';
  items: RecipeLineItem[];
  boxIngredientId: string; // Packaging box per kg (Box Weight Deduction Law)
  extraPackagingCostPerKg: number; // Paper, liner, ribbon
  bakingChangePct: number; // e.g., -12 shrinkage or +18 syrup absorption
  trimWastePct: number; // Edge trimming loss %
  shelfLifeSpoilagePct: number; // Unsold/stale spoilage %
  ovenMinutesPerBatch: number;
  ovenTraysPerBatch: number;
  ovenTempCelsius: number;
  directLaborMinutesPerBatch: number;
  sellingPricePerKg: number; // Storefront price in Toman
  cafeDiscountPct: number; // B2B discount vs storefront
  snappfoodMarkupPct: number; // Menu markup on SnappFood
  monthlySalesKg: number;
  channelMix: ChannelMix;
  unionPriceCeiling?: number; // Optional official Union ceiling per kg
  chefInstructions?: string;
}

export interface StaffMember {
  id: string;
  name: string;
  role: string;
  baseMonthlySalary: number; // Base salary + housing/food allowance subject to law
  monthlyBenefits: number; // Non-insured bonuses/commute
  includeInsurance23: boolean; // 23% employer SSO
  includeEidi: boolean; // 2/12 monthly accrual
  includeSanavat: boolean; // 1/12 monthly accrual
  active: boolean;
}

export interface OverheadItem {
  id: string;
  name: string;
  category: 'اجاره و ملک' | 'انرژی و فر' | 'استهلاک تجهیزات' | 'بازاریابی و اداری' | 'سایر';
  monthlyAmount: number;
  active: boolean;
}

export interface SayadiCheck {
  id: string;
  type: 'issued' | 'received'; // پرداختی (تامین‌کننده) یا دریافتی (کافه/عمده)
  counterparty: string;
  amount: number;
  dueDateShamsi: string;
  daysFromToday: number; // For deterministic stress test timeline
  sayadiId: string;
  status: 'در جریان' | 'پاس‌شده' | 'هشدار نقدینگی';
  note?: string;
}

export interface SeasonalMonth {
  index: number; // 0..11 (Farvardin..Esfand)
  name: string;
  demandMultiplier: number; // e.g., 1.85 for Esfand, 0.72 for Tir
  occasion: string;
}

export interface VarianceRecord {
  id: string;
  ingredientId: string;
  periodLabel: string;
  periodDays: number;
  actualUsedInBase: number;
  note?: string;
}

export interface MixBoxPreset {
  id: string;
  name: string;
  boxCost: number;
  ribbonAndCardCost: number;
  laborMinutes: number;
  targetMarginPct: number;
  items: Array<{ recipeId: string; grams: number }>;
}

export interface CustomCakePreset {
  id: string;
  title: string;
  weightKg: number;
  baseRecipeId: string;
  fondantKg: number;
  fondantIngredientId: string;
  ganacheCostPerKg: number;
  topperAndFlowersCost: number;
  boardAndTallBoxCost: number;
  decoratorHours: number;
  decoratorHourlyRate: number;
  complexitySurchargePct: number;
  targetMarginPct: number;
  depositPct: number;
  deliveryDateShamsi: string;
  customerName: string;
}

export type BusinessModelPreset =
  | 'home_workshop'
  | 'storefront_confectionery'
  | 'wholesale_cafe'
  | 'workshop_plus_branch';

export type OverheadAllocationMethod = 'weight' | 'time_abc' | 'hybrid';
export type CurrencyDisplayUnit = 'toman' | 'million_toman' | 'rial';
export type TableDensity = 'comfortable' | 'compact';

export interface WorkshopSettings {
  // 1. Identity & Branding
  workshopName: string;
  managerName: string;
  phone: string;
  instagram: string;
  logoBase64: string;
  businessModel: BusinessModelPreset;
  currencyUnit: CurrencyDisplayUnit;

  // 2. Financial, Tax & Iranian Market Rules
  vatEnabled: boolean;
  vatRatePct: number;
  enforceBoxWeightDeduction: boolean;
  defaultSnappfoodCommissionPct: number;
  snappfoodExtraBoxCost: number;
  defaultPosFeePct: number;
  priceRoundingStep: 5000 | 10000 | 25000;
  defaultIncludeInsurance23: boolean;
  defaultIncludeEidi: boolean;
  defaultIncludeSanavat: boolean;

  // 3. Physical Capacity & Operations
  ovenCount: number;
  traysPerOven: number;
  dailyWorkingHours: number;
  activeWorkingDaysPerMonth: number;
  overheadAllocationMethod: OverheadAllocationMethod;
  defaultDecoratorHourlyRate: number;
  openingCashBalance: number;

  // 4. Scientific & Alert Thresholds
  targetNetMarginPct: number;
  redFlagMarginPct: number;
  safeCashReserveDays: number;
  monteCarloIterations: 500 | 1000 | 2500;
  defaultAnnualInflationPct: number;
  slumpReserveRatePct: number; // % of nominal profit kept for slow seasons

  // 5. UX & Privacy Preferences
  privacyMode: boolean;
  guidedLearningMode: boolean;
  tableDensity: TableDensity;
  usePersianDigits: boolean;

  // 6. Cloud Sync
  googleSheetsWebhookUrl: string;
  autoSyncEnabled: boolean;
  lastSyncedAt: string | null;
}

export interface WorkshopData {
  settings: WorkshopSettings;
  ingredients: Ingredient[];
  subRecipes: SubRecipe[];
  recipes: Recipe[];
  staff: StaffMember[];
  overheads: OverheadItem[];
  checks: SayadiCheck[];
  seasonalCurve: SeasonalMonth[];
  varianceRecords: VarianceRecord[];
  mixBox: MixBoxPreset;
  customCake: CustomCakePreset;
}

// Computed Financial Metrics Types
export type MenuQuadrant = 'star' | 'plowhorse' | 'puzzle' | 'dog';

export interface RecipeChannelMetrics {
  channel: SalesChannelKey;
  label: string;
  effectivePricePerKg: number;
  commissionAndFeePerKg: number;
  extraBoxPerKg: number;
  netRevenuePerKg: number;
  netProfitPerKg: number;
  netMarginPct: number;
  monthlyKg: number;
}

export interface ComputedRecipeMetrics {
  recipeId: string;
  name: string;
  category: Recipe['category'];
  rawBatchWeightGrams: number;
  netYieldGrams: number; // After baking change + trim waste
  netYieldKg: number;
  batchMaterialCost: number;
  materialCostPerKg: number;
  spoilageAdjustedMaterialCostPerKg: number;
  spoilageCostPerKg: number;
  trimWasteCostPerKg: number;
  boxAndPackagingPerKg: number;
  allocatedOverheadPerKg: number;
  totalCostPerKg: number; // Full landed cost before channel fees
  storefrontPricePerKg: number;
  blendedNetPricePerKg: number; // Net of channel discounts, POS & SnappFood commission
  blendedChannelCostPerKg: number;
  netProfitPerKg: number;
  netMarginPct: number;
  monthlySalesKg: number;
  monthlyRevenue: number;
  monthlyMaterialCost: number;
  monthlyPackagingCost: number;
  monthlyOverheadCost: number;
  monthlyChannelFeeCost: number;
  monthlyNetProfit: number;
  ovenHoursPerKg: number;
  monthlyOvenHours: number;
  profitPerOvenHour: number;
  laborHoursPerKg: number;
  profitPerLaborHour: number;
  recommendedPrices: {
    economy: number;
    standard: number;
    luxury: number;
  };
  snappfoodShieldPrice: number;
  endOfDayFloorPrice: number;
  unionCeilingStatus: 'none' | 'compliant' | 'squeezed' | 'exceeded';
  unionMarginGap: number;
  quadrant: MenuQuadrant;
  channels: RecipeChannelMetrics[];
}

export interface ComputedWorkshopSummary {
  recipeMetrics: ComputedRecipeMetrics[];
  subRecipeUnitCosts: Record<string, number>; // Toman per gram
  ingredientUnitCosts: Record<string, number>; // Toman per base unit
  totalMonthlyRevenue: number;
  totalMonthlyMaterialCost: number;
  totalMonthlyPackagingCost: number;
  totalMonthlyChannelFees: number;
  totalMonthlyStaffCost: number;
  totalMonthlyBasePayroll: number;
  totalMonthlyLaborLawAccruals: number; // 23% SSO + Eidi + Sanavat
  totalMonthlyFixedOverhead: number;
  totalMonthlyOverheadAndPayroll: number;
  totalMonthlySalesKg: number;
  nominalMonthlyProfit: number;
  weightedMaterialInflationPct: number;
  inventoryReplacementReserve: number;
  monthlySlumpReserve: number;
  realSafeOwnerDraw: number; // True inflation-adjusted withdrawable profit
  blendedNetMarginPct: number;
  contributionMarginRatio: number;
  breakEvenRevenue: number;
  breakEvenKg: number;
  breakEvenDayOfMonth: number;
  dailyBreakEvenRevenue: number;
  monthlyOvenCapacityHours: number;
  usedOvenHours: number;
  ovenUtilizationPct: number;
  healthScore: number; // 0-100
  masteryRank: 'کارگاه نوپا' | 'قنادی تراز' | 'کارگاه سودآور' | 'استاد بهایابی';
  paretoIngredients: Array<{
    ingredientId: string;
    name: string;
    monthlySpend: number;
    sharePct: number;
    cumulativePct: number;
  }>;
  channelSummary: Array<{
    channel: SalesChannelKey;
    label: string;
    revenue: number;
    netProfit: number;
    marginPct: number;
    kg: number;
  }>;
  wasteBreakdown: {
    bakingShrinkageCost: number;
    trimWasteCost: number;
    shelfLifeSpoilageCost: number;
    invisibleVarianceCost: number;
    totalWasteCost: number;
  };
}

export interface ForecastMonthPoint {
  monthIndex: number;
  shamsiName: string;
  occasion: string;
  seasonalMultiplier: number;
  revenueBase: number;
  revenueP10: number;
  revenueP90: number;
  totalCostBase: number;
  profitBase: number;
  profitP10: number;
  profitP90: number;
  realProfitBase: number;
  cumulativeCashBase: number;
  slumpDelta: number; // Surplus (+) or Deficit (-) relative to average
}

export interface MonteCarloConfig {
  demandVolatilityPct: number; // e.g. 15
  costVolatilityPct: number; // e.g. 12
  spoilageVolatilityPct: number; // e.g. 3
  iterations: number;
  seed: number;
}

export interface MonteCarloResult {
  iterations: number;
  durationMs: number;
  probabilityOfProfitPct: number;
  medianProfit: number; // P50
  profitAtRisk95: number; // P5 (VaR 95%)
  bestCase95: number; // P95
  meanProfit: number;
  checkDefaultRiskPct: number;
  histogram: Array<{
    binLabel: string;
    binStart: number;
    binEnd: number;
    count: number;
    isLoss: boolean;
  }>;
}

export interface TornadoDriver {
  key: string;
  label: string;
  lowProfitDelta: number; // -10% or unfavorable direction
  highProfitDelta: number; // +10% or favorable direction
  totalSpread: number;
  impactDescription: string;
}

export interface GoalSeekPath {
  id: string;
  title: string;
  subtitle: string;
  metricBadge: string;
  feasibility: 'بالا' | 'متوسط' | 'چالشی';
  steps: string[];
}

export interface OfflineInsight {
  id: string;
  severity: 'critical' | 'warning' | 'opportunity' | 'healthy';
  category: string;
  title: string;
  metric: string;
  diagnosis: string;
  action: string;
}
