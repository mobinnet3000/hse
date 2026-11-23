import React, { useState } from "react";
import {
  HSE_20_MODULES,
  HSE_EXCHANGE_TYPES,
  type HSEModuleDefinition,
  type ExchangeType,
} from "../../../core/contracts/modulesCatalog";
import {
  ArrowRightLeft,
  Share2,
  Workflow,
  Cpu,
} from "lucide-react";

export const ModulesMatrixExplorer: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [activeModule, setActiveModule] = useState<HSEModuleDefinition | null>(HSE_20_MODULES[0]);

  const categories = [
    { id: "all", label: "همه ۲۰ ماژول" },
    { id: "core_risk", label: "مدیریت ریسک بنیادین" },
    { id: "operations", label: "عملیات و فرآیندها" },
    { id: "compliance", label: "انطباق، بازرسی و ممیزی" },
    { id: "workforce", label: "نیروی انسانی و بهداشت" },
    { id: "strategic", label: "استراتژیک و داشبورد" },
  ];

  const filteredModules = selectedCategory === "all"
    ? HSE_20_MODULES
    : HSE_20_MODULES.filter((m) => m.category === selectedCategory);

  return (
    <div className="space-y-8 rtl">
      {/* Section Header */}
      <div className="text-center max-w-3xl mx-auto space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-950/80 border border-sky-600/40 text-sky-400 text-xs font-mono font-bold">
          <Workflow className="w-3.5 h-3.5" />
          <span>ماتریس جامع ارتباطات ۲۰ ماژول اصلی HSE</span>
        </div>
        <h2 className="text-2xl md:text-3xl font-black text-slate-100">
          معماری تبادل داده، عدم افزونگی و ردیابی بلادرنگ
        </h2>
        <p className="text-xs md:text-sm text-slate-400">
          برای هر ماژول چهار رکن اصلی (ورودی، پردازش، خروجی، مقصد) و ۶ الگوی تبادل استاندارد تعریف شده است.
        </p>
      </div>

      {/* 6 Exchange Types Guide Strip */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
        {(Object.entries(HSE_EXCHANGE_TYPES) as [ExchangeType, { nameFa: string; concept: string; example: string }][]).map(
          ([key, val]) => (
            <div
              key={key}
              className="p-3 bg-slate-900/90 border border-slate-800 rounded-xl hover:border-sky-500/50 transition-colors text-right"
            >
              <span className="text-[11px] font-bold text-sky-400 block font-mono">{val.nameFa}</span>
              <p className="text-[10px] text-slate-400 mt-1 line-clamp-2 leading-relaxed">{val.concept}</p>
            </div>
          )
        )}
      </div>

      {/* Category Filter Tabs */}
      <div className="flex flex-wrap justify-center gap-2">
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              selectedCategory === cat.id
                ? "bg-sky-600 text-white shadow-lg shadow-sky-900/40 border border-sky-400/40"
                : "bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800"
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Modules Grid (Collage Paper Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {filteredModules.map((mod) => {
          const isSelected = activeModule?.id === mod.id;
          return (
            <div
              key={mod.id}
              onClick={() => setActiveModule(mod)}
              className={`paper-sheet rounded-2xl p-5 border cursor-pointer transition-all ${
                isSelected
                  ? "bg-sky-950/80 border-sky-500 ring-2 ring-sky-500/50 shadow-xl"
                  : "bg-slate-900/90 border-slate-800 hover:border-slate-700"
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <span className="w-7 h-7 rounded-lg bg-sky-900/60 border border-sky-700/60 flex items-center justify-center font-mono text-xs font-bold text-sky-300">
                  {mod.id}
                </span>
                <span className="text-[10px] text-slate-400 font-mono">{mod.nameEn}</span>
              </div>
              <h3 className="text-sm font-bold text-slate-100">{mod.nameFa}</h3>
              <p className="text-xs text-slate-400 mt-1.5 line-clamp-2 leading-relaxed">{mod.description}</p>

              <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
                <span className="text-sky-400 font-medium">۴ رکن ارتباطی</span>
                <span className="text-slate-500 font-mono">{mod.destinations.length} مقصد خروجی</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Detailed 4-Pillar Inspector for the Active Module */}
      {activeModule && (
        <div className="paper-sheet rounded-3xl p-6 md:p-8 bg-[#0b1424]/95 border border-sky-500/40 shadow-2xl relative overflow-hidden">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-800 pb-4 mb-6">
            <div className="flex items-center gap-3">
              <span className="w-10 h-10 rounded-2xl bg-sky-600/30 border border-sky-500/50 flex items-center justify-center text-sky-400 font-bold font-mono text-base">
                #{activeModule.id}
              </span>
              <div>
                <h3 className="text-lg font-black text-slate-100">
                  {activeModule.nameFa} <span className="text-xs font-normal text-slate-400 font-mono">({activeModule.nameEn})</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">{activeModule.description}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full text-xs font-mono bg-sky-900/50 border border-sky-600 text-sky-300">
                اتصال به مرجع مشترک سازمانی
              </span>
            </div>
          </div>

          {/* The 4 Pillars */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* 1. INPUT */}
            <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400 mb-2">
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  <span>۱. ورودی اطلاعات (Input)</span>
                </div>
                <div className="space-y-2">
                  {activeModule.inputs.map((inp, idx) => (
                    <div key={idx} className="p-2 rounded-lg bg-slate-900 border border-slate-800/80 text-[11px]">
                      <p className="text-slate-200 font-medium">{inp.data}</p>
                      <p className="text-[10px] text-slate-500 mt-1">مبادی: {inp.sourceModules.join("، ")}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* 2. PROCESSING */}
            <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-1.5 text-xs font-bold text-sky-400 mb-2">
                  <Cpu className="w-3.5 h-3.5" />
                  <span>۲. پردازش هسته (Processing)</span>
                </div>
                <div className="p-3 rounded-lg bg-slate-900 border border-slate-800/80 text-xs text-slate-300 leading-relaxed">
                  {activeModule.processing}
                </div>
              </div>
              <div className="mt-3 text-[10px] text-sky-500/80 font-mono">
                الگوریتم‌های محاسباتی و هوش تجاری
              </div>
            </div>

            {/* 3. OUTPUT */}
            <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400 mb-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span>۳. خروجی اطلاعات (Output)</span>
                </div>
                <div className="space-y-2">
                  {activeModule.outputs.map((out, idx) => (
                    <div key={idx} className="p-2 rounded-lg bg-slate-900 border border-slate-800/80 text-[11px]">
                      <p className="text-slate-200 font-medium">{out.data}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* 4. DESTINATION */}
            <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-1.5 text-xs font-bold text-rose-400 mb-2">
                  <Share2 className="w-3.5 h-3.5" />
                  <span>۴. مقاصد اطلاعات (Destination)</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {activeModule.destinations.map((dest, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-1 rounded-md text-[10px] bg-slate-900 border border-slate-800 text-slate-300 font-medium"
                    >
                      {dest}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Communication Rules Table */}
          {activeModule.communicationRules.length > 0 && (
            <div className="mt-6 pt-4 border-t border-slate-800">
              <h4 className="text-xs font-bold text-slate-300 mb-3 flex items-center gap-2">
                <ArrowRightLeft className="w-3.5 h-3.5 text-sky-400" />
                <span>نمونه قواعد تبادل اطلاعات با سایر ماژول‌ها:</span>
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="py-2.5 px-3">ماژول مقصد</th>
                      <th className="py-2.5 px-3">نوع تبادل</th>
                      <th className="py-2.5 px-3">شرح داده تبادلی</th>
                      <th className="py-2.5 px-3">رویداد یا تریگر آغازگر</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {activeModule.communicationRules.map((rule, idx) => (
                      <tr key={idx} className="hover:bg-slate-900/50">
                        <td className="py-2 px-3 font-bold text-slate-200">{rule.targetModuleName}</td>
                        <td className="py-2 px-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-sky-950 text-sky-300 border border-sky-800">
                            {rule.exchangeTypeDisplay}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-slate-300">{rule.dataDescription}</td>
                        <td className="py-2 px-3 text-slate-400 font-mono text-[11px]">{rule.sampleTrigger}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
