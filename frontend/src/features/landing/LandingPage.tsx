import React, { useRef } from "react";
import { PaperCollageHero } from "./components/PaperCollageHero";
import { ModulesMatrixExplorer } from "./components/ModulesMatrixExplorer";
import { ElevenStepsRiskVisualizer } from "./components/ElevenStepsRiskVisualizer";
import { PaperCard, PaperBadge, PaperButton } from "../../core/design-system/UIPrimitives";
import "./styles/paper-collage.css";

interface LandingPageProps {
  onNavigateToTab?: (tabKey: string) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onNavigateToTab }) => {
  const matrixSectionRef = useRef<HTMLDivElement>(null);
  const risk11StepsRef = useRef<HTMLDivElement>(null);

  const scrollToMatrix = () => {
    matrixSectionRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const scrollToRisk11Steps = () => {
    risk11StepsRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleEnterPlatform = () => {
    if (onNavigateToTab) {
      onNavigateToTab("register");
    }
  };

  return (
    <div className="landing-page-root min-h-screen bg-stone-100 text-neutral-800 font-farsi selection:bg-amber-200" dir="rtl">
      {/* 1. Hero Section */}
      <PaperCollageHero
        onEnterPlatform={handleEnterPlatform}
        onExploreMatrix={scrollToMatrix}
        onExploreRisk11Steps={scrollToRisk11Steps}
      />

      {/* Decorative Factory Piping Divider */}
      <div className="w-full flex items-center justify-center py-4 bg-stone-200/60 border-y border-stone-300">
        <div className="flex items-center gap-3 text-xs text-neutral-600 font-mono">
          <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>SYSTEM STATUS: OPERATIONAL</span>
          <span className="text-neutral-400">|</span>
          <span>PIPELINE TELEMETRY: ACTIVE</span>
          <span className="text-neutral-400">|</span>
          <span>TRACEABILITY ENGINE: 100% ONLINE</span>
        </div>
      </div>

      {/* 2. Eleven Steps Risk Register Framework Section */}
      <div ref={risk11StepsRef} id="risk-11-steps" className="px-4 sm:px-6 lg:px-8 py-10 bg-white/70">
        <ElevenStepsRiskVisualizer />
      </div>

      {/* 3. Twenty Modules Communication Matrix Section */}
      <div ref={matrixSectionRef} id="matrix-explorer" className="px-4 sm:px-6 lg:px-8 py-12 bg-stone-100/90 border-t border-stone-300">
        <ModulesMatrixExplorer />
      </div>

      {/* 4. Architectural Summary & System Guard Strip */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <PaperCard className="p-6 md:p-8 bg-white border-amber-300">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <PaperBadge variant="warning" size="sm">امنیت داده</PaperBadge>
                <h4 className="font-bold text-neutral-900 text-sm">حریم خصوصی داده‌های سلامت</h4>
              </div>
              <p className="text-xs text-neutral-600 leading-relaxed">
                مکانیزم <code className="text-amber-800 font-mono">HealthDataGuard</code> دسترسی به پرونده‌های بالینی را صرفاً به پزشکان مجاز طب کار محدود کرده و فقط داده‌های تناسب عملیاتی را به سایر ماژول‌ها منتشر می‌کند.
              </p>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-2">
                <PaperBadge variant="neutral" size="sm">ردیابی یکپارچه</PaperBadge>
                <h4 className="font-bold text-neutral-900 text-sm">زنجیره شناسه رویدادها</h4>
              </div>
              <p className="text-xs text-neutral-600 leading-relaxed">
                ردگیری بی‌وقفه از <code className="text-neutral-800 font-mono">INC-XXXX</code> به <code className="text-neutral-800 font-mono">RSK-XXXX</code> به <code className="text-neutral-800 font-mono">CAPA-XXXX</code> و <code className="text-neutral-800 font-mono">VER-XXXX</code> با ۶ نوع پیوند تبادلی.
              </p>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-2">
                <PaperBadge variant="success" size="sm">بستر داده پایه</PaperBadge>
                <h4 className="font-bold text-neutral-900 text-sm">مرجع واحد داده (Single Source of Truth)</h4>
              </div>
              <p className="text-xs text-neutral-600 leading-relaxed">
                استور مرکزی <code className="text-emerald-800 font-mono">SharedMasterStore</code> اشتراک اطلاعات پایه شرکت‌ها، تجهیزات، مواد، فعالیت‌ها و پرسنل را بدون تکرار تضمین می‌نماید.
              </p>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t flex flex-wrap items-center justify-between gap-4">
            <div className="text-xs text-neutral-500">
              ورود سریع با حساب ادمین پیش‌فرض: <code className="bg-neutral-100 px-1 py-0.5 rounded font-mono text-neutral-800">admin / Admin12345!</code>
            </div>
            <PaperButton
              variant="primary"
              size="sm"
              onClick={handleEnterPlatform}
            >
              شروع کار با پلتفرم عملیاتی →
            </PaperButton>
          </div>
        </PaperCard>
      </div>

      {/* Footer */}
      <footer className="w-full py-8 border-t border-stone-300 bg-stone-200/70 text-center text-xs text-neutral-600">
        <p>HSE Guard Enterprise 2.0 • طراحی معماری فاز صفر (Foundation, Design System, Matrix & Core Schema)</p>
        <p className="mt-1 text-neutral-500">طراحی شده برای صنایع نفت، گاز، پتروشیمی، نیروگاهی و ساخت‌وساز صنعتی</p>
      </footer>
    </div>
  );
};
