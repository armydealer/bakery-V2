import React, { useState } from 'react';
import { Activity, BarChart3, Flame, Store } from 'lucide-react';
import { GuidedBanner } from '../components/GuidedBanner';
import { CeoCockpitView } from './pillar1/CeoCockpitView';
import { CommercialCockpitView } from './pillar1/CommercialCockpitView';
import { OperationsCockpitView } from './pillar1/OperationsCockpitView';
import { ScientificLabView } from './pillar1/ScientificLabView';

type CockpitTab = 'ceo' | 'commercial' | 'operations' | 'scientific';

const TABS: Array<{
  id: CockpitTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  guide: string;
}> = [
  {
    id: 'ceo',
    label: '۱A. داشبورد مدیرعامل و سود واقعی',
    icon: BarChart3,
    guide: 'ابتدا «سود واقعی قابل برداشت» را چک کنید، سپس در بخش مهندسی معکوس، سود هدف ماه بعد خود را وارد نمایید.',
  },
  {
    id: 'commercial',
    label: '۱B. فروش، منو و اتحادیه',
    icon: Store,
    guide: 'شیرینی‌های کم‌سود و پرفروش (اسب‌های کاری) و کانال اسنپ‌فود را بررسی کنید تا نشتی حاشیه سود را ببندید.',
  },
  {
    id: 'operations',
    label: '۱C. عملیات، فر و ضایعات',
    icon: Flame,
    guide: 'محصولات صدر جدول «سود در ساعت فر» را در روزهای شلوغ اولویت پخت بدهید و ۳ قلم پارتوی خرید را کنترل کنید.',
  },
  {
    id: 'scientific',
    label: '۱D. آزمایشگاه پیش‌بینی علمی و ریسک',
    icon: Activity,
    guide: 'افق زمانی را انتخاب کنید، اسلایدر نوسان بازار را تست بزنید و با مونت‌کارلو و تورنادو ریسک کارگاه را بسنجید.',
  },
];

export const Pillar1Cockpits: React.FC = () => {
  const [activeTab, setActiveTab] = useState<CockpitTab>('ceo');
  const currentMeta = TABS.find((t) => t.id === activeTab) ?? TABS[0];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-[#2B1E1A]">
            پایلوت‌های مدیریتی و آزمایشگاه پیش‌بینی علمی
          </h1>
          <p className="text-xs text-[#7D6C63] mt-0.5">
            تمامی محاسبات مالی، مونت‌کارلو و تحلیل حساسیت ۱۰۰٪ قطعی و لحظه‌ای از داده‌های کارگاه شما تولید می‌شوند.
          </p>
        </div>
      </div>

      {/* Sub-navigation Segmented Tabs */}
      <div
        role="tablist"
        aria-label="تب‌های داشبورد مدیریتی"
        className="mb-5 flex flex-wrap gap-1.5 bg-white border border-[#EAE2D8] rounded-xl p-1.5"
      >
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={active}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                active
                  ? 'bg-[#2B1E1A] text-white'
                  : 'text-[#5A4A42] hover:bg-[#FAF8F5] hover:text-[#2B1E1A]'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      <GuidedBanner text={currentMeta.guide} />

      {activeTab === 'ceo' && <CeoCockpitView />}
      {activeTab === 'commercial' && <CommercialCockpitView />}
      {activeTab === 'operations' && <OperationsCockpitView />}
      {activeTab === 'scientific' && <ScientificLabView />}
    </div>
  );
};
