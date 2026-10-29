import { useEffect, useState } from "react";
import {
  createSurvey,
  fetchSurveyAnalytics,
  fetchSurveyDetail,
  fetchSurveys,
  fetchSurveysSummary,
  submitSurveyResponse,
  type Survey,
  type SurveyAnalytics,
} from "../../services/api";
import { HelpCircle, ShieldCheck, Plus, Play } from "lucide-react";

export function SurveysPage() {
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [activeSurvey, setActiveSurvey] = useState<Survey | null>(null);
  const [analytics, setAnalytics] = useState<SurveyAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Answering state
  const [answers, setAnswers] = useState<Record<number, any>>({});
  const [respondentName, setRespondentName] = useState("");
  const [submissionResult, setSubmissionResult] = useState<any>(null);

  // Create Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formTitle, setFormTitle] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formType, setFormType] = useState<"climate_survey" | "exam" | "training_feedback" | "hazard_perception">("climate_survey");
  const [formAnonymous, setFormAnonymous] = useState(true);
  const [formPassScore, setFormPassScore] = useState(70);

  const loadData = () => {
    setLoading(true);
    Promise.all([fetchSurveys(), fetchSurveysSummary()])
      .then(([survList, sum]) => {
        setSurveys(survList);
        setSummary(sum);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || "خطا در دریافت آزمون‌ها و پرسشنامه‌ها");
        setLoading(false);
      });
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleStartSurvey = async (id: number) => {
    setLoading(true);
    setError(null);
    setSubmissionResult(null);
    setAnswers({});
    try {
      const detail = await fetchSurveyDetail(id);
      setActiveSurvey(detail);
      const ana = await fetchSurveyAnalytics(id);
      setAnalytics(ana);
      setLoading(false);
    } catch (err: any) {
      setError(err.message || "خطا در دریافت سوالات");
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createSurvey({
        organization: 1,
        title: formTitle,
        description: formDesc,
        survey_type: formType,
        is_anonymous: formAnonymous,
        passing_score_percentage: formPassScore,
        time_limit_minutes: 30,
      });
      setShowCreateModal(false);
      loadData();
    } catch (err: any) {
      setError(err.message || "خطا در ساخت پرسشنامه");
    }
  };

  const handleSubmitAnswers = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSurvey) return;
    try {
      const res = await submitSurveyResponse(activeSurvey.id, {
        respondent_name: activeSurvey.is_anonymous ? undefined : respondentName,
        answers: answers,
      });
      setSubmissionResult(res);
      // Reload analytics
      const ana = await fetchSurveyAnalytics(activeSurvey.id);
      setAnalytics(ana);
    } catch (err: any) {
      setError(err.message || "خطا در ثبت پاسخ‌ها");
    }
  };

  return (
    <div className="card" dir="rtl">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <HelpCircle size={28} color="#2563eb" />
          <div>
            <h2 style={{ margin: 0, fontSize: "1.5rem" }}>پرسشنامه‌ها و آزمون‌های ارزیابی HSE</h2>
            <p style={{ margin: "0.25rem 0 0", color: "#64748b", fontSize: "0.875rem" }}>
              سنجش فرهنگ ایمنی، آزمون‌های نمره‌دار دوره‌های آموزشی و بازخورد کارکنان با حفظ کامل محرمانگی
            </p>
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreateModal(true)} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Plus size={18} /> طراحی پرسشنامه / آزمون جدید
        </button>
      </div>

      {error && (
        <div style={{ padding: "0.75rem", background: "#fee2e2", color: "#b91c1c", borderRadius: "6px", marginBottom: "1rem" }}>
          {error}
        </div>
      )}

      {/* KPI Cards */}
      {summary && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
          <div style={{ padding: "1rem", background: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
            <span style={{ fontSize: "0.85rem", color: "#64748b" }}>کل پرسشنامه‌ها</span>
            <div style={{ fontSize: "1.5rem", fontWeight: "bold" }}>{summary.total}</div>
          </div>
          <div style={{ padding: "1rem", background: "#eff6ff", borderRadius: "8px", border: "1px solid #bfdbfe" }}>
            <span style={{ fontSize: "0.85rem", color: "#1e40af" }}>آزمون‌های شایستگی نمره‌دار</span>
            <div style={{ fontSize: "1.5rem", fontWeight: "bold", color: "#2563eb" }}>{summary.exams}</div>
          </div>
          <div style={{ padding: "1rem", background: "#f0fdf4", borderRadius: "8px", border: "1px solid #86efac" }}>
            <span style={{ fontSize: "0.85rem", color: "#166534" }}>پرسشنامه‌های فعال</span>
            <div style={{ fontSize: "1.5rem", fontWeight: "bold", color: "#16a34a" }}>{summary.active}</div>
          </div>
        </div>
      )}

      {/* Survey List Table */}
      {!activeSurvey ? (
        loading ? (
          <div style={{ textAlign: "center", padding: "3rem" }}>در حال بارگذاری پرسشنامه‌ها...</div>
        ) : surveys.length === 0 ? (
          <div style={{ textAlign: "center", padding: "3rem", color: "#64748b" }}>پرسشنامه‌ای ثبت نشده است.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "right" }}>
              <thead>
                <tr style={{ background: "#f1f5f9", borderBottom: "2px solid #cbd5e1" }}>
                  <th style={{ padding: "0.75rem" }}>عنوان پرسشنامه / آزمون</th>
                  <th style={{ padding: "0.75rem" }}>نوع</th>
                  <th style={{ padding: "0.75rem" }}>حالت محرمانگی</th>
                  <th style={{ padding: "0.75rem" }}>حدنصاب قبولی</th>
                  <th style={{ padding: "0.75rem" }}>وضعیت</th>
                  <th style={{ padding: "0.75rem" }}>عملیات</th>
                </tr>
              </thead>
              <tbody>
                {surveys.map((s) => (
                  <tr key={s.id} style={{ borderBottom: "1px solid #e2e8f0" }}>
                    <td style={{ padding: "0.75rem", fontWeight: "bold" }}>{s.title}</td>
                    <td style={{ padding: "0.75rem" }}>{s.survey_type_display || s.survey_type}</td>
                    <td style={{ padding: "0.75rem" }}>
                      {s.is_anonymous ? (
                        <span style={{ color: "#16a34a", display: "flex", alignItems: "center", gap: "0.3rem" }}>
                          <ShieldCheck size={16} /> ناشناس (حفظ هویت)
                        </span>
                      ) : (
                        <span style={{ color: "#475569" }}>با ثبت هویت</span>
                      )}
                    </td>
                    <td style={{ padding: "0.75rem" }}>%{s.passing_score_percentage}</td>
                    <td style={{ padding: "0.75rem" }}>
                      <span style={{
                        padding: "0.2rem 0.5rem",
                        borderRadius: "4px",
                        fontSize: "0.8rem",
                        background: s.is_active ? "#dcfce7" : "#f1f5f9",
                        color: s.is_active ? "#166534" : "#64748b",
                      }}>
                        {s.is_active ? "فعال" : "بایگانی"}
                      </span>
                    </td>
                    <td style={{ padding: "0.75rem" }}>
                      <button className="btn btn-primary" style={{ padding: "0.3rem 0.75rem", display: "flex", alignItems: "center", gap: "0.3rem" }} onClick={() => handleStartSurvey(s.id)}>
                        <Play size={14} /> شروع پاسخ‌دهی / تحلیل
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : (
        /* Active Survey View & Questions */
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
            <div>
              <h3 style={{ margin: "0 0 0.25rem" }}>{activeSurvey.title}</h3>
              <p style={{ margin: 0, color: "#64748b" }}>{activeSurvey.description}</p>
            </div>
            <button className="btn btn-secondary" onClick={() => setActiveSurvey(null)}>بازگشت به لیست</button>
          </div>

          {/* Analytics Overview for this survey */}
          {analytics && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem", marginBottom: "1.5rem" }}>
              <div style={{ padding: "0.75rem", background: "#f8fafc", borderRadius: "6px", border: "1px solid #e2e8f0" }}>
                <span style={{ fontSize: "0.8rem", color: "#64748b" }}>تعداد پاسخ‌ها</span>
                <div style={{ fontSize: "1.3rem", fontWeight: "bold" }}>{analytics.total_submissions} نفر</div>
              </div>
              <div style={{ padding: "0.75rem", background: "#f8fafc", borderRadius: "6px", border: "1px solid #e2e8f0" }}>
                <span style={{ fontSize: "0.8rem", color: "#64748b" }}>میانگین نمره / شاخص</span>
                <div style={{ fontSize: "1.3rem", fontWeight: "bold", color: "#2563eb" }}>%{analytics.avg_score_percentage}</div>
              </div>
              <div style={{ padding: "0.75rem", background: "#f8fafc", borderRadius: "6px", border: "1px solid #e2e8f0" }}>
                <span style={{ fontSize: "0.8rem", color: "#64748b" }}>درصد قبولی (Pass Rate)</span>
                <div style={{ fontSize: "1.3rem", fontWeight: "bold", color: "#16a34a" }}>%{analytics.pass_rate_percentage}</div>
              </div>
            </div>
          )}

          {/* Submission Success Box */}
          {submissionResult && (
            <div style={{ padding: "1.25rem", background: "#f0fdf4", border: "1px solid #86efac", borderRadius: "8px", marginBottom: "1.5rem" }}>
              <h4 style={{ margin: "0 0 0.5rem", color: "#166534" }}>پاسخ شما با موفقیت ثبت شد.</h4>
              {submissionResult.score_pct !== undefined && (
                <div style={{ fontSize: "1.1rem" }}>
                  نمره کسب‌شده: <strong>%{submissionResult.score_pct}</strong> - وضعیت:{" "}
                  <strong style={{ color: submissionResult.passed ? "#16a34a" : "#dc2626" }}>
                    {submissionResult.passed ? "قبول شده" : "مردود (کمتر از حدنصاب)"}
                  </strong>
                </div>
              )}
            </div>
          )}

          {/* Question Form */}
          <form onSubmit={handleSubmitAnswers} style={{ maxWidth: "700px" }}>
            {!activeSurvey.is_anonymous && (
              <div style={{ marginBottom: "1.5rem" }}>
                <label className="form-label">نام و نام خانوادگی پاسخ‌دهنده</label>
                <input
                  type="text"
                  className="form-input"
                  value={respondentName}
                  onChange={(e) => setRespondentName(e.target.value)}
                  required
                />
              </div>
            )}

            {activeSurvey.questions && activeSurvey.questions.length > 0 ? (
              activeSurvey.questions.map((q, idx) => (
                <div key={q.id} style={{ padding: "1rem", background: "#f8fafc", borderRadius: "8px", marginBottom: "1rem", border: "1px solid #e2e8f0" }}>
                  <div style={{ fontWeight: "bold", marginBottom: "0.75rem" }}>
                    {idx + 1}. {q.question_text}
                  </div>
                  {q.question_type === "multiple_choice" && q.options_json && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                      {q.options_json.map((opt, optIdx) => (
                        <label key={optIdx} style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
                          <input
                            type="radio"
                            name={`q_${q.id}`}
                            value={opt.text}
                            checked={answers[q.id] === opt.text}
                            onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
                            required
                          />
                          {opt.text}
                        </label>
                      ))}
                    </div>
                  )}
                  {q.question_type === "true_false" && (
                    <div style={{ display: "flex", gap: "1.5rem" }}>
                      <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
                        <input
                          type="radio"
                          name={`q_${q.id}`}
                          value="true"
                          checked={answers[q.id] === "true"}
                          onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
                          required
                        />
                        صحیح / بله
                      </label>
                      <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
                        <input
                          type="radio"
                          name={`q_${q.id}`}
                          value="false"
                          checked={answers[q.id] === "false"}
                          onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
                          required
                        />
                        غلط / خیر
                      </label>
                    </div>
                  )}
                  {q.question_type === "open_text" && (
                    <textarea
                      className="form-input"
                      rows={2}
                      value={answers[q.id] || ""}
                      onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
                      placeholder="پاسخ خود را بنویسید..."
                    />
                  )}
                </div>
              ))
            ) : (
              <div style={{ padding: "1.5rem", color: "#64748b", textAlign: "center" }}>سوالی برای این پرسشنامه ثبت نشده است.</div>
            )}

            <button type="submit" className="btn btn-primary" style={{ marginTop: "1rem" }}>
              ارسال پاسخ‌ها
            </button>
          </form>
        </div>
      )}

      {/* Modal: Create Survey */}
      {showCreateModal && (
        <div className="modal-overlay" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div className="card" style={{ maxWidth: "550px", width: "90%" }}>
            <h3 style={{ margin: "0 0 1rem" }}>طراحی پرسشنامه یا آزمون جدید</h3>
            <form onSubmit={handleCreate}>
              <div style={{ marginBottom: "1rem" }}>
                <label className="form-label">عنوان</label>
                <input type="text" className="form-input" value={formTitle} onChange={(e) => setFormTitle(e.target.value)} required />
              </div>
              <div style={{ marginBottom: "1rem" }}>
                <label className="form-label">توضیحات و اهداف</label>
                <textarea className="form-input" rows={2} value={formDesc} onChange={(e) => setFormDesc(e.target.value)} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
                <div>
                  <label className="form-label">نوع ارزیابی</label>
                  <select className="form-input" value={formType} onChange={(e: any) => setFormType(e.target.value)}>
                    <option value="climate_survey">سنجش جو و فرهنگ ایمنی (Climate Survey)</option>
                    <option value="exam">آزمون نمره‌دار شایستگی (Competency Exam)</option>
                    <option value="training_feedback">نظرسنجی کیفیت دوره آموزشی</option>
                    <option value="hazard_perception">ارزیابی درک خطر (Hazard Perception)</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">حدنصاب قبولی (%)</label>
                  <input type="number" className="form-input" value={formPassScore} onChange={(e) => setFormPassScore(parseInt(e.target.value) || 70)} />
                </div>
              </div>
              <div style={{ marginBottom: "1.5rem" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
                  <input type="checkbox" checked={formAnonymous} onChange={(e) => setFormAnonymous(e.target.checked)} />
                  حالت کاملاً ناشناس و بدون ثبت هویت کاربر (Anonymous Mode)
                </label>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>انصراف</button>
                <button type="submit" className="btn btn-primary">ایجاد پرسشنامه</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
