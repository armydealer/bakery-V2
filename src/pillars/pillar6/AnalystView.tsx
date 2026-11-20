import React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Lightbulb,
  ShieldCheck,
} from 'lucide-react';
import { useWorkshop } from '../../store/WorkshopContext';
import { formatDigits } from '../../utils/formatters';

export const AnalystView: React.FC = () => {
  const { data, offlineInsights } = useWorkshop();
  const usePersian = data.settings.usePersianDigits;

  const criticalCount = offlineInsights.filter((i) => i.severity === 'critical').length;
  const warningCount = offlineInsights.filter((i) => i.severity === 'warning').length;
  const healthyCount = offlineInsights.filter((i) => i.severity === 'healthy').length;

  return (
    <div className="space-y-5">
      {/* Deterministic Offline Core Banner */}
      <div className="rounded-xl bg-[#ECFDF5] border border-[#A7F3D0] px-4 py-3 text-xs text-[#065F46] flex items-center gap-2.5 font-semibold">
        <ShieldCheck className="w-4.5 h-4.5 text-[#2D6A4F] shrink-0" />
        <span>
          تمامی محاسبات، نمودارها، پیش‌بینی‌های علمی و تشخیص‌های راهبردی ۱۰۰٪ قطعی، قانون‌محور و آفلاین روی داده‌های واقعی کارگاه شما اجرا می‌شوند.
        </span>
      </div>

      {/* Always-On Offline Deterministic Strategic Advisor */}
      <section className="bg-white border border-[#EAE2D8] rounded-xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-extrabold text-[#2B1E1A] flex items-center gap-1.5">
              <Lightbulb className="w-4.5 h-4.5 text-[#D97706]" />
              <span>مشاور راهبردی آفلاین و قطعی (همیشه‌فعال — بدون نیاز به اینترنت)</span>
            </h2>
            <p className="text-xs text-[#7D6C63] mt-0.5">
              تشخیص‌های قانون‌محور استخراج‌شده مستقیماً از بهای تمام‌شده، گلوگاه فر، پرت نامرئی، چک‌های صیادی و شبیه‌ساز مونت‌کارلو
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold tabular-nums">
            {criticalCount > 0 && (
              <span className="px-2.5 py-1 rounded-lg bg-[#FEF2F2] border border-[#F5C2B8] text-[#991B1B]">
                {formatDigits(criticalCount, usePersian)} هشدار فوری
              </span>
            )}
            {warningCount > 0 && (
              <span className="px-2.5 py-1 rounded-lg bg-[#FFFBEB] border border-[#F5D08A] text-[#92400E]">
                {formatDigits(warningCount, usePersian)} نکته قابل بهبود
              </span>
            )}
            {healthyCount > 0 && (
              <span className="px-2.5 py-1 rounded-lg bg-[#ECFDF5] border border-[#A7F3D0] text-[#065F46]">
                {formatDigits(healthyCount, usePersian)} نقطه قوت
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {offlineInsights.map((ins) => {
            const style =
              ins.severity === 'critical'
                ? 'bg-[#FEF2F2] border-[#F5C2B8]'
                : ins.severity === 'warning'
                ? 'bg-[#FFFBEB] border-[#F5D08A]'
                : ins.severity === 'healthy'
                ? 'bg-[#ECFDF5] border-[#A7F3D0]'
                : 'bg-[#EEF2FF]/70 border-[#C7D2FE]';
            const titleColor =
              ins.severity === 'critical'
                ? 'text-[#991B1B]'
                : ins.severity === 'warning'
                ? 'text-[#92400E]'
                : ins.severity === 'healthy'
                ? 'text-[#065F46]'
                : 'text-[#312E81]';

            return (
              <div key={ins.id} className={`rounded-xl border p-4 space-y-2 ${style}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="text-[11px] font-bold text-[#6E5C54]">{ins.category}</div>
                  <div className={`text-[11px] font-extrabold tabular-nums ${titleColor}`}>
                    {ins.metric}
                  </div>
                </div>
                <div className={`text-sm font-extrabold ${titleColor} flex items-start gap-1.5`}>
                  {ins.severity === 'healthy' ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  )}
                  <span>{ins.title}</span>
                </div>
                <p className="text-xs text-[#3E302A] leading-relaxed">{ins.diagnosis}</p>
                <div className="pt-2 border-t border-black/5 text-xs font-bold text-[#2B1E1A]">
                  اقدام پیشنهادی: <span className="font-medium">{ins.action}</span>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};
