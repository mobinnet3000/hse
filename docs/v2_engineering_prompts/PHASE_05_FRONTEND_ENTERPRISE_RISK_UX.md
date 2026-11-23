# پرامپت اجرایی فاز ۵: توسعه رابط کاربری فرانت‌اند، ویزارد ۱۰ مرحله‌ای و هیت‌مپ تعاملی
## PHASE 5: Enterprise Frontend UX, 10-Step Interactive Wizard & 5x5 Risk Heatmap

> **دستور برای ایجنت مجری:** در این فاز، رابط کاربری ماژول مدیریت ریسک در بخش فرانت‌اند (`frontend/src/features/risks`) با فریم‌ورک React، تایپ‌اسکریپت و Tailwind CSS به صورت کاملاً فارسی و راست‌چین (RTL) پیاده‌سازی می‌شود. فرم ۱۰ مرحله‌ای باید دارای قابلیت ذخیره پیش‌نویس (Autosave)، اعتبارسنجی با Zod و نمایش هیت‌مپ ۵×۵ تعاملی برای ۴ بُعد HAER باشد.

---

### ۱. مشخصات ایجنت و اسکیل‌های فعال
- **نقش ایجنت (Subagent Role):** `Frontend & RTL UX Engineering Specialist`
- **اسکیل‌های تخصصی مورد استفاده:**
  - `frontend`: معماری ماژولار کامپوننت‌های ری‌اکت و مدیریت رندرینگ بهینه
  - `react-patterns`: الگوهای پیشرفته کامپوزیشن، Custom Hooks و مدیریت فرم
  - `forms-validation`: استفاده از `react-hook-form` و اسکیماهای `zod` برای فرم‌های پیچیده چندمرحله‌ای
  - `tailwind-ui`: استایل‌دهی استاندارد، پالت‌های رنگی ریسک (سبز، زرد، نارنجی، قرمز) و فونت‌های استاندارد فارسی
  - `ui-design` و `ux-design`: طراحی رابط کاربری غنی صنعتی با دسترسی سریع به اطلاعات (High Information Density)
  - `ask-sonner`: نمایش توست‌ها و هشدارهای عملیاتی بلادرنگ

---

### ۲. ساختار صفحات و کامپوننت‌های فرانت‌اند (`frontend/src/features/risks/`)

```
frontend/src/features/risks/
├── components/
│   ├── wizard/
│   │   ├── RiskWizardContainer.tsx       <-- کانتینر اصلی ویزارد ۱۰ مرحله‌ای با نوار پیشرفت
│   │   ├── Step1Context.tsx               <-- مرحله ۱: اطلاعات سازمانی و محدوده ارزیابی
│   │   ├── Step2ActivityTasks.tsx         <-- مرحله ۲: فعالیت، وظایف و مراحل کار (Job Steps)
│   │   ├── Step3HazardIdentification.tsx  <-- مرحله ۳: منابع خطر در ۴ حوزه اصلی
│   │   ├── Step4ScenarioBuilder.tsx       <-- مرحله ۴: سناریوی رویداد ناخواسته و مسیر مواجهه
│   │   ├── Step5Consequences.tsx          <-- مرحله ۵: پیامدهای ۴ گانه (HAER)
│   │   ├── Step6ExistingControls.tsx      <-- مرحله ۶: کنترل‌های موجود و سلسله‌مراتب کنترل
│   │   ├── Step7InitialAssessment.tsx     <-- مرحله ۷: ارزیابی اولیه در ماتریس ۵×۵
│   │   ├── Step8CurrentAssessment.tsx     <-- مرحله ۸: ارزیابی ریسک با کنترل‌های موجود
│   │   ├── Step9RiskTreatment.tsx         <-- مرحله ۹: تعیین اقدامات اصلاحی و ارجاع به CAPA
│   │   └── Step10ResidualAndApproval.tsx  <-- مرحله ۱۰: ریسک باقیمانده، هدف و تأیید نهایی
│   ├── heatmap/
│   │   ├── RiskMatrix5x5.tsx              <-- ماتریس تعاملی ۵×۵ با فیلتر ابعاد HAER
│   │   └── RiskCellDetailModal.tsx        <-- مودال نمایش سناریوهای قرارگرفته در هر خانه ماتریس
│   ├── traceability/
│   │   └── TraceabilityBreadcrumb.tsx     <-- نمایش زنجیره: حادثه -> ریسک -> اقدام -> راستی‌آزمایی
│   └── RiskRegisterTable.tsx              <-- جدول جامع رجیستر ریسک با فیلترهای پیشرفته
├── hooks/
│   ├── useRiskRegister.ts
│   └── useRiskCalculator.ts               <-- محاسبه بلادرنگ RPN و سطح ریسک در سمت کلاینت
├── types/
│   └── risk.types.ts
└── RiskRegisterPage.tsx
```

---

### ۳. پیاده‌سازی ماتریس تعاملی ۵×۵ در `frontend/src/features/risks/components/heatmap/RiskMatrix5x5.tsx`

