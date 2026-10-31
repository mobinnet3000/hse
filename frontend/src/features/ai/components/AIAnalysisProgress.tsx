import React, { useEffect, useState } from "react";
import { Sparkles, Loader2, CheckCircle2, Server, ShieldAlert, Cpu } from "lucide-react";

interface AIAnalysisProgressProps {
  title: string;
  modelName?: string;
  endpointUrl?: string;
}

export const AIAnalysisProgress: React.FC<AIAnalysisProgressProps> = ({
  title,
  modelName = "deepseek-v4.1-flash",
  endpointUrl = "https://api.avalai.ir/v1/chat/completions",
}) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [elapsedSeconds, setElapsedSeconds] = useState(0.0);

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedSeconds((prev) => +(prev + 0.1).toFixed(1));
    }, 100);

    const t1 = setTimeout(() => setCurrentStep(2), 1200);
    const t2 = setTimeout(() => setCurrentStep(3), 2600);
    const t3 = setTimeout(() => setCurrentStep(4), 4200);
    const t4 = setTimeout(() => setCurrentStep(5), 5800);

    return () => {
      clearInterval(timer);
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, []);

  const steps = [
    {
      num: 1,
      title: "ساختاربندی و اعتبارسنجی داده‌های کارگاه",
      desc: "تبدیل اطلاعات فرم ۹ گانه به پی‌لود استاندارد JSON و اعمال فرضیات مهندسی",
    },
    {
      num: 2,
      title: "برقراری ارتباط امن با سرور AvalAI",
      desc: `ارسال درخواست HTTPS به اندپوینت ${endpointUrl} با مدل ${modelName}`,
    },
    {
      num: 3,
      title: "استخراج و تحلیل عمیق مخاطرات تخصصی",
      desc: "تحلیل الگوهای ریسک با استانداردهای بین‌المللی ISO 45001 و مقررات ملی کار",
    },
    {
      num: 4,
      title: "محاسبه ماتریس ریسک ۵×۵ و پیامدها",
      desc: "وزن‌دهی ریاضی به احتمال و شدت رخدادها و تدوین تدابیر کنترلی سلسله‌مراتبی",
    },
    {
      num: 5,
      title: "تولید هوشمند پیش‌نویس چک‌لیست بازرسی",
      desc: "فرمول‌بندی معیارهای پذیرش شفاف، نوع پاسخ‌ها و الزامات شواهد بازرسی",
    },
  ];

  return (
    <div
      className="bg-white rounded-3xl p-8 md:p-10 border border-slate-200 shadow-xl max-w-2xl mx-auto text-center"
      dir="rtl"
      style={{
        boxShadow: "0 20px 40px -15px rgba(79, 70, 229, 0.12)",
      }}
    >
      {/* High-tech Glowing Neural Radar Icon */}
      <div className="relative w-20 h-20 mx-auto mb-6">
        <div className="absolute inset-0 rounded-full bg-indigo-500/20 animate-ping" />
        <div className="absolute -inset-2 rounded-full bg-indigo-500/10 animate-pulse" />
        <div className="relative w-20 h-20 rounded-2xl bg-gradient-to-tr from-indigo-700 via-indigo-600 to-indigo-500 text-white flex items-center justify-center shadow-xl shadow-indigo-600/30">
          <Cpu className="w-10 h-10 animate-pulse text-indigo-100" />
        </div>
      </div>

      {/* Live Badge & Stopwatch */}
      <div className="flex flex-wrap items-center justify-center gap-2 mb-3">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
          <Sparkles className="w-3.5 h-3.5 text-indigo-500 animate-spin" />
          در حال پردازش در شبکه عصبی AvalAI
        </span>

        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-mono font-bold bg-slate-900 text-emerald-400 border border-slate-800">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
          زمان سپری‌شده: {elapsedSeconds.toLocaleString("fa-IR")}s
        </span>
      </div>

      <h3 className="text-lg md:text-xl font-black text-slate-900 mb-2">
        در حال تحلیل چندلایه مخاطرات و تدوین چک‌لیست...
      </h3>

      <p className="text-xs text-slate-600 mb-6 max-w-lg mx-auto leading-relaxed">
        اطلاعات جامع محیط کار برای «<strong className="text-slate-900 font-bold">{title}</strong>» جهت پردازش هوشمند به شبکه ارسال شده است.
      </p>

      {/* Connection Info Strip */}
      <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 text-xs text-slate-600 flex flex-wrap items-center justify-between gap-2 mb-6">
        <div className="flex items-center gap-2">
          <Server className="w-4 h-4 text-indigo-600" />
          <span>سرور پردازش:</span>
          <code className="text-[11px] font-mono text-indigo-700 font-bold">api.avalai.ir</code>
        </div>
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-emerald-600" />
          <span>مدل تحلیلی:</span>
          <span className="font-bold text-slate-800">{modelName}</span>
        </div>
      </div>

      {/* Steps List */}
      <div className="space-y-3 text-right max-w-lg mx-auto">
        {steps.map((s) => {
          const isDone = currentStep > s.num;
          const isCurrent = currentStep === s.num;

          return (
            <div
              key={s.num}
              className={`flex items-start gap-3 p-3.5 rounded-2xl border transition-all ${
                isCurrent
                  ? "bg-indigo-50/90 border-indigo-300 text-indigo-950 shadow-sm ring-1 ring-indigo-200"
                  : isDone
                  ? "bg-emerald-50/60 border-emerald-200 text-emerald-950"
                  : "bg-white border-slate-100 text-slate-400 opacity-60"
              }`}
            >
              <div className="shrink-0 mt-0.5">
                {isDone ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                ) : isCurrent ? (
                  <Loader2 className="w-5 h-5 text-indigo-600 animate-spin" />
                ) : (
                  <div className="w-5 h-5 rounded-full border-2 border-slate-300 flex items-center justify-center text-[10px] font-bold text-slate-400">
                    {s.num}
                  </div>
                )}
              </div>
              <div className="flex-1 space-y-0.5">
                <div className="text-xs font-bold">{s.title}</div>
                <div className="text-[11px] opacity-80 leading-normal">{s.desc}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
