import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  ComputedWorkshopSummary,
  CustomCakePreset,
  ForecastMonthPoint,
  Ingredient,
  MixBoxPreset,
  MonteCarloConfig,
  MonteCarloResult,
  OfflineInsight,
  OverheadItem,
  Recipe,
  SayadiCheck,
  SeasonalMonth,
  StaffMember,
  SubRecipe,
  TornadoDriver,
  VarianceRecord,
  WorkshopData,
  WorkshopSettings,
} from '../types';
import { createBlankWorkshopData, createDemoWorkshopData } from '../data/demoData';
import { computeWorkshopSummary } from '../utils/costEngine';
import { ForecastAssumptions, runSeasonalForecast } from '../utils/forecastEngine';
import { runMonteCarloSimulation } from '../utils/monteCarloEngine';
import { runTornadoSensitivity } from '../utils/sensitivityEngine';
import { generateOfflineStrategicInsights } from '../utils/offlineAdvisor';

const STORAGE_KEY = 'shirintaraz_os_state_v1';

export interface ToastMessage {
  id: string;
  text: string;
  tone: 'success' | 'warning' | 'error' | 'info';
}

interface WorkshopContextValue {
  data: WorkshopData;
  summary: ComputedWorkshopSummary;
  forecast: ForecastMonthPoint[];
  forecastAssumptions: ForecastAssumptions;
  setForecastAssumptions: React.Dispatch<React.SetStateAction<ForecastAssumptions>>;
  monteCarloConfig: MonteCarloConfig;
  setMonteCarloConfig: React.Dispatch<React.SetStateAction<MonteCarloConfig>>;
  monteCarlo: MonteCarloResult;
  rerunMonteCarlo: () => void;
  tornado: TornadoDriver[];
  offlineInsights: OfflineInsight[];

  // Scenario Sandbox ("What-If" mode)
  isSandbox: boolean;
  enterSandbox: () => void;
  applySandboxToLive: () => void;
  discardSandbox: () => void;

  // Undo Support for bulk edits
  canUndo: boolean;
  undoLastBulkChange: () => void;

  // Mutators
  updateSettings: (patch: Partial<WorkshopSettings>) => void;
  upsertIngredient: (ing: Ingredient) => void;
  deleteIngredient: (id: string) => void;
  bulkUpdateIngredientPrices: (updates: Record<string, number>, label?: string) => void;
  upsertSubRecipe: (sr: SubRecipe) => void;
  deleteSubRecipe: (id: string) => void;
  upsertRecipe: (rec: Recipe) => void;
  deleteRecipe: (id: string) => void;
  bulkUpdateRecipePrices: (updates: Record<string, number>, label?: string) => void;
  upsertStaff: (staff: StaffMember) => void;
  deleteStaff: (id: string) => void;
  upsertOverhead: (oh: OverheadItem) => void;
  deleteOverhead: (id: string) => void;
  upsertCheck: (chk: SayadiCheck) => void;
  deleteCheck: (id: string) => void;
  updateSeasonalCurve: (curve: SeasonalMonth[]) => void;
  upsertVarianceRecord: (rec: VarianceRecord) => void;
  deleteVarianceRecord: (id: string) => void;
  updateMixBox: (mix: MixBoxPreset) => void;
  updateCustomCake: (cake: CustomCakePreset) => void;

  // Full state utilities
  replaceAllData: (nextData: WorkshopData, toastText?: string) => void;
  resetToDemo: () => void;
  startBlankWorkshop: () => void;

  // Toasts
  toasts: ToastMessage[];
  notify: (text: string, tone?: ToastMessage['tone']) => void;
  dismissToast: (id: string) => void;
}

const WorkshopContext = createContext<WorkshopContextValue | null>(null);

function loadInitialData(): WorkshopData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as WorkshopData;
      if (parsed && parsed.settings && Array.isArray(parsed.ingredients) && Array.isArray(parsed.recipes)) {
        return parsed;
      }
    }
  } catch {
    // Fallback to rich demo data
  }
  return createDemoWorkshopData();
}