```tsx
import React, { useState } from 'react';

interface MatrixProps {
  scores: Array<{
    scenarioId: string;
    title: string;
    likelihood: number; // 1 to 5
    severity: number;   // 1 to 5
    dimension: 'human' | 'asset' | 'environment' | 'reputation';
  }>;
  onSelectCell?: (likelihood: number, severity: number) => void;
}

export const RiskMatrix5x5: React.FC<MatrixProps> = ({ scores, onSelectCell }) => {
  const [selectedDimension, setSelectedDimension] = useState<string>('all');

  const filteredScores = selectedDimension === 'all' 
    ? scores 
    : scores.filter(s => s.dimension === selectedDimension);

  const getCellColor = (l: number, s: number) => {
    const rpn = l * s;
    if (rpn <= 4) return 'bg-emerald-500/20 border-emerald-500 text-emerald-400 hover:bg-emerald-500/30';
    if (rpn <= 9) return 'bg-amber-500/20 border-amber-500 text-amber-400 hover:bg-amber-500/30';
    if (rpn <= 15) return 'bg-orange-500/20 border-orange-500 text-orange-400 hover:bg-orange-500/30';
    return 'bg-rose-500/20 border-rose-500 text-rose-400 hover:bg-rose-500/30 font-bold';
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-white rtl">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="text-lg font-bold text-slate-100">ماتریس شدت و احتمال ریسک (۵×۵)</h3>
          <p className="text-xs text-slate-400 mt-1">توزیع سناریوهای ریسک در ابعاد ۴ گانه HAER</p>
        </div>
        {/* فیلتر ابعاد HAER */}
        <div className="flex gap-2">
          {[
            { id: 'all', label: 'همه ابعاد' },
            { id: 'human', label: 'انسان (H)' },
            { id: 'asset', label: 'دارایی (A)' },
            { id: 'environment', label: 'محیط زیست (E)' },
            { id: 'reputation', label: 'اعتبار (R)' },
          ].map(dim => (
            <button
              key={dim.id}
              onClick={() => setSelectedDimension(dim.id)}
              className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${
                selectedDimension === dim.id 
                  ? 'bg-blue-600 text-white font-medium' 
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {dim.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-6 gap-2">
        {/* محور عمودی: احتمال (Likelihood 5 -> 1) */}
        <div className="col-span-1 flex flex-col justify-between py-4 text-xs text-slate-400 font-semibold">
          <span>۵ - بسیار محتمل</span>
          <span>۴ - محتمل</span>
          <span>۳ - ممکن</span>
          <span>۲ - غیرمحتمل</span>
          <span>۱ - بسیار نادر</span>
        </div>

        {/* خانه‌های ماتریس ۵×۵ */}
        <div className="col-span-5 grid grid-cols-5 gap-2">
          {[5, 4, 3, 2, 1].map(l =>
            [1, 2, 3, 4, 5].map(s => {
              const count = filteredScores.filter(item => item.likelihood === l && item.severity === s).length;
              return (
                <div
                  key={`${l}-${s}`}
                  onClick={() => onSelectCell && onSelectCell(l, s)}
                  className={`h-14 border rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all duration-150 ${getCellColor(l, s)}`}
                >
                  <span className="text-xs font-mono">{l * s}</span>
                  {count > 0 && (
                    <span className="mt-1 px-2 py-0.5 rounded-full text-[10px] bg-slate-900/80 font-bold">
                      {count} مورد
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* محور افقی: شدت (Severity 1 -> 5) */}
        <div className="col-start-2 col-span-5 grid grid-cols-5 gap-2 text-center text-xs text-slate-400 mt-2 font-semibold">
          <span>۱ - ناچیز</span>
          <span>۲ - جزیی</span>
          <span>۳ - متوسط</span>
          <span>۴ - عمده</span>
          <span>۵ - فاجعه‌بار</span>
        </div>
      </div>
    </div>
  );
};
```

---

### ۴. کامپوننت زنجیره ردیابی در `frontend/src/features/risks/components/traceability/TraceabilityBreadcrumb.tsx`

```tsx
import React from 'react';
import { ArrowLeft, ShieldAlert, AlertTriangle, CheckCircle, FileText } from 'lucide-react';

interface TraceStep {
  module: 'incident' | 'risk' | 'capa' | 'verification';
  id: string;
  label: string;
  status: string;
}

export const TraceabilityBreadcrumb: React.FC<{ chain: TraceStep[] }> = ({ chain }) => {
  return (
    <div className="flex items-center gap-3 bg-slate-800/60 p-3 rounded-xl border border-slate-700/60 rtl overflow-x-auto">
      <span className="text-xs text-slate-400 font-medium">زنجیره ردیابی:</span>
      {chain.map((step, index) => (
        <React.Fragment key={step.id}>
          <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-900 border border-slate-700 rounded-lg text-xs">
            {step.module === 'incident' && <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />}
            {step.module === 'risk' && <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />}
            {step.module === 'capa' && <FileText className="w-3.5 h-3.5 text-blue-400" />}
            {step.module === 'verification' && <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />}
            <span className="text-slate-200 font-mono">{step.id}</span>
            <span className="text-slate-400 text-[10px]">({step.label})</span>
          </div>
          {index < chain.length - 1 && <ArrowLeft className="w-3.5 h-3.5 text-slate-500" />}
        </React.Fragment>
      ))}
    </div>
  );
};
```

---

### ۵. اقدامات اعتبارسنجی
1. اعتبارسنجی RTL با تست ورودی‌های چندزبانه و فونت‌های فارسی.
2. تست عملکرد Autosave در حافظه موقت (LocalStorage یا Draft API) تا در صورت بسته شدن صفحه اطلاعات پاک نشود.
3. اجرای بیلد فرانت‌اند با `npm run build` جهت اطمینان از صحت تایپ‌ها و عدم وجود خطای کامپایل.
