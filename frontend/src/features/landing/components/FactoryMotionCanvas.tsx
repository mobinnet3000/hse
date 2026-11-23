import React from "react";

export const FactoryMotionCanvas: React.FC = () => {
  return (
    <div className="relative w-full h-72 md:h-96 overflow-hidden rounded-3xl border border-sky-900/40 bg-[#09111e]/90 p-6 shadow-2xl flex items-center justify-center">
      {/* Blueprint Grid Lines */}
      <div className="absolute inset-0 bg-blueprint-grid opacity-60 pointer-events-none" />

      {/* Industrial Piping Network Graphic (SVG) */}
      <svg
        className="absolute inset-0 w-full h-full text-sky-500/20"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 1000 400"
        preserveAspectRatio="xMidYMid slice"
      >
        {/* Main Header Pipe */}
        <path
          d="M 50 120 L 400 120 L 400 280 L 950 280"
          fill="none"
          stroke="currentColor"
          strokeWidth="6"
          strokeDasharray="8 8"
          className="process-pipe-path"
        />
        {/* Branch Pipes */}
        <path d="M 220 120 L 220 220 L 350 220" fill="none" stroke="currentColor" strokeWidth="4" />
        <path d="M 600 280 L 600 160 L 750 160" fill="none" stroke="currentColor" strokeWidth="4" />
        <path d="M 820 280 L 820 340 L 900 340" fill="none" stroke="currentColor" strokeWidth="3" />

        {/* Flanges & Valves */}
        <circle cx="220" cy="120" r="10" fill="#0284c7" />
        <circle cx="400" cy="200" r="14" fill="#0369a1" />
        <circle cx="600" cy="220" r="12" fill="#0284c7" />
        <circle cx="750" cy="160" r="9" fill="#38bdf8" />
      </svg>

      {/* Layer 1: Refinery Silhouettes (Paper Cutout Style) */}
      <div className="absolute bottom-0 right-8 flex items-end gap-3 opacity-30 floating-layer-1 pointer-events-none">
        {/* Distillation Tower */}
        <div className="w-16 h-56 bg-slate-800 rounded-t-2xl border-t-2 border-r-2 border-l-2 border-sky-600/40 relative flex flex-col justify-between py-4 items-center">
          <div className="w-12 h-1 bg-sky-500/50" />
          <div className="w-12 h-1 bg-sky-500/50" />
          <div className="w-12 h-1 bg-sky-500/50" />
          <div className="w-12 h-1 bg-sky-500/50" />
          <span className="text-[9px] font-mono text-sky-400 rotate-90">TOWER-01</span>
        </div>
        {/* Reactor Vessel */}
        <div className="w-24 h-40 bg-slate-800/90 rounded-t-full border-2 border-slate-700 relative">
          <div className="absolute top-2 left-1/2 -translate-x-1/2 w-4 h-8 bg-slate-700" />
        </div>
      </div>

      {/* Layer 2: Moving Factory Gears (Collage Cutouts) */}
      <div className="absolute top-6 left-12 opacity-25 pointer-events-none">
        <svg className="w-28 h-28 factory-gear text-amber-500" viewBox="0 0 100 100" fill="currentColor">
          <path d="M50 35c-8.28 0-15 6.72-15 15s6.72 15 15 15 15-6.72 15-15-6.72-15-15-15zm36.5 11.5l-6.17-1.03c-.45-1.78-1.12-3.47-2-5.04l3.87-4.88c.98-1.24.84-3.03-.32-4.1l-5.66-5.66c-1.07-1.16-2.86-1.3-4.1-.32l-4.88 3.87c-1.57-.88-3.26-1.55-5.04-2l-1.03-6.17C70.92 10.02 69.47 9 67.8 9h-8c-1.67 0-3.12 1.02-3.37 2.17l-1.03 6.17c-1.78.45-3.47 1.12-5.04 2l-4.88-3.87c-1.24-.98-3.03-.84-4.1.32l-5.66 5.66c-1.16 1.07-1.3 2.86-.32 4.1l3.87 4.88c-.88 1.57-1.55 3.26-2 5.04l-6.17 1.03C30.02 36.92 29 38.37 29 40.04v8c0 1.67 1.02 3.12 2.17 3.37l6.17 1.03c.45 1.78 1.12 3.47 2 5.04l-3.87 4.88c-.98 1.24-.84 3.03.32 4.1l5.66 5.66c1.07 1.16 2.86 1.3 4.1.32l4.88-3.87c1.57.88 3.26 1.55 5.04 2l1.03 6.17c.25 1.15 1.7 2.17 3.37 2.17h8c1.67 0 3.12-1.02 3.37-2.17l1.03-6.17c1.78-.45 3.47-1.12 5.04-2l4.88 3.87c1.24.98 3.03.84 4.1-.32l5.66-5.66c1.16-1.07 1.3-2.86.32-4.1l-3.87-4.88c.88-1.57 1.55-3.26 2-5.04l6.17-1.03c1.15-.25 2.17-1.7 2.17-3.37v-8c0-1.67-1.02-3.12-2.17-3.37z" />
        </svg>
      </div>

      {/* Layer 3: Central High-Tech Monitoring Dashboard Pill (Collage Front Layer) */}
      <div className="relative z-10 paper-sheet rounded-2xl p-6 bg-slate-900/95 border border-sky-500/30 max-w-xl w-full text-right shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-emerald-500 animate-ping" />
            <span className="text-xs font-mono font-bold text-emerald-400">TELEMETRY LIVE: UNIT-100</span>
          </div>
          <span className="text-[11px] font-mono text-slate-400">FPS: 60 | ZERO DEFECT</span>
        </div>

        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800">
            <span className="text-[10px] text-slate-400 block">فشار منیفولد خط</span>
            <span className="text-lg font-bold font-mono text-sky-400 mt-1 block">12.4 BAR</span>
            <span className="text-[9px] text-emerald-400">ایمن (نرمال)</span>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800">
            <span className="text-[10px] text-slate-400 block">غلظت گاز H2S</span>
            <span className="text-lg font-bold font-mono text-emerald-400 mt-1 block">0.0 PPM</span>
            <span className="text-[9px] text-emerald-400">بدون نشت</span>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800">
            <span className="text-[10px] text-slate-400 block">پروانه‌های کار فعال</span>
            <span className="text-lg font-bold font-mono text-amber-400 mt-1 block">8 پروانه</span>
            <span className="text-[9px] text-amber-400">تحت نظارت HSE</span>
          </div>
        </div>

        {/* Dynamic Pipe Line flow */}
        <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
          <span>شبیه‌سازی خطوط پردازش و موانع کنترلی ایمنی فرآیند</span>
          <span className="font-mono text-sky-400">ISO 45001 / OSHA 1910</span>
        </div>
      </div>
    </div>
  );
};
