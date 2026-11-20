import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { HelpCircle, X } from 'lucide-react';
import { HELP_DICTIONARY } from '../data/helpDictionary';
import { useWorkshop } from '../store/WorkshopContext';

interface HelpTipProps {
  id: keyof typeof HELP_DICTIONARY | string;
  customTitle?: string;
  customSimple?: string;
  customExample?: string;
  customWhy?: string;
  size?: 'sm' | 'md';
}

export const HelpTip: React.FC<HelpTipProps> = ({
  id,
  customTitle,
  customSimple,
  customExample,
  customWhy,
  size = 'sm',
}) => {
  const { data } = useWorkshop();
  const guided = data.settings.guidedLearningMode;

  const entry = HELP_DICTIONARY[id] ?? {
    title: customTitle ?? 'راهنمای کاربردی',
    simple: customSimple ?? 'این شاخص به شما در تصمیم‌گیری دقیق‌تر مالی کارگاه کمک می‌کند.',
    example: customExample ?? 'با تغییر ورودی‌ها، اثر لحظه‌ای آن را در سود واقعی مشاهده می‌کنید.',
    why: customWhy ?? 'شفافیت مالی جلوی زیان‌های پنهان را می‌گیرد.',
  };

  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const closeTimeoutRef = useRef<number | null>(null);

  const [hovered, setHovered] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number; ready: boolean }>({
    top: 0,
    left: 0,
    ready: false,
  });

  const isOpen = hovered || pinned;

  const clearTimer = () => {
    if (closeTimeoutRef.current !== null) {
      window.clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
  };

  const computePosition = () => {
    const btn = triggerRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const popWidth = Math.min(320, window.innerWidth - 24);
    const popHeight = popoverRef.current?.offsetHeight ?? 210;
    const margin = 10;

    // Prefer opening below; flip above if near bottom viewport edge
    let top = rect.bottom + margin;
    if (top + popHeight > window.innerHeight - 12 && rect.top - popHeight - margin > 12) {
      top = rect.top - popHeight - margin;
    }
    top = Math.max(12, Math.min(top, window.innerHeight - popHeight - 12));

    // RTL-aware horizontal collision clamping (never clip left or right)
    let left = rect.right - popWidth;
    if (left < 12) {
      left = 12;
    }
    if (left + popWidth > window.innerWidth - 12) {
      left = window.innerWidth - popWidth - 12;
    }

    setCoords({ top, left, ready: true });
  };

  useLayoutEffect(() => {
    if (!isOpen) return;
    computePosition();
    const raf = window.requestAnimationFrame(computePosition);
    window.addEventListener('scroll', computePosition, true);
    window.addEventListener('resize', computePosition);
    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener('scroll', computePosition, true);
      window.removeEventListener('resize', computePosition);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!pinned) return;
    const handleOutside = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (
        triggerRef.current &&
        !triggerRef.current.contains(target) &&
        popoverRef.current &&
        !popoverRef.current.contains(target)
      ) {
        setPinned(false);
        setHovered(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPinned(false);
        setHovered(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('touchstart', handleOutside);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('touchstart', handleOutside);
      document.removeEventListener('keydown', handleKey);
    };
  }, [pinned]);

  return (
    <span className="inline-flex items-center align-middle mr-1">
      <button
        ref={triggerRef}
        type="button"
        aria-label={`راهنما: ${entry.title}`}
        aria-expanded={isOpen}
        onClick={(e) => {
          e.stopPropagation();
          setPinned((p) => !p);
        }}
        onMouseEnter={() => {
          clearTimer();
          setHovered(true);
        }}
        onMouseLeave={() => {
          clearTimer();
          closeTimeoutRef.current = window.setTimeout(() => setHovered(false), 160);
        }}
        onFocus={() => setHovered(true)}
        onBlur={() => {
          if (!pinned) setHovered(false);
        }}
        className={`inline-flex items-center justify-center rounded-full transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#2D6A4F] ${
          size === 'md' ? 'w-5 h-5' : 'w-4 h-4'
        } ${
          guided
            ? 'text-[#D97706] bg-[#FFFBEB] ring-2 ring-[#D97706]/35'
            : pinned
            ? 'text-[#2D6A4F] bg-[#ECFDF5]'
            : 'text-[#8C7B72] hover:text-[#2B1E1A] hover:bg-[#F3ECE4]'
        }`}
      >
        <HelpCircle className={size === 'md' ? 'w-4 h-4' : 'w-3.5 h-3.5'} />
      </button>

      {isOpen &&
        createPortal(
          <div
            ref={popoverRef}
            role="tooltip"
            dir="rtl"
            onMouseEnter={() => {
              clearTimer();
              setHovered(true);
            }}
            onMouseLeave={() => {
              clearTimer();
              if (!pinned) {
                closeTimeoutRef.current = window.setTimeout(() => setHovered(false), 140);
              }
            }}
            style={{
              position: 'fixed',
              top: coords.top,
              left: coords.left,
              width: Math.min(320, window.innerWidth - 24),
              zIndex: 9999,
              opacity: coords.ready ? 1 : 0,
            }}
            className="bg-white border border-[#EAE2D8] rounded-xl shadow-xl p-3.5 text-right text-xs leading-relaxed text-[#2B1E1A] transition-opacity duration-150"
          >
            <div className="flex items-start justify-between gap-2 pb-2 mb-2 border-b border-[#F2EBE2]">
              <span className="font-bold text-[#2B1E1A] text-[13px] leading-snug">
                {entry.title}
              </span>
              <button
                type="button"
                aria-label="بستن راهنما"
                onClick={() => {
                  setPinned(false);
                  setHovered(false);
                }}
                className="text-[#8C7B72] hover:text-[#2B1E1A] p-0.5 rounded cursor-pointer shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-2">
              <div>
                <span className="font-bold text-[#2D6A4F]">به زبان خیلی ساده: </span>
                <span className="text-[#3E302A]">{entry.simple}</span>
              </div>
              <div className="bg-[#FAF8F5] rounded-lg p-2 border border-[#F0E8DE]">
                <span className="font-bold text-[#D97706]">مثال در کارگاه: </span>
                <span className="text-[#4B3B34]">{entry.example}</span>
              </div>
              <div>
                <span className="font-bold text-[#4338CA]">چرا به دردتان می‌خورد؟ </span>
                <span className="text-[#3E302A]">{entry.why}</span>
              </div>
            </div>
          </div>,
          document.body
        )}
    </span>
  );
};
