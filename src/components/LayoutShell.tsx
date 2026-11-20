import React, { useState } from 'react';
import {
  BarChart3,
  BookOpen,
  ChefHat,
  Cloud,
  Eye,
  EyeOff,
  FileSpreadsheet,
  FlaskConical,
  HelpCircle,
  Landmark,
  Menu,
  Package,
  RotateCcw,
  Settings,
  Sparkles,
  Store,
  X,
} from 'lucide-react';
import { useWorkshop } from '../store/WorkshopContext';
import { formatDigits } from '../utils/formatters';
import { HelpTip } from './HelpTip';

export type PillarId =
  | 'cockpits'
  | 'pantry'
  | 'recipes'
  | 'commercial'
  | 'cfo'
  | 'reports_settings';

interface LayoutShellProps {
  activePillar: PillarId;
  onSelectPillar: (pillar: PillarId) => void;
  onQuickJumpSettings: () => void;
  children: React.ReactNode;
}

const NAV_ITEMS: Array<{
  id: PillarId;
  label: string;
  sublabel: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  {
    id: 'cockpits',
    label: 'پایلوت‌ها و آزمایشگاه علمی',
    sublabel: 'مدیرعامل، منو، فر، مونت‌کارلو',
    icon: BarChart3,
  },
  {
    id: 'pantry',
    label: 'انبار هوشمند و آربیتراژ',
    sublabel: 'قیمت بازار، پرت نامرئی، دپو/چک',
    icon: Package,
  },
  {
    id: 'recipes',
    label: 'فرمولاسیون و تولید',
    sublabel: 'بهایابی، A/B، کارت پخت، خرید',
    icon: ChefHat,
  },
  {
    id: 'commercial',
    label: 'موتور درآمد و فروش',
    sublabel: 'کیک، پک میکس، اسنپ‌فود، اتیکت',
    icon: Store,
  },
  {
    id: 'cfo',
    label: 'مالی، نقدینگی و فصول',
    sublabel: 'قانون کار، چک صیادی، شوک تورم',
    icon: Landmark,
  },
  {
    id: 'reports_settings',
    label: 'گزارش، مشاور و تنظیمات',
    sublabel: 'PDF، مشاور آفلاین، DNA کارگاه',
    icon: FileSpreadsheet,
  },
];

