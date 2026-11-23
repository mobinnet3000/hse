import React from "react";
import { PaperBadge, PaperButton, PaperCard } from "../../../core/design-system/UIPrimitives";
import { FactoryMotionCanvas } from "./FactoryMotionCanvas";

interface PaperCollageHeroProps {
  onEnterPlatform?: () => void;
  onExploreMatrix?: () => void;
  onExploreRisk11Steps?: () => void;
}

export const PaperCollageHero: React.FC<PaperCollageHeroProps> = ({
  onEnterPlatform,
  onExploreMatrix,
  onExploreRisk11Steps,
}) => {
  return (
    <section className="relative overflow-hidden w-full pt-6 pb-12 md:py-16">
      {/* Background Industrial Motion Canvas with Layered Paper Styling */}
      <div className="absolute inset-0 opacity-40 pointer-events-none z-0">
        <FactoryMotionCanvas />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center text-center space-y-6">
          {/* Top Paper Badges Strip */}
          <div className="flex flex-wrap items-center justify-center gap-2">
            <PaperBadge variant="warning" size="md">
              سامانه جامع مدیریت سلامت، ایمنی و محیط زیست (HSE Guard)
            </PaperBadge>
            <PaperBadge variant="neutral" size="md">
              نسخه سازمانی ۲.۰ - فاز صفر
            </PaperBadge>
            <PaperBadge variant="success" size="md">
              معماری ۲۰ ماژول یکپارچه
            </PaperBadge>
          </div>

          {/* Main Title with Paper Texture Feel */}
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-neutral-900 tracking-tight leading-tight max-w-5xl font-farsi">
            پلتفرم هوشمند، بلادرنگ و ماتریسی{" "}
            <span className="text-amber-600 underline decoration-amber-400 decoration-wavy decoration-2">
              مدیریت یکپارچه ریسک و ایمنی فرآیند
            </span>
          </h1>

          {/* Subtitle / Value Proposition */}
          <p className="text-neutral-700 text-base sm:text-lg lg:text-xl max-w-3xl leading-relaxed">
            طراحی‌شده بر اساس تفکیک مفهومی منابع خطر، ماتریس ۴ بعدی پیامدها (HAER)،
            ردگیری زنجیره‌ای شناسه رویدادها (Traceability Chaining) و تفکیک محرمانه اطلاعات سلامت شغلی از عملیات اجرایی.
          </p>

          {/* Layered Paper Feature Cards Collage */}
          <div className="w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 text-right">
            <PaperCard className="p-4 bg-white/95 backdrop-blur-sm border-amber-300 transform -rotate-1 hover:rotate-0 transition-transform">
              <div className="text-amber-600 text-2xl mb-2">📐</div>
              <h3 className="font-bold text-neutral-900 text-sm mb-1">الگوی ۱۱ مرحله‌ای Risk Register</h3>
              <p className="text-xs text-neutral-600 leading-normal">
                پوشش از بستر ارزیابی و وظایف تا سناریو، سطوح کنترل، ارزیابی اولیه، جاری و هدف با ALARP.
              </p>
            </PaperCard>

            <PaperCard className="p-4 bg-white/95 backdrop-blur-sm border-blue-300 transform rotate-1 hover:rotate-0 transition-transform">
              <div className="text-blue-600 text-2xl mb-2">🔗</div>
              <h3 className="font-bold text-neutral-900 text-sm mb-1">ردپای ردیابی یکپارچه</h3>
              <p className="text-xs text-neutral-600 leading-normal">
                اتصال زنجیره‌ای خودکار: از گزارش ناهنجاری تا ارزیابی ریسک، مجوز کار PTW، اقدام اصلاحی و ممیزی.
              </p>
            </PaperCard>

            <PaperCard className="p-4 bg-white/95 backdrop-blur-sm border-emerald-300 transform -rotate-1 hover:rotate-0 transition-transform">
              <div className="text-emerald-600 text-2xl mb-2">🛡️</div>
              <h3 className="font-bold text-neutral-900 text-sm mb-1">حفاظت محرمانگی سلامت</h3>
              <p className="text-xs text-neutral-600 leading-normal">
                جداسازی سوابق کلینیکی و پزشکی از داده‌های عملیاتی تناسب کار (Fit-for-Work) برای حفظ حریم خصوصی.
              </p>
            </PaperCard>

            <PaperCard className="p-4 bg-white/95 backdrop-blur-sm border-purple-300 transform rotate-1 hover:rotate-0 transition-transform">
              <div className="text-purple-600 text-2xl mb-2">📊</div>
              <h3 className="font-bold text-neutral-900 text-sm mb-1">ماتریس ارتباطات ۲۰ ماژول</h3>
              <p className="text-xs text-neutral-600 leading-normal">
                تبادل داده مستقیم، خودکار، تاییدی، دوسویه، تحلیلی و اعلانی بر بستر رویدادهای سازمانی.
              </p>
            </PaperCard>
          </div>

          {/* Action CTAs */}
          <div className="flex flex-wrap items-center justify-center gap-4 pt-6">
            <PaperButton
              variant="primary"
              size="lg"
              onClick={onEnterPlatform}
              className="shadow-lg hover:shadow-xl font-bold px-8 text-base"
            >
              🚀 ورود به پلتفرم عملیاتی / داشبورد ریسک
            </PaperButton>

            <PaperButton
              variant="secondary"
              size="lg"
              onClick={onExploreMatrix}
              className="font-bold px-6 text-base"
            >
              🧭 کاوش ماتریس ۲۰ ماژول
            </PaperButton>

            <PaperButton
              variant="neutral"
              size="lg"
              onClick={onExploreRisk11Steps}
              className="font-bold px-6 text-base"
            >
              📑 شبیه‌ساز ۱۱ مرحله‌ای رجیستر
            </PaperButton>
          </div>
        </div>
      </div>
    </section>
  );
};
