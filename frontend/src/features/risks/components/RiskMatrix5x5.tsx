import React, { useState } from "react";
import type { RiskMatrix5x5Summary } from "../../../services/api";

interface Props {
  data: RiskMatrix5x5Summary | null;
  loading: boolean;
  selectedDimension: string;
  onDimensionChange: (dim: string) => void;
  onCellClick?: (likelihood: number, severity: number, rpn: number) => void;
}

export const RiskMatrix5x5: React.FC<Props> = ({
  data,
  selectedDimension,
  onDimensionChange,
  onCellClick,
}) => {
  const [selectedCell, setSelectedCell] = useState<{ l: number; s: number } | null>(null);

  const getCellBg = (rpn: number) => {
    if (rpn <= 4) return "bg-emerald-950/60 border-emerald-600/70 text-emerald-300 hover:bg-emerald-900/70";
    if (rpn <= 9) return "bg-amber-950/60 border-amber-500/70 text-amber-300 hover:bg-amber-900/70";
    if (rpn <= 15) return "bg-orange-950/60 border-orange-500/70 text-orange-300 hover:bg-orange-900/70";
    return "bg-rose-950/70 border-rose-600/80 text-rose-300 hover:bg-rose-900/80 font-bold";
  };

  const getCellCount = (l: number, s: number) => {
    if (!data?.cells) return 0;
    const match = data.cells.find((c) => c.likelihood === l && c.severity === s);
    return match ? match.count : 0;
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 text-white rtl shadow-xl">
      {/* Header & Dimension Selector */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 pb-4 border-b border-slate-800">
        <div>
          <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <span>ماتریس شدت و احتمال ریسک (۵×۵)</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-900/60 text-blue-300 border border-blue-700/50">
              استاندارد HAER
            </span>
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            تحلیل توزیع ریسک در ابعاد چهارگانه (انسان، دارایی، محیط زیست، اعتبار) بر مبنای اصل ALARP
          </p>
        </div>

        {/* HAER Selector */}
        <div className="flex flex-wrap gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
          {[
            { id: "all", label: "همه ابعاد" },
            { id: "human", label: "انسان (H)" },
            { id: "asset", label: "دارایی (A)" },
            { id: "environment", label: "محیط زیست (E)" },
            { id: "reputation", label: "اعتبار (R)" },
            { id: "operational", label: "تداوم عملیات" },
          ].map((dim) => (
            <button
              key={dim.id}
              onClick={() => onDimensionChange(dim.id)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                selectedDimension === dim.id
                  ? "bg-blue-600 text-white shadow-md shadow-blue-900/30"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
              }`}
            >
              {dim.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="bg-emerald-950/30 border border-emerald-900/50 rounded-xl p-3 flex flex-col">
          <span className="text-[11px] text-emerald-400 font-medium">کم (پذیرفتنی)</span>
          <span className="text-2xl font-bold text-emerald-300 mt-1 font-mono">
            {data?.levels.low || 0}
          </span>
          <span className="text-[10px] text-emerald-500/70">RPN ۱ تا ۴</span>
        </div>
        <div className="bg-amber-950/30 border border-amber-900/50 rounded-xl p-3 flex flex-col">
          <span className="text-[11px] text-amber-400 font-medium">متوسط (ALARP)</span>
          <span className="text-2xl font-bold text-amber-300 mt-1 font-mono">
            {data?.levels.medium || 0}
          </span>
          <span className="text-[10px] text-amber-500/70">RPN ۵ تا ۹</span>
        </div>
        <div className="bg-orange-950/30 border border-orange-900/50 rounded-xl p-3 flex flex-col">
          <span className="text-[11px] text-orange-400 font-medium">زیاد (نامطلوب)</span>
          <span className="text-2xl font-bold text-orange-300 mt-1 font-mono">
            {data?.levels.high || 0}
          </span>
          <span className="text-[10px] text-orange-500/70">RPN ۱۰ تا ۱۵</span>
        </div>
        <div className="bg-rose-950/30 border border-rose-900/50 rounded-xl p-3 flex flex-col">
          <span className="text-[11px] text-rose-400 font-medium">بحرانی (غیرقابل‌قبول)</span>
          <span className="text-2xl font-bold text-rose-300 mt-1 font-mono">
            {data?.levels.critical || 0}
          </span>
          <span className="text-[10px] text-rose-500/70">RPN ۱۶ تا ۲۵</span>
        </div>
      </div>

      {/* 5x5 Grid */}
      <div className="relative overflow-x-auto">
        <div className="min-w-[500px]">
          <div className="grid grid-cols-6 gap-2">
            {/* Y Axis labels: Likelihood 5 down to 1 */}
            <div className="col-span-1 flex flex-col justify-between py-2 text-xs text-slate-400 font-semibold text-right pl-2">
              <span className="text-rose-400/90">۵ - بسیار محتمل</span>
              <span className="text-orange-400/90">۴ - محتمل</span>
              <span className="text-amber-400/90">۳ - ممکن</span>
              <span className="text-emerald-400/90">۲ - غیرمحتمل</span>
              <span className="text-emerald-500/90">۱ - نادر</span>
            </div>

            {/* Cells: 5 rows (Likelihood 5 -> 1) x 5 cols (Severity 1 -> 5) */}
            <div className="col-span-5 grid grid-cols-5 gap-2">
              {[5, 4, 3, 2, 1].map((l) =>
                [1, 2, 3, 4, 5].map((s) => {
                  const rpn = l * s;
                  const count = getCellCount(l, s);
                  const isSelected = selectedCell?.l === l && selectedCell?.s === s;
                  return (
                    <button
                      key={`${l}-${s}`}
                      type="button"
                      onClick={() => {
                        setSelectedCell({ l, s });
                        onCellClick?.(l, s, rpn);
                      }}
                      className={`h-16 rounded-xl border flex flex-col items-center justify-center p-1 transition-all duration-150 ${getCellBg(
                        rpn
                      )} ${isSelected ? "ring-2 ring-white scale-105 z-10" : ""}`}
                    >
                      <span className="text-xs font-mono font-bold">{rpn}</span>
                      {count > 0 ? (
                        <span className="mt-1 px-2 py-0.5 rounded-full text-[10px] bg-slate-900/90 border border-slate-700 font-bold shadow-sm">
                          {count} مورد
                        </span>
                      ) : (
                        <span className="text-[10px] opacity-40">-</span>
                      )}
                    </button>
                  );
                })
              )}
            </div>

            {/* X Axis labels: Severity 1 to 5 */}
            <div className="col-start-2 col-span-5 grid grid-cols-5 gap-2 text-center text-xs text-slate-400 mt-2 font-semibold">
              <span>۱ - ناچیز</span>
              <span>۲ - جزئی</span>
              <span>۳ - متوسط</span>
              <span>۴ - عمده</span>
              <span>۵ - فاجعه‌بار</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