export const LayoutShell: React.FC<LayoutShellProps> = ({
  activePillar,
  onSelectPillar,
  onQuickJumpSettings,
  children,
}) => {
  const {
    data,
    summary,
    isSandbox,
    enterSandbox,
    applySandboxToLive,
    discardSandbox,
    canUndo,
    undoLastBulkChange,
    updateSettings,
    toasts,
    dismissToast,
  } = useWorkshop();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { settings } = data;
  const usePersian = settings.usePersianDigits;

  // Health Ring stroke calculation
  const radius = 15;
  const circumference = 2 * Math.PI * radius;
  const progressOffset = circumference - (summary.healthScore / 100) * circumference;
  const ringColor =
    summary.healthScore >= 75
      ? '#2D6A4F'
      : summary.healthScore >= 50
      ? '#D97706'
      : '#C84B31';

  const hasCloudSync = Boolean(settings.googleSheetsWebhookUrl.trim());

  return (
    <div className="min-h-screen flex bg-[#FAF8F5] text-[#2B1E1A]">
      {/* Desktop Deep Espresso Sidebar */}
      <aside className="no-print hidden lg:flex lg:flex-col lg:w-64 lg:shrink-0 bg-[#2B1E1A] text-[#F5EFEA] sticky top-0 h-screen border-l border-[#3E2D27]">
        {/* Brand Lockup */}
        <div className="px-5 py-5 border-b border-[#3E2D27] flex items-center gap-3">
          {settings.logoBase64 ? (
            <img
              src={settings.logoBase64}
              alt={settings.workshopName}
              className="w-10 h-10 rounded-xl object-cover border border-[#544038] bg-white shrink-0"
            />
          ) : (
            <div className="w-10 h-10 rounded-xl bg-[#D97706]/20 border border-[#D97706]/40 flex items-center justify-center text-[#FBBF24] font-extrabold text-lg shrink-0">
              ش
            </div>
          )}
          <div className="min-w-0">
            <div className="text-base font-extrabold tracking-tight text-white truncate">
              شیرین‌تراز OS
            </div>
            <div className="text-[11px] text-[#C8B8AF] truncate">{settings.workshopName}</div>
          </div>
        </div>

        {/* Navigation Links */}
        <nav aria-label="منوی اصلی ستون‌ها" className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activePillar === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectPillar(item.id)}
                className={`w-full text-right flex items-center gap-3 px-3.5 py-3 rounded-xl transition-colors cursor-pointer ${
                  active
                    ? 'bg-[#3F2E28] text-white border border-[#59423A]'
                    : 'text-[#D6C7BE] hover:bg-[#362621] hover:text-white border border-transparent'
                }`}
              >
                <Icon
                  className={`w-4.5 h-4.5 shrink-0 ${
                    active ? 'text-[#FBBF24]' : 'text-[#A8948A]'
                  }`}
                />
                <div className="min-w-0">
                  <div className="text-[13px] font-bold truncate">{item.label}</div>
                  <div className="text-[11px] text-[#B3A197] truncate">{item.sublabel}</div>
                </div>
              </button>
            );
          })}
        </nav>

        {/* Bottom Quick Sandbox & Settings Card */}
        <div className="p-3.5 border-t border-[#3E2D27] space-y-2">
          <button
            type="button"
            onClick={isSandbox ? discardSandbox : enterSandbox}
            className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              isSandbox
                ? 'bg-[#D97706] text-white hover:bg-[#B45309]'
                : 'bg-[#3A2A24] text-[#F5EFEA] hover:bg-[#49352E] border border-[#523C34]'
            }`}
          >
            <FlaskConical className="w-3.5 h-3.5" />
            <span>{isSandbox ? 'خروج از حالت سناریو' : 'ورود به آزمایشگاه What-If'}</span>
          </button>

          <button
            type="button"
            onClick={onQuickJumpSettings}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs text-[#D6C7BE] hover:text-white hover:bg-[#362621] transition-colors cursor-pointer"
          >
            <Settings className="w-3.5 h-3.5" />
            <span>تنظیمات DNA کارگاه</span>
          </button>
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="no-print fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/50"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative w-72 max-w-[85vw] bg-[#2B1E1A] text-white h-full flex flex-col z-10 shadow-2xl">
            <div className="p-4 border-b border-[#3E2D27] flex items-center justify-between">
              <div>
                <div className="font-extrabold text-base">شیرین‌تراز OS</div>
                <div className="text-xs text-[#C8B8AF] truncate">{settings.workshopName}</div>
              </div>
              <button
                type="button"
                aria-label="بستن منو"
                onClick={() => setMobileMenuOpen(false)}
                className="p-1.5 rounded-lg text-[#D6C7BE] hover:bg-[#3E2D27]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto p-3 space-y-1">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = activePillar === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      onSelectPillar(item.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full text-right flex items-center gap-3 px-3 py-3 rounded-xl ${
                      active ? 'bg-[#3F2E28] text-white' : 'text-[#D6C7BE] hover:bg-[#362621]'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <div className="min-w-0">
                      <div className="text-sm font-bold">{item.label}</div>
                      <div className="text-[11px] text-[#B3A197]">{item.sublabel}</div>
                    </div>
                  </button>
                );
              })}
            </nav>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Persistent Top Command Bar */}
        <header className="no-print sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-[#EAE2D8] px-4 lg:px-6 py-2.5">
          <div className="flex items-center justify-between gap-3">
            {/* Right zone (RTL start): Mobile menu + Workshop Identity & Health Ring */}
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                aria-label="باز کردن منوی ناوبری"
                onClick={() => setMobileMenuOpen(true)}
                className="lg:hidden p-2 rounded-lg border border-[#EAE2D8] text-[#2B1E1A] hover:bg-[#FAF8F5]"
              >
                <Menu className="w-4 h-4" />
              </button>

              {/* Health Score Ring + Mastery Rank */}
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className="relative w-10 h-10 flex items-center justify-center shrink-0"
                  title={`امتیاز سلامت کارگاه: ${summary.healthScore} از ۱۰۰`}
                >
                  <svg className="w-10 h-10 -rotate-90" viewBox="0 0 36 36">
                    <circle
                      cx="18"
                      cy="18"
                      r={radius}
                      fill="none"
                      stroke="#EFE8E0"
                      strokeWidth="3.2"
                    />
                    <circle
                      cx="18"
                      cy="18"
                      r={radius}
                      fill="none"
                      stroke={ringColor}
                      strokeWidth="3.2"
                      strokeDasharray={circumference}
                      strokeDashoffset={progressOffset}
                      strokeLinecap="round"
                    />
                  </svg>
                  <span className="absolute text-[11px] font-extrabold tabular-nums text-[#2B1E1A]">
                    {formatDigits(summary.healthScore, usePersian)}
                  </span>
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-sm text-[#2B1E1A] truncate max-w-[180px] sm:max-w-[280px]">
                      {settings.workshopName}
                    </span>
                    <HelpTip id="healthScore" />
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] text-[#7D6C63]">
                    <span className="font-semibold text-[#2D6A4F]">{summary.masteryRank}</span>
                    <span aria-hidden="true" className="hidden sm:inline">·</span>
                    <span className="hidden sm:inline">هسته ۱۰۰٪ قطعی آفلاین</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Left zone (RTL end): Utility Action Controls */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              {canUndo && (
                <button
                  type="button"
                  onClick={undoLastBulkChange}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[#EAE2D8] bg-[#FAF8F5] hover:bg-[#F1E8DD] text-xs font-semibold text-[#2B1E1A] transition-colors cursor-pointer whitespace-nowrap"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span className="hidden md:inline">بازگشت تغییر</span>
                </button>
              )}

              {/* Owner Privacy Mode Toggle */}
              <button
                type="button"
                aria-pressed={settings.privacyMode}
                aria-label="تغییر حالت حریم خصوصی مدیر"
                onClick={() => updateSettings({ privacyMode: !settings.privacyMode })}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                  settings.privacyMode
                    ? 'bg-[#2B1E1A] text-white border-[#2B1E1A]'
                    : 'bg-white text-[#2B1E1A] border-[#EAE2D8] hover:bg-[#FAF8F5]'
                }`}
              >
                {settings.privacyMode ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline">
                  {settings.privacyMode ? 'حریم خصوصی فعال' : 'حریم خصوصی'}
                </span>
              </button>

              {/* Guided Help Mode Toggle */}
              <button
                type="button"
                aria-pressed={settings.guidedLearningMode}
                aria-label="تغییر حالت راهنمای آموزشی"
                onClick={() => updateSettings({ guidedLearningMode: !settings.guidedLearningMode })}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                  settings.guidedLearningMode
                    ? 'bg-[#FFFBEB] text-[#92400E] border-[#F59E0B]'
                    : 'bg-white text-[#2B1E1A] border-[#EAE2D8] hover:bg-[#FAF8F5]'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span className="hidden md:inline">راهنمای آموزشی</span>
              </button>

              {/* Cloud Sync Quick Status */}
              <button
                type="button"
                onClick={onQuickJumpSettings}
                title="تنظیمات همگام‌سازی گوگل شیت"
                className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[#EAE2D8] bg-[#FAF8F5] hover:bg-[#F1E9DF] text-xs font-medium text-[#5A4A42] transition-colors cursor-pointer whitespace-nowrap"
              >
                <Cloud className={`w-3.5 h-3.5 ${hasCloudSync ? 'text-[#2D6A4F]' : 'text-[#9A8980]'}`} />
                <span>{hasCloudSync ? 'شیت متصل' : 'ذخیره محلی'}</span>
              </button>
            </div>
          </div>

          {/* Scenario Sandbox Banner */}
          {isSandbox && (
            <div className="mt-2.5 rounded-xl bg-[#FFFBEB] border border-[#F59E0B] px-3.5 py-2 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 text-[#92400E] font-semibold">
                <FlaskConical className="w-4 h-4 text-[#D97706] shrink-0" />
                <span>
                  در حال تست در «محیط سناریوی آزمایشی (What-If)» هستید؛ تغییرات روی داده‌های اصلی اعمال نشده است.
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={applySandboxToLive}
                  className="px-3 py-1 rounded-lg bg-[#2D6A4F] text-white font-bold hover:bg-[#23553F] cursor-pointer"
                >
                  اعمال روی کارگاه اصلی
                </button>
                <button
                  type="button"
                  onClick={discardSandbox}
                  className="px-3 py-1 rounded-lg bg-white border border-[#EAE2D8] text-[#2B1E1A] font-semibold hover:bg-[#FAF8F5] cursor-pointer"
                >
                  لغو و بازگشت
                </button>
              </div>
            </div>
          )}
        </header>

        {/* Main Workspace Canvas */}
        <main className="flex-1 p-4 lg:p-6 max-w-[1480px] w-full mx-auto">
          {children}
        </main>

        {/* Toast Notification Stack */}
        {toasts.length > 0 && (
          <div
            aria-live="polite"
            className="no-print fixed bottom-4 left-4 z-50 flex flex-col gap-2 max-w-sm w-[calc(100vw-2rem)]"
          >
            {toasts.map((t) => (
              <div
                key={t.id}
                className={`flex items-center justify-between gap-3 rounded-xl px-4 py-3 text-xs font-semibold shadow-lg border ${
                  t.tone === 'error'
                    ? 'bg-[#FEF2F2] border-[#F5C2B8] text-[#991B1B]'
                    : t.tone === 'warning'
                    ? 'bg-[#FFFBEB] border-[#F5D08A] text-[#92400E]'
                    : t.tone === 'info'
                    ? 'bg-[#EEF2FF] border-[#C7D2FE] text-[#312E81]'
                    : 'bg-[#ECFDF5] border-[#A7F3D0] text-[#065F46]'
                }`}
              >
                <div className="flex items-center gap-2">
                  {t.tone === 'success' && <Sparkles className="w-4 h-4 shrink-0" />}
                  {t.tone === 'info' && <HelpCircle className="w-4 h-4 shrink-0" />}
                  <span>{t.text}</span>
                </div>
                <button
                  type="button"
                  aria-label="بستن پیام"
                  onClick={() => dismissToast(t.id)}
                  className="opacity-70 hover:opacity-100 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