export const WorkshopProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [liveData, setLiveData] = useState<WorkshopData>(loadInitialData);
  const [sandboxData, setSandboxData] = useState<WorkshopData | null>(null);
  const [undoSnapshot, setUndoSnapshot] = useState<WorkshopData | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const isSandbox = sandboxData !== null;
  const activeData = sandboxData ?? liveData;

  const [forecastAssumptions, setForecastAssumptions] = useState<ForecastAssumptions>({
    horizonMonths: 12,
    monthlyDemandGrowthPct: 1.2,
    annualMaterialInflationPct: liveData.settings.defaultAnnualInflationPct,
    pricePassThroughPct: 85,
    startMonthIndex: 8, // Azar (Yalda -> Esfand peak -> Summer slump)
  });

  const [monteCarloConfig, setMonteCarloConfig] = useState<MonteCarloConfig>({
    demandVolatilityPct: 14,
    costVolatilityPct: 11,
    spoilageVolatilityPct: 2.5,
    iterations: liveData.settings.monteCarloIterations,
    seed: 140409,
  });

  // Sync MC iterations when settings change
  useEffect(() => {
    setMonteCarloConfig((prev) =>
      prev.iterations === activeData.settings.monteCarloIterations
        ? prev
        : { ...prev, iterations: activeData.settings.monteCarloIterations }
    );
  }, [activeData.settings.monteCarloIterations]);

  // Persist live data cleanly to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(liveData));
    } catch {
      // Ignore storage quota errors
    }
  }, [liveData]);

  const notify = useCallback((text: string, tone: ToastMessage['tone'] = 'success') => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => [...prev.slice(-3), { id, text, tone }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3800);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const commit = useCallback(
    (updater: (prev: WorkshopData) => WorkshopData, saveUndo = false) => {
      if (isSandbox) {
        setSandboxData((prev) => {
          if (!prev) return prev;
          if (saveUndo) setUndoSnapshot(prev);
          return updater(prev);
        });
      } else {
        setLiveData((prev) => {
          if (saveUndo) setUndoSnapshot(prev);
          return updater(prev);
        });
      }
    },
    [isSandbox]
  );

  // Scenario Sandbox controls
  const enterSandbox = useCallback(() => {
    if (!sandboxData) {
      setSandboxData(JSON.parse(JSON.stringify(liveData)));
      notify('حالت آزمایشگاه سناریو (What-If) فعال شد؛ تغییرات شما به داده اصلی آسیب نمی‌زند.', 'info');
    }
  }, [liveData, sandboxData, notify]);

  const applySandboxToLive = useCallback(() => {
    if (sandboxData) {
      setUndoSnapshot(liveData);
      setLiveData(sandboxData);
      setSandboxData(null);
      notify('تغییرات سناریو با موفقیت روی داده‌های اصلی کارگاه اعمال شد.', 'success');
    }
  }, [sandboxData, liveData, notify]);

  const discardSandbox = useCallback(() => {
    setSandboxData(null);
    notify('سناریوی آزمایشی لغو شد و به داده‌های اصلی برگشتید.', 'info');
  }, [notify]);

  const undoLastBulkChange = useCallback(() => {
    if (!undoSnapshot) return;
    if (isSandbox) {
      setSandboxData(undoSnapshot);
    } else {
      setLiveData(undoSnapshot);
    }
    setUndoSnapshot(null);
    notify('آخرین تغییر گروهی با موفقیت بازگردانی شد.', 'info');
  }, [undoSnapshot, isSandbox, notify]);

  // Memoized 100% Deterministic Reactive Computation Graph
  const summary = useMemo(() => computeWorkshopSummary(activeData), [activeData]);

  const forecast = useMemo(
    () => runSeasonalForecast(activeData, summary, forecastAssumptions),
    [activeData, summary, forecastAssumptions]
  );

  const monteCarlo = useMemo(
    () => runMonteCarloSimulation(activeData, summary, monteCarloConfig),
    [activeData, summary, monteCarloConfig]
  );

  const tornado = useMemo(
    () => runTornadoSensitivity(activeData, summary),
    [activeData, summary]
  );

  const offlineInsights = useMemo(
    () => generateOfflineStrategicInsights(activeData, summary, monteCarlo, tornado),
    [activeData, summary, monteCarlo, tornado]
  );

  const rerunMonteCarlo = useCallback(() => {
    setMonteCarloConfig((prev) => ({
      ...prev,
      seed: ((prev.seed * 1664525 + 1013904223) >>> 0) % 999999 + 1,
    }));
  }, []);

  // Mutators
  const updateSettings = useCallback(
    (patch: Partial<WorkshopSettings>) => {
      commit((prev) => ({ ...prev, settings: { ...prev.settings, ...patch } }));
    },
    [commit]
  );

  const upsertIngredient = useCallback(
    (ing: Ingredient) => {
      commit((prev) => {
        const exists = prev.ingredients.some((i) => i.id === ing.id);
        return {
          ...prev,
          ingredients: exists
            ? prev.ingredients.map((i) => (i.id === ing.id ? ing : i))
            : [ing, ...prev.ingredients],
        };
      });
      notify(`ماده اولیه «${ing.name}» ذخیره شد و در تمام دستورها اعمال گردید.`);
    },
    [commit, notify]
  );

  const deleteIngredient = useCallback(
    (id: string) => {
      commit((prev) => ({
        ...prev,
        ingredients: prev.ingredients.filter((i) => i.id !== id),
      }));
      notify('ماده اولیه از انبار حذف شد.', 'warning');
    },
    [commit, notify]
  );

  const bulkUpdateIngredientPrices = useCallback(
    (updates: Record<string, number>, label = 'به‌روزرسانی قیمت بازار') => {
      commit(
        (prev) => ({
          ...prev,
          ingredients: prev.ingredients.map((ing) => {
            const nextPrice = updates[ing.id];
            if (nextPrice === undefined || nextPrice <= 0 || nextPrice === ing.packPrice) {
              return ing;
            }
            const pctChange = ((nextPrice - ing.packPrice) / Math.max(1, ing.packPrice)) * 100;
            return {
              ...ing,
              previousPackPrice: ing.packPrice,
              packPrice: Math.round(nextPrice),
              monthlyInflationPct:
                pctChange > 0
                  ? Number(Math.min(25, Math.max(ing.monthlyInflationPct, pctChange)).toFixed(1))
                  : ing.monthlyInflationPct,
              history: [
                ...ing.history.slice(-7),
                { dateShamsi: 'جدید', packPrice: Math.round(nextPrice) },
              ],
            };
          }),
        }),
        true
      );
      notify(`${label} با موفقیت در تمام محصولات و نمودارها اعمال شد. (قابل بازگشت)`);
    },
    [commit, notify]
  );

  const upsertSubRecipe = useCallback(
    (sr: SubRecipe) => {
      commit((prev) => {
        const exists = prev.subRecipes.some((x) => x.id === sr.id);
        return {
          ...prev,
          subRecipes: exists
            ? prev.subRecipes.map((x) => (x.id === sr.id ? sr : x))
            : [sr, ...prev.subRecipes],
        };
      });
      notify(`ماده نیمه‌ساخته «${sr.name}» ذخیره و در دستور پخت‌ها به‌روزرسانی شد.`);
    },
    [commit, notify]
  );

  const deleteSubRecipe = useCallback(
    (id: string) => {
      commit((prev) => ({
        ...prev,
        subRecipes: prev.subRecipes.filter((x) => x.id !== id),
      }));
      notify('ماده نیمه‌ساخته حذف شد.', 'warning');
    },
    [commit, notify]
  );

  const upsertRecipe = useCallback(
    (rec: Recipe) => {
      commit((prev) => {
        const exists = prev.recipes.some((x) => x.id === rec.id);
        return {
          ...prev,
          recipes: exists
            ? prev.recipes.map((x) => (x.id === rec.id ? rec : x))
            : [rec, ...prev.recipes],
        };
      });
      notify(`فرمولاسیون «${rec.name}» ذخیره و بهایابی مجدد شد.`);
    },
    [commit, notify]
  );

  const deleteRecipe = useCallback(
    (id: string) => {
      commit((prev) => ({
        ...prev,
        recipes: prev.recipes.filter((x) => x.id !== id),
      }));
      notify('محصول از منو حذف شد.', 'warning');
    },
    [commit, notify]
  );

  const bulkUpdateRecipePrices = useCallback(
    (updates: Record<string, number>, label = 'اصلاح گروهی قیمت فروش') => {
      commit(
        (prev) => ({
          ...prev,
          recipes: prev.recipes.map((r) => {
            const nextPrice = updates[r.id];
            return nextPrice && nextPrice > 0 ? { ...r, sellingPricePerKg: Math.round(nextPrice) } : r;
          }),
        }),
        true
      );
      notify(`${label} اعمال شد. در صورت نیاز دکمه «بازگشت» را بزنید.`);
    },
    [commit, notify]
  );

  const upsertStaff = useCallback(
    (member: StaffMember) => {
      commit((prev) => {
        const exists = prev.staff.some((s) => s.id === member.id);
        return {
          ...prev,
          staff: exists ? prev.staff.map((s) => (s.id === member.id ? member : s)) : [...prev.staff, member],
        };
      });
      notify(`اطلاعات حقوق و سربار «${member.name}» ثبت شد.`);
    },
    [commit, notify]
  );

  const deleteStaff = useCallback(
    (id: string) => {
      commit((prev) => ({ ...prev, staff: prev.staff.filter((s) => s.id !== id) }));
      notify('عضو تیم از لیست حقوق حذف شد.', 'warning');
    },
    [commit, notify]
  );

  const upsertOverhead = useCallback(
    (oh: OverheadItem) => {
      commit((prev) => {
        const exists = prev.overheads.some((o) => o.id === oh.id);
        return {
          ...prev,
          overheads: exists ? prev.overheads.map((o) => (o.id === oh.id ? oh : o)) : [...prev.overheads, oh],
        };
      });
      notify(`ردیف سربار «${oh.name}» به‌روزرسانی شد.`);
    },
    [commit, notify]
  );

  const deleteOverhead = useCallback(
    (id: string) => {
      commit((prev) => ({ ...prev, overheads: prev.overheads.filter((o) => o.id !== id) }));
      notify('ردیف سربار حذف شد.', 'warning');
    },
    [commit, notify]
  );

  const upsertCheck = useCallback(
    (chk: SayadiCheck) => {
      commit((prev) => {
        const exists = prev.checks.some((c) => c.id === chk.id);
        return {
          ...prev,
          checks: exists ? prev.checks.map((c) => (c.id === chk.id ? chk : c)) : [chk, ...prev.checks],
        };
      });
      notify(`چک صیادی «${chk.counterparty}» در دفتر نقدینگی ثبت شد.`);
    },
    [commit, notify]
  );

  const deleteCheck = useCallback(
    (id: string) => {
      commit((prev) => ({ ...prev, checks: prev.checks.filter((c) => c.id !== id) }));
      notify('چک از فهرست حذف شد.', 'warning');
    },
    [commit, notify]
  );

  const updateSeasonalCurve = useCallback(
    (curve: SeasonalMonth[]) => {
      commit((prev) => ({ ...prev, seasonalCurve: curve }));
    },
    [commit]
  );

  const upsertVarianceRecord = useCallback(
    (rec: VarianceRecord) => {
      commit((prev) => {
        const exists = prev.varianceRecords.some((v) => v.id === rec.id);
        return {
          ...prev,
          varianceRecords: exists
            ? prev.varianceRecords.map((v) => (v.id === rec.id ? rec : v))
            : [rec, ...prev.varianceRecords],
        };
      });
      notify('رکورد انبارگردانی و مغایرت‌گیری ذخیره شد.');
    },
    [commit, notify]
  );

  const deleteVarianceRecord = useCallback(
    (id: string) => {
      commit((prev) => ({
        ...prev,
        varianceRecords: prev.varianceRecords.filter((v) => v.id !== id),
      }));
      notify('رکورد مغایرت حذف شد.', 'warning');
    },
    [commit, notify]
  );

  const updateMixBox = useCallback(
    (mixBox: MixBoxPreset) => {
      commit((prev) => ({ ...prev, mixBox }));
    },
    [commit]
  );

  const updateCustomCake = useCallback(
    (customCake: CustomCakePreset) => {
      commit((prev) => ({ ...prev, customCake }));
    },
    [commit]
  );

  const replaceAllData = useCallback(
    (nextData: WorkshopData, toastText = 'اطلاعات کارگاه با موفقیت بارگذاری شد.') => {
      setUndoSnapshot(liveData);
      setSandboxData(null);
      setLiveData(nextData);
      notify(toastText);
    },
    [liveData, notify]
  );

  const resetToDemo = useCallback(() => {
    setUndoSnapshot(liveData);
    setSandboxData(null);
    setLiveData(createDemoWorkshopData());
    notify('داده‌های نمونه کارگاه قنادی ایرانی با موفقیت بازیابی شد.', 'info');
  }, [liveData, notify]);

  const startBlankWorkshop = useCallback(() => {
    setUndoSnapshot(liveData);
    setSandboxData(null);
    setLiveData(createBlankWorkshopData());
    notify('کارگاه خالی از صفر ایجاد شد؛ آماده ثبت مواد و دستورهای شماست.', 'info');
  }, [liveData, notify]);

  const value: WorkshopContextValue = {
    data: activeData,
    summary,
    forecast,
    forecastAssumptions,
    setForecastAssumptions,
    monteCarloConfig,
    setMonteCarloConfig,
    monteCarlo,
    rerunMonteCarlo,
    tornado,
    offlineInsights,
    isSandbox,
    enterSandbox,
    applySandboxToLive,
    discardSandbox,
    canUndo: undoSnapshot !== null,
    undoLastBulkChange,
    updateSettings,
    upsertIngredient,
    deleteIngredient,
    bulkUpdateIngredientPrices,
    upsertSubRecipe,
    deleteSubRecipe,
    upsertRecipe,
    deleteRecipe,
    bulkUpdateRecipePrices,
    upsertStaff,
    deleteStaff,
    upsertOverhead,
    deleteOverhead,
    upsertCheck,
    deleteCheck,
    updateSeasonalCurve,
    upsertVarianceRecord,
    deleteVarianceRecord,
    updateMixBox,
    updateCustomCake,
    replaceAllData,
    resetToDemo,
    startBlankWorkshop,
    toasts,
    notify,
    dismissToast,
  };

  return <WorkshopContext.Provider value={value}>{children}</WorkshopContext.Provider>;
};

export function useWorkshop(): WorkshopContextValue {
  const ctx = useContext(WorkshopContext);
  if (!ctx) throw new Error('useWorkshop must be used within WorkshopProvider');
  return ctx;
}
