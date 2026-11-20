import React, { useRef, useState } from 'react';
import {
  Cloud,
  Copy,
  Download,
  RefreshCw,
  RotateCcw,
  Shield,
  Sliders,
  Sparkles,
  Upload,
} from 'lucide-react';
import { useWorkshop } from '../../store/WorkshopContext';
import { APPS_SCRIPT_CODE_GS } from '../../utils/appsScriptTemplate';
import { pullFromGoogleSheets, pushToGoogleSheets } from '../../services/googleSheetsSync';
import { BusinessModelPreset, CurrencyDisplayUnit, WorkshopData } from '../../types';
import { HelpTip } from '../../components/HelpTip';
import { LocaleNumberInput } from '../../components/LocaleNumberInput';

type SettingsPanelId = 'identity' | 'financial' | 'capacity' | 'scientific' | 'ux' | 'cloud';

export const WorkshopDnaSettings: React.FC = () => {
  const {
    data,
    summary,
    forecast,
    updateSettings,
    replaceAllData,
    resetToDemo,
    startBlankWorkshop,
    notify,
  } = useWorkshop();
  const { settings } = data;

  const [panel, setPanel] = useState<SettingsPanelId>('identity');
  const [syncing, setSyncing] = useState(false);
  const [showCodeGs, setShowCodeGs] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1_500_000) {
      notify('حجم لوگو باید کمتر از ۱.۵ مگابایت باشد.', 'warning');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        updateSettings({ logoBase64: reader.result });
        notify('لوگوی اختصاصی کارگاه ذخیره شد و روی گزارش‌ها و اتیکت‌ها نمایش داده می‌شود.');
      }
    };
    reader.readAsDataURL(file);
  };

  const applyBusinessModelPreset = (preset: BusinessModelPreset) => {
    if (preset === 'home_workshop') {
      updateSettings({
        businessModel: preset,
        ovenCount: 1,
        traysPerOven: 4,
        dailyWorkingHours: 7,
        overheadAllocationMethod: 'weight',
      });
    } else if (preset === 'wholesale_cafe') {
      updateSettings({
        businessModel: preset,
        ovenCount: 3,
        traysPerOven: 12,
        dailyWorkingHours: 12,
        overheadAllocationMethod: 'time_abc',
      });
    } else if (preset === 'workshop_plus_branch') {
      updateSettings({
        businessModel: preset,
        ovenCount: 3,
        traysPerOven: 12,
        dailyWorkingHours: 11,
        overheadAllocationMethod: 'hybrid',
      });
    } else {
      updateSettings({
        businessModel: preset,
        ovenCount: 2,
        traysPerOven: 10,
        dailyWorkingHours: 10,
        overheadAllocationMethod: 'hybrid',
      });
    }
    notify('الگوی مدل کسب‌وکار و ظرفیت پایه روی تنظیمات اعمال شد.');
  };

  const handlePushSheets = async () => {
    setSyncing(true);
    const res = await pushToGoogleSheets(settings.googleSheetsWebhookUrl, data, summary, forecast);
    setSyncing(false);
    if (res.ok) {
      updateSettings({ lastSyncedAt: res.syncedAt ?? new Date().toISOString() });
      notify(res.message, 'success');
    } else {
      notify(res.message, 'error');
    }
  };

  const handlePullSheets = async () => {
    setSyncing(true);
    const res = await pullFromGoogleSheets(settings.googleSheetsWebhookUrl);
    setSyncing(false);
    if (res.ok && res.state) {
      replaceAllData(res.state, res.message);
    } else {
      notify(res.message, 'error');
    }
  };

  const handleExportJson = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `shirintaraz-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    notify('فایل پشتیبان کامل JSON دانلود شد.');
  };

  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as WorkshopData;
        if (parsed && parsed.settings && Array.isArray(parsed.ingredients)) {
          replaceAllData(parsed, 'فایل پشتیبان JSON با موفقیت بازیابی شد.');
        } else {
          notify('ساختار فایل پشتیبان معتبر نیست.', 'error');
        }
      } catch {
        notify('خطا در خواندن فایل JSON.', 'error');
      }
    };
    reader.readAsText(file);
  };

  const copyCodeGs = async () => {
    try {
      await navigator.clipboard.writeText(APPS_SCRIPT_CODE_GS);
      notify('کد آماده Code.gs (سازنده ۶ تب رابطه‌ای گوگل شیت) کپی شد.');
    } catch {
      notify('لطفاً کد را از کادر زیر کپی کنید.', 'info');
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
      {/* 6 Sub-Panel Selector */}
      <nav
        aria-label="زیربخش‌های مرکز تنظیمات DNA کارگاه"
        className="lg:col-span-3 bg-white border border-[#EAE2D8] rounded-xl p-2.5 space-y-1 h-fit"
      >
        {(
          [
            { id: 'identity', label: '۱. هویت، برند و مدل کارگاه' },
            { id: 'financial', label: '۲. قوانین مالی و بازار ایران' },
            { id: 'capacity', label: '۳. ظرفیت فیزیکی فر و شیفت' },
            { id: 'scientific', label: '۴. پارامترهای علمی و هشدارها' },
            { id: 'ux', label: '۵. تجربه کاربری و حریم خصوصی' },
            { id: 'cloud', label: '۶. پشتیبان‌گیری و گوگل شیت' },
          ] as const
        ).map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setPanel(item.id)}
            className={`w-full text-right px-3 py-2.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
              panel === item.id
                ? 'bg-[#2B1E1A] text-white'
                : 'text-[#5A4A42] hover:bg-[#FAF8F5] hover:text-[#2B1E1A]'
            }`}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {/* Panel Body */}
      <div className="lg:col-span-9 bg-white border border-[#EAE2D8] rounded-xl p-5 space-y-5">
        {panel === 'identity' && (
          <div className="space-y-4">
            <h2 className="text-base font-extrabold text-[#2B1E1A]">
              ۱. هویت، برندینگ چاپی و مدل کسب‌وکار کارگاه
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-bold text-[#4B3B34] mb-1">نام کارگاه / قنادی</label>
                <input
                  type="text"
                  value={settings.workshopName}
                  onChange={(e) => updateSettings({ workshopName: e.target.value })}
                  className="w-full rounded-lg border border-[#EAE2D8] px-3 py-2 text-xs font-semibold"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#4B3B34] mb-1">نام مدیر / استادکار</label>
                <input
                  type="text"
                  value={settings.managerName}
                  onChange={(e) => updateSettings({ managerName: e.target.value })}
                  className="w-full rounded-lg border border-[#EAE2D8] px-3 py-2 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#4B3B34] mb-1">شماره تماس (روی فاکتور و اتیکت)</label>
                <input
                  type="text"
                  value={settings.phone}
                  onChange={(e) => updateSettings({ phone: e.target.value })}
                  className="w-full rounded-lg border border-[#EAE2D8] px-3 py-2 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#4B3B34] mb-1">آیدی اینستاگرام</label>
                <input
                  type="text"
                  value={settings.instagram}
                  onChange={(e) => updateSettings({ instagram: e.target.value })}
                  className="w-full rounded-lg border border-[#EAE2D8] px-3 py-2 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#4B3B34] mb-1">الگوی مدل کسب‌وکار</label>
                <select
                  value={settings.businessModel}
                  onChange={(e) => applyBusinessModelPreset(e.target.value as BusinessModelPreset)}
                  className="w-full rounded-lg border border-[#EAE2D8] bg-white px-3 py-2 text-xs font-semibold"
                >
                  <option value="home_workshop">کارگاه خانگی و اینستاگرامی</option>
                  <option value="storefront_confectionery">قنادی ویترین‌دار کلاسیک</option>
                  <option value="wholesale_cafe">کارگاه پخش عمده و کافه‌ای (B2B)</option>
                  <option value="workshop_plus_branch">کارگاه مرکزی + شعبه فروش</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-[#4B3B34] mb-1">واحد نمایش پول در کل سیستم</label>
                <select
                  value={settings.currencyUnit}
                  onChange={(e) =>
                    updateSettings({ currencyUnit: e.target.value as CurrencyDisplayUnit })
                  }
                  className="w-full rounded-lg border border-[#EAE2D8] bg-white px-3 py-2 text-xs font-semibold"
                >
                  <option value="toman">تومان (پیشنهادی بازار ایران)</option>
                  <option value="million_toman">میلیون تومان</option>
                  <option value="rial">ریال</option>
                </select>
              </div>
            </div>

            <div className="pt-3 border-t border-[#F2EBE2] flex flex-wrap items-center gap-4">
              {settings.logoBase64 ? (
                <img
                  src={settings.logoBase64}
                  alt="لوگوی کارگاه"
                  className="w-14 h-14 rounded-xl object-cover border border-[#EAE2D8]"
                />
              ) : (
                <div className="w-14 h-14 rounded-xl bg-[#FAF8F5] border border-dashed border-[#C8B8AF] flex items-center justify-center text-xs text-[#8C7B72]">
                  لوگو
                </div>
              )}
              <div className="space-y-1">
                <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#FAF8F5] border border-[#EAE2D8] hover:border-[#2D6A4F] text-xs font-bold cursor-pointer">
                  <Upload className="w-3.5 h-3.5" />
                  <span>بارگذاری لوگوی اختصاصی (برای PDF و اتیکت)</span>
                  <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                </label>
                {settings.logoBase64 && (
                  <button
                    type="button"
                    onClick={() => updateSettings({ logoBase64: '' })}
                    className="block text-[11px] text-[#C84B31] font-semibold cursor-pointer"
                  >
                    حذف لوگو
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {panel === 'financial' && (
          <div className="space-y-4">
            <h2 className="text-base font-extrabold text-[#2B1E1A]">
              ۲. قوانین مالی، مالیات و مقررات صنفی بازار ایران
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <label className="flex items-center justify-between rounded-xl border border-[#EAE2D8] bg-[#FAF8F5] p-3.5 text-xs font-bold cursor-pointer">
                <span>اعمال مالیات بر ارزش افزوده (۱۰٪)</span>
                <input
                  type="checkbox"
                  checked={settings.vatEnabled}
                  onChange={(e) => updateSettings({ vatEnabled: e.target.checked })}
                  className="accent-[#2D6A4F] w-4 h-4"
                />
              </label>

              <label className="flex items-center justify-between rounded-xl border border-[#EAE2D8] bg-[#FAF8F5] p-3.5 text-xs font-bold cursor-pointer">
                <span className="flex items-center">
                  اجرای قانون کسر وزن جعبه
                  <HelpTip id="boxWeightLaw" />
                </span>
                <input
                  type="checkbox"
                  checked={settings.enforceBoxWeightDeduction}
                  onChange={(e) =>
                    updateSettings({ enforceBoxWeightDeduction: e.target.checked })
                  }
                  className="accent-[#2D6A4F] w-4 h-4"
                />
              </label>

              <div>
                <label className="block text-xs font-bold text-[#4B3B34] mb-1">
                  کمیسیون پیش‌فرض اسنپ‌فود / تپسی‌فود (%)
                </label>
                <LocaleNumberInput
                  value={settings.defaultSnappfoodCommissionPct}
                  onChange={(v) => updateSettings({ defaultSnappfoodCommissionPct: v })}
                  suffix="٪"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#4B3B34] mb-1">
                  هزینه بسته‌بندی اضافه ارسال پیک (تومان)
                </label>
                <LocaleNumberInput
                  value={settings.snappfoodExtraBoxCost}
                  onChange={(v) => updateSettings({ snappfoodExtraBoxCost: v })}
                  suffix="تومان"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#4B3B34] mb-1">کارمزد دستگاه کارتخوان POS (%)</label>
                <LocaleNumberInput
                  value={settings.defaultPosFeePct}
                  onChange={(v) => updateSettings({ defaultPosFeePct: v })}
                  suffix="٪"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#4B3B34] mb-1">
                  پله رُندکردن هوشمند قیمت‌ها (تومان)
                </label>
                <select
                  value={settings.priceRoundingStep}
                  onChange={(e) =>
                    updateSettings({
                      priceRoundingStep: Number(e.target.value) as 5000 | 10000 | 25000,
                    })
                  }
                  className="w-full rounded-lg border border-[#EAE2D8] bg-white px-3 py-2 text-xs font-bold"
                >
                  <option value={5000}>رُند به ۵,۰۰۰ تومان</option>
                  <option value={10000}>رُند به ۱۰,۰۰۰ تومان</option>
                  <option value={25000}>رُند به ۲۵,۰۰۰ تومان</option>
                </select>
              </div>
            </div>

            <div className="pt-3 border-t border-[#F2EBE2] space-y-2">
              <div className="text-xs font-extrabold text-[#2B1E1A]">
                پیش‌فرض محاسبه‌گر قانون کار ایران برای پرسنل جدید:
              </div>
              <div className="flex flex-wrap gap-4 text-xs">
                <label className="inline-flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.defaultIncludeInsurance23}
                    onChange={(e) =>
                      updateSettings({ defaultIncludeInsurance23: e.target.checked })
                    }
                    className="accent-[#2D6A4F]"
                  />
                  <span>بیمه ۲۳٪ کارفرما</span>
                </label>
                <label className="inline-flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.defaultIncludeEidi}
                    onChange={(e) => updateSettings({ defaultIncludeEidi: e.target.checked })}
                    className="accent-[#2D6A4F]"
                  />
                  <span>ذخیره ماهانه عیدی</span>
                </label>
                <label className="inline-flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.defaultIncludeSanavat}
                    onChange={(e) => updateSettings({ defaultIncludeSanavat: e.target.checked })}
                    className="accent-[#2D6A4F]"
                  />
                  <span>ذخیره ماهانه سنوات</span>
                </label>
              </div>
            </div>
          </div>
        )}

        {panel === 'capacity' && (
          <div className="space-y-4">
            <h2 className="text-base font-extrabold text-[#2B1E1A]">
              ۳. ظرفیت فیزیکی کارگاه، فرها و شیفت کاری
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              <div>
                <label className="block text-xs font-bold text-[#4B3B34] mb-1">تعداد فر فعال</label>
                <LocaleNumberInput
                  value={settings.ovenCount}
                  onChange={(v) => updateSettings({ ovenCount: Math.max(1, v) })}
                  min={1}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#4B3B34] mb-1">ظرفیت سینی در هر فر</label>
                <LocaleNumberInput
                  value={settings.traysPerOven}
                  onChange={(v) => updateSettings({ traysPerOven: Math.max(1, v) })}
                  min={1}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#4B3B34] mb-1">ساعت کاری روزانه کارگاه</label>
                <LocaleNumberInput
                  value={settings.dailyWorkingHours}
                  onChange={(v) => updateSettings({ dailyWorkingHours: Math.max(1, v) })}
                  suffix="ساعت"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#4B3B34] mb-1">روزهای فعال در ماه</label>
                <LocaleNumberInput
                  value={settings.activeWorkingDaysPerMonth}
                  onChange={(v) => updateSettings({ activeWorkingDaysPerMonth: Math.max(1, v) })}
                  suffix="روز"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#4B3B34] mb-1">روش سرشکن سربار</label>
                <select
                  value={settings.overheadAllocationMethod}
                  onChange={(e) =>
                    updateSettings({
                      overheadAllocationMethod: e.target.value as 'weight' | 'time_abc' | 'hybrid',
                    })
                  }
                  className="w-full rounded-lg border border-[#EAE2D8] bg-white px-3 py-2 text-xs font-bold"
                >
                  <option value="weight">وزنی (کیلوگرم)</option>
                  <option value="time_abc">زمانی ABC (فر و کار)</option>
                  <option value="hybrid">ترکیبی ۵۰/۵۰</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-[#4B3B34] mb-1">
                  نرخ پیش‌فرض ساعت کار دکوراتور
                </label>
                <LocaleNumberInput
                  value={settings.defaultDecoratorHourlyRate}
                  onChange={(v) => updateSettings({ defaultDecoratorHourlyRate: v })}
                  suffix="تومان"
                />
              </div>
            </div>
          </div>
        )}

        {panel === 'scientific' && (
          <div className="space-y-4">
            <h2 className="text-base font-extrabold text-[#2B1E1A] flex items-center gap-1.5">
              <Sliders className="w-4.5 h-4.5 text-[#4338CA]" />
              <span>۴. پارامترهای مدل‌های علمی مونت‌کارلو و آستانه هشدارها</span>
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              <div>
                <label className="block text-xs font-bold text-[#4B3B34] mb-1">حاشیه سود هدف (%)</label>
                <LocaleNumberInput
                  value={settings.targetNetMarginPct}
                  onChange={(v) => updateSettings({ targetNetMarginPct: v })}
                  suffix="٪"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#4B3B34] mb-1">خط قرمز حداقل سود (%)</label>
                <LocaleNumberInput
                  value={settings.redFlagMarginPct}
                  onChange={(v) => updateSettings({ redFlagMarginPct: v })}
                  suffix="٪"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#4B3B34] mb-1">تعداد تکرار شبیه‌ساز مونت‌کارلو</label>
                <select
                  value={settings.monteCarloIterations}
                  onChange={(e) =>
                    updateSettings({
                      monteCarloIterations: Number(e.target.value) as 500 | 1000 | 2500,
                    })
                  }
                  className="w-full rounded-lg border border-[#EAE2D8] bg-white px-3 py-2 text-xs font-bold"
                >
                  <option value={500}>۵۰۰ سناریو (فوق‌سریع)</option>
                  <option value={1000}>۱,۰۰۰ سناریو (استاندارد)</option>
                  <option value={2500}>۲,۵۰۰ سناریو (دقت بالا)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-[#4B3B34] mb-1">نرخ تورم سالانه پیش‌فرض (%)</label>
                <LocaleNumberInput
                  value={settings.defaultAnnualInflationPct}
                  onChange={(v) => updateSettings({ defaultAnnualInflationPct: v })}
                  suffix="٪"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#4B3B34] mb-1">درصد ذخیره سپر رکود از سود (%)</label>
                <LocaleNumberInput
                  value={settings.slumpReserveRatePct}
                  onChange={(v) => updateSettings({ slumpReserveRatePct: v })}
                  suffix="٪"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#4B3B34] mb-1">روزهای سپر نقدینگی امن</label>
                <LocaleNumberInput
                  value={settings.safeCashReserveDays}
                  onChange={(v) => updateSettings({ safeCashReserveDays: v })}
                  suffix="روز"
                />
              </div>
            </div>
          </div>
        )}

        {panel === 'ux' && (
          <div className="space-y-4">
            <h2 className="text-base font-extrabold text-[#2B1E1A] flex items-center gap-1.5">
              <Shield className="w-4.5 h-4.5 text-[#2D6A4F]" />
              <span>۵. تجربه کاربری، حریم خصوصی و نمایش اعداد</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <label className="flex items-center justify-between rounded-xl border border-[#EAE2D8] bg-[#FAF8F5] p-3.5 text-xs font-bold cursor-pointer">
                <span>حالت حریم خصوصی مدیر (تار کردن سود و حقوق)</span>
                <input
                  type="checkbox"
                  checked={settings.privacyMode}
                  onChange={(e) => updateSettings({ privacyMode: e.target.checked })}
                  className="accent-[#2B1E1A] w-4 h-4"
                />
              </label>

              <label className="flex items-center justify-between rounded-xl border border-[#EAE2D8] bg-[#FAF8F5] p-3.5 text-xs font-bold cursor-pointer">
                <span>حالت راهنمای آموزشی (نوارهای راهنمای هر صفحه)</span>
                <input
                  type="checkbox"
                  checked={settings.guidedLearningMode}
                  onChange={(e) => updateSettings({ guidedLearningMode: e.target.checked })}
                  className="accent-[#D97706] w-4 h-4"
                />
              </label>

              <label className="flex items-center justify-between rounded-xl border border-[#EAE2D8] bg-[#FAF8F5] p-3.5 text-xs font-bold cursor-pointer">
                <span>نمایش ارقام به صورت فارسی (۰-۹)</span>
                <input
                  type="checkbox"
                  checked={settings.usePersianDigits}
                  onChange={(e) => updateSettings({ usePersianDigits: e.target.checked })}
                  className="accent-[#2D6A4F] w-4 h-4"
                />
              </label>

              <div className="rounded-xl border border-[#EAE2D8] bg-[#FAF8F5] p-3.5 flex items-center justify-between gap-3">
                <span className="text-xs font-bold">تراکم جداول</span>
                <select
                  value={settings.tableDensity}
                  onChange={(e) =>
                    updateSettings({ tableDensity: e.target.value as 'comfortable' | 'compact' })
                  }
                  className="rounded-lg border border-[#EAE2D8] bg-white px-2.5 py-1 text-xs font-bold"
                >
                  <option value="comfortable">راحت و خوانا</option>
                  <option value="compact">فشرده مدیریتی</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {panel === 'cloud' && (
          <div className="space-y-5">
            <h2 className="text-base font-extrabold text-[#2B1E1A] flex items-center gap-1.5">
              <Cloud className="w-4.5 h-4.5 text-[#2D6A4F]" />
              <span>۶. پشتیبان‌گیری، همگام‌سازی ابری گوگل شیت و ویزارد شروع</span>
              <HelpTip id="googleSheetsSync" />
            </h2>

            {/* Two-Way Google Sheets Webhook Sync */}
            <div className="rounded-xl border border-[#EAE2D8] bg-[#FAF8F5] p-4 space-y-3">
              <div className="text-xs font-extrabold text-[#2B1E1A]">
                همگام‌سازی دوطرفه با گوگل شیت (با هدر text/plain بدون خطای CORS)
              </div>
              <input
                type="url"
                dir="ltr"
                value={settings.googleSheetsWebhookUrl}
                onChange={(e) => updateSettings({ googleSheetsWebhookUrl: e.target.value })}
                placeholder="https://script.google.com/macros/s/.../exec"
                className="w-full rounded-lg border border-[#EAE2D8] bg-white px-3 py-2 text-xs text-left"
              />
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={syncing}
                  onClick={handlePushSheets}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#2D6A4F] text-white text-xs font-bold hover:bg-[#23553F] disabled:opacity-60 cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>ارسال به ۶ تب گوگل شیت (Push)</span>
                </button>
                <button
                  type="button"
                  disabled={syncing}
                  onClick={handlePullSheets}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[#EAE2D8] bg-white hover:bg-[#EFE7DC] text-xs font-bold text-[#2B1E1A] disabled:opacity-60 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>بازیابی از گوگل شیت (Pull)</span>
                </button>
                <label className="inline-flex items-center gap-1.5 text-xs font-semibold mr-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.autoSyncEnabled}
                    onChange={(e) => updateSettings({ autoSyncEnabled: e.target.checked })}
                    className="accent-[#2D6A4F]"
                  />
                  <span>همگام‌سازی خودکار</span>
                </label>
              </div>
            </div>

            {/* Built-in Copyable Code.gs Generator */}
            <div className="rounded-xl border border-[#C7D2FE] bg-[#EEF2FF]/50 p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs font-extrabold text-[#312E81]">
                  تولیدکننده خودکار اسکریپت گوگل شیت (Code.gs — ۶ تب رابطه‌ای)
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={copyCodeGs}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#4338CA] text-white text-xs font-bold hover:bg-[#3730A3] cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>کپی کامل Code.gs</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCodeGs((s) => !s)}
                    className="px-3 py-1.5 rounded-lg bg-white border border-[#C7D2FE] text-xs font-bold text-[#312E81] cursor-pointer"
                  >
                    {showCodeGs ? 'پنهان کردن کد' : 'مشاهده کد'}
                  </button>
                </div>
              </div>

              <ol className="text-xs text-[#312E81] space-y-1 pr-4 list-decimal leading-relaxed">
                <li>یک فایل جدید در Google Sheets باز کنید و از منوی بالا مسیر Extensions → Apps Script را بزنید.</li>
                <li>کد آماده Code.gs را با دکمه بالا کپی کرده و جایگزین کد پیش‌فرض کنید و ذخیره (Save) نمایید.</li>
                <li>دکمه Deploy → New deployment → نوع Web app را بزنید و دسترسی را روی Anyone قرار دهید.</li>
                <li>لینک Web App ساخته‌شده را کپی کرده و در کادر بالای همین صفحه قرار دهید تا ۶ تب خودکار ساخته شوند.</li>
              </ol>

              {showCodeGs && (
                <pre
                  dir="ltr"
                  className="max-h-60 overflow-auto rounded-lg bg-[#2B1E1A] text-[#F5EFEA] p-3 text-[11px] text-left font-mono"
                >
                  {APPS_SCRIPT_CODE_GS}
                </pre>
              )}
            </div>

            {/* JSON Backup & Blank Workshop Wizard */}
            <div className="pt-3 border-t border-[#F2EBE2] flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={handleExportJson}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#2B1E1A] text-white text-xs font-bold cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>دانلود فایل پشتیبان JSON</span>
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[#EAE2D8] bg-white hover:bg-[#FAF8F5] text-xs font-bold text-[#2B1E1A] cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>بازگردانی از فایل JSON</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/json"
                onChange={handleImportJson}
                className="hidden"
              />
              <button
                type="button"
                onClick={resetToDemo}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[#F5D08A] bg-[#FFFBEB] text-xs font-bold text-[#92400E] cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>بازیابی داده‌های نمونه کارگاه</span>
              </button>
              <button
                type="button"
                onClick={startBlankWorkshop}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[#F5C2B8] bg-[#FEF2F2] text-xs font-bold text-[#991B1B] cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>شروع کارگاه خالی از صفر</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
