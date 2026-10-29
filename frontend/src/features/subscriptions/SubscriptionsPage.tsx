import { useEffect, useState } from "react";
import {
  createSubscriptionPaymentRequest,
  fetchIntegrationsStatus,
  fetchModuleEntitlements,
  fetchOrganizationSubscription,
  fetchSubscriptionPlans,
  testIntegrationAdapter,
  type IntegrationAdapterStatus,
  type ModuleEntitlementItem,
  type OrganizationSubscriptionItem,
  type SubscriptionPlanItem,
} from "../../services/api";
import { CreditCard, RefreshCw, Radio } from "lucide-react";

export function SubscriptionsPage() {
  const [plans, setPlans] = useState<SubscriptionPlanItem[]>([]);
  const [subscription, setSubscription] = useState<OrganizationSubscriptionItem | null>(null);
  const [entitlements, setEntitlements] = useState<ModuleEntitlementItem[]>([]);
  const [integrations, setIntegrations] = useState<IntegrationAdapterStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<Record<string, any>>({});

  // Payment Form
  const [selectedPlanId, setSelectedPlanId] = useState<number | "">("");
  const [amountIrr, setAmountIrr] = useState<number>(0);
  const [paymentRef, setPaymentRef] = useState("");
  const [paymentSuccess, setPaymentSuccess] = useState<string | null>(null);

  const loadData = () => {
    setLoading(true);
    Promise.all([
      fetchSubscriptionPlans(),
      fetchOrganizationSubscription(1).catch(() => null),
      fetchModuleEntitlements(1).catch(() => []),
      fetchIntegrationsStatus().catch(() => ({ results: [] })),
    ])
      .then(([planList, sub, ents, ints]) => {
        setPlans(planList);
        setSubscription(sub);
        setEntitlements(ents);
        setIntegrations(ints.results || []);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || "خطا در دریافت اطلاعات اشتراک و ادغام‌ها");
        setLoading(false);
      });
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleTestIntegration = async (slug: string) => {
    try {
      const res = await testIntegrationAdapter(slug);
      setTestResult((prev) => ({ ...prev, [slug]: res }));
    } catch (err: any) {
      setTestResult((prev) => ({ ...prev, [slug]: { success: false, message: err.message } }));
    }
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlanId || !amountIrr || !paymentRef) return;
    try {
      const res = await createSubscriptionPaymentRequest(1, {
        plan_id: Number(selectedPlanId),
        amount_irr: amountIrr,
        payment_reference: paymentRef,
      });
      setPaymentSuccess(res.message);
      setPaymentRef("");
    } catch (err: any) {
      setError(err.message || "خطا در ثبت درخواست پرداخت");
    }
  };

  return (
    <div className="card" dir="rtl">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <CreditCard size={28} color="#2563eb" />
          <div>
            <h2 style={{ margin: 0, fontSize: "1.5rem" }}>مدیریت پلن‌ها، اشتراک و درگاه‌های یکپارچه‌سازی</h2>
            <p style={{ margin: "0.25rem 0 0", color: "#64748b", fontSize: "0.875rem" }}>
              سطوح دسترسی ماژول‌های رایگان و تجاری، فاکتورهای دوره‌ای، و وضعیت سرویس‌های خارجی (SMS, SMTP, IoT)
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div style={{ padding: "0.75rem", background: "#fee2e2", color: "#b91c1c", borderRadius: "6px", marginBottom: "1rem" }}>
          {error}
        </div>
      )}

      {loading && (
        <div style={{ padding: "1rem", textAlign: "center", color: "#64748b" }}>
          در حال بارگذاری اطلاعات اشتراک و ادغام‌ها...
        </div>
      )}

      {/* Current Subscription Status */}
      <div style={{ padding: "1.25rem", background: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0", marginBottom: "2rem" }}>
        <h3 style={{ margin: "0 0 0.75rem", fontSize: "1.1rem" }}>وضعیت اشتراک سازمان فعال</h3>
        {subscription ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem" }}>
            <div>
              <span style={{ fontSize: "0.85rem", color: "#64748b" }}>پلن فعال:</span>
              <div style={{ fontSize: "1.2rem", fontWeight: "bold", color: "#1e40af" }}>{subscription.plan_name || subscription.plan_code}</div>
            </div>
            <div>
              <span style={{ fontSize: "0.85rem", color: "#64748b" }}>اعتبار تا تاریخ:</span>
              <div style={{ fontSize: "1.2rem", fontWeight: "bold" }}>{subscription.valid_until}</div>
            </div>
            <div>
              <span style={{ fontSize: "0.85rem", color: "#64748b" }}>وضعیت دوره:</span>
              <div>
                <span style={{
                  padding: "0.2rem 0.6rem",
                  borderRadius: "12px",
                  fontSize: "0.8rem",
                  background: subscription.status === "active" ? "#dcfce7" : "#fef3c7",
                  color: subscription.status === "active" ? "#166534" : "#92400e",
                  fontWeight: "bold",
                }}>
                  {subscription.status === "active" ? "فعال و معتبر" : subscription.status}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ color: "#64748b" }}>اشتراک اختصاصی فعالی ثبت نشده است (دسترسی بر اساس پلن پایه).</div>
        )}
      </div>

      {/* Module Entitlements */}
      {entitlements.length > 0 && (
        <div style={{ marginBottom: "2rem" }}>
          <h3 style={{ margin: "0 0 1rem", fontSize: "1.1rem" }}>دسترسی ماژول‌ها و مجوزهای فعال سازمان (Entitlements)</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "0.75rem" }}>
            {entitlements.map((e) => (
              <div key={e.id} style={{ padding: "0.75rem", borderRadius: "6px", border: "1px solid #e2e8f0", background: e.is_enabled ? "#f0fdf4" : "#f8fafc" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontWeight: "bold", fontSize: "0.85rem" }}>{e.module_title || e.module_code}</span>
                  <span style={{
                    fontSize: "0.75rem",
                    padding: "0.1rem 0.4rem",
                    borderRadius: "4px",
                    background: e.is_enabled ? "#dcfce7" : "#e2e8f0",
                    color: e.is_enabled ? "#166534" : "#64748b",
                  }}>
                    {e.is_enabled ? "مجاز" : "غیرفعال"}
                  </span>
                </div>
                <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "0.25rem" }}>
                  کد ماژول: {e.module_code} {e.valid_until ? `(اعتبار تا ${e.valid_until})` : ""}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Plan Catalog */}
      <div style={{ marginBottom: "2rem" }}>
        <h3 style={{ margin: "0 0 1rem", fontSize: "1.15rem" }}>کاتالوگ پلن‌های سامانه IHMS Guard</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1rem" }}>
          {plans.map((p) => (
            <div key={p.id} style={{ padding: "1.25rem", borderRadius: "8px", border: "1px solid #cbd5e1", background: "#ffffff" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                <h4 style={{ margin: 0, fontSize: "1.1rem" }}>{p.name}</h4>
                <span style={{ fontSize: "0.8rem", background: "#eff6ff", color: "#1d4ed8", padding: "0.2rem 0.5rem", borderRadius: "4px" }}>
                  کد: {p.code}
                </span>
              </div>
              <p style={{ fontSize: "0.85rem", color: "#64748b", margin: "0 0 1rem" }}>{p.description}</p>
              <div style={{ fontSize: "1.3rem", fontWeight: "bold", color: "#0f172a", marginBottom: "1rem" }}>
                {p.price_monthly_irr === 0 ? "رایگان همیشگی" : `${(p.price_monthly_irr / 10).toLocaleString()} تومان / ماهانه`}
              </div>
              <div style={{ fontSize: "0.85rem", color: "#475569", lineHeight: "1.6" }}>
                <div>سقف کاربران: {p.max_users} کاربر</div>
                <div>سقف اماکن کاری: {p.max_workplaces} سایت</div>
                <div>ماژول‌ها: {p.included_modules.includes("all") ? "کلیه ماژول‌های سامانه" : p.included_modules.join("، ")}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Payment Request Submission Form */}
      <div style={{ padding: "1.25rem", background: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0", marginBottom: "2rem" }}>
        <h3 style={{ margin: "0 0 1rem", fontSize: "1.1rem" }}>ثبت درخواست تمدید / ارتقای اشتراک</h3>
        {paymentSuccess && (
          <div style={{ padding: "0.75rem", background: "#dcfce7", color: "#166534", borderRadius: "6px", marginBottom: "1rem" }}>
            {paymentSuccess}
          </div>
        )}
        <form onSubmit={handlePaymentSubmit} style={{ maxWidth: "600px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
            <div>
              <label className="form-label">انتخاب پلن</label>
              <select
                className="form-input"
                value={selectedPlanId}
                onChange={(e) => {
                  const id = Number(e.target.value);
                  setSelectedPlanId(id);
                  const pl = plans.find((p) => p.id === id);
                  if (pl) setAmountIrr(pl.price_monthly_irr);
                }}
                required
              >
                <option value="">(انتخاب پلن)</option>
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label">مبلغ به ریال</label>
              <input type="number" className="form-input" value={amountIrr} onChange={(e) => setAmountIrr(parseFloat(e.target.value) || 0)} required />
            </div>
          </div>
          <div style={{ marginBottom: "1.5rem" }}>
            <label className="form-label">شناسه واریز / شماره پیگیری حواله بانکی</label>
            <input type="text" className="form-input" value={paymentRef} onChange={(e) => setPaymentRef(e.target.value)} placeholder="مثلا TR-9823415" required />
          </div>
          <button type="submit" className="btn btn-primary">ثبت درخواست جهت بررسی مالی</button>
        </form>
      </div>

      {/* External Integration Adapters */}
      <div>
        <h3 style={{ margin: "0 0 1rem", fontSize: "1.15rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Radio size={20} color="#2563eb" />
          درگاه‌های ارتباطی و یکپارچه‌سازی خارجی (External Adapters)
        </h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "1rem" }}>
          {integrations.map((it) => (
            <div key={it.slug} style={{ padding: "1rem", borderRadius: "8px", border: "1px solid #e2e8f0", background: "#ffffff" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.5rem" }}>
                <h4 style={{ margin: 0, fontSize: "0.95rem" }}>{it.name}</h4>
                <span style={{
                  padding: "0.2rem 0.5rem",
                  borderRadius: "4px",
                  fontSize: "0.75rem",
                  background: it.status === "healthy" ? "#dcfce7" : "#f1f5f9",
                  color: it.status === "healthy" ? "#166534" : "#64748b",
                  fontWeight: "bold",
                }}>
                  {it.status === "healthy" ? "فعال و متصل" : "پیکربندی نشده"}
                </span>
              </div>
              <p style={{ fontSize: "0.8rem", color: "#64748b", margin: "0 0 0.75rem", lineHeight: "1.4" }}>{it.description}</p>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>کلید شناسایی: {it.slug}</span>
                <button
                  className="btn btn-secondary"
                  style={{ padding: "0.25rem 0.6rem", fontSize: "0.8rem", display: "flex", alignItems: "center", gap: "0.3rem" }}
                  onClick={() => handleTestIntegration(it.slug)}
                >
                  <RefreshCw size={12} /> آزمون اتصال
                </button>
              </div>

              {testResult[it.slug] && (
                <div style={{
                  marginTop: "0.75rem",
                  padding: "0.5rem",
                  borderRadius: "4px",
                  fontSize: "0.75rem",
                  background: testResult[it.slug].success ? "#f0fdf4" : "#fef2f2",
                  color: testResult[it.slug].success ? "#166534" : "#991b1b",
                }}>
                  {testResult[it.slug].message}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
