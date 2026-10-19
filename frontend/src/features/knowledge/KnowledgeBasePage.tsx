import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "../auth/AuthContext";
import {
  ApiRequestError,
  createKnowledgeSource,
  deleteKnowledgeSource,
  fetchKnowledgeSources,
  fetchOrganizations,
  type KnowledgeSource,
  type Organization,
} from "../../services/api";

function errorMessage(error: unknown) {
  return error instanceof ApiRequestError ? error.message : "خطای نامشخص در ارتباط با سرور";
}

const CATEGORY_LABELS: Record<string, string> = {
  regulation: "آیین‌نامه و مقررات دولتی",
  standard: "استاندارد ملی / بین‌المللی",
  law: "قانون مصوب",
  internal_procedure: "دستورالعمل درون‌سازمانی",
  guideline: "راهنما و خط‌مشی",
};

export function KnowledgeBasePage() {
  const { user } = useAuth();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [organizationId, setOrganizationId] = useState<number | null>(null);

  const [sources, setSources] = useState<KnowledgeSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [scopeFilter, setScopeFilter] = useState("all");

  // Expanded card
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    code: "",
    category: "regulation" as KnowledgeSource["category"],
    issuing_authority: "",
    version: "1.0",
    summary: "",
    content: "",
    tags: "",
    is_global: false,
  });

  useEffect(() => {
    const controller = new AbortController();
    fetchOrganizations(controller.signal)
      .then((items) => {
        setOrganizations(items);
        if (items.length > 0) setOrganizationId(items[0].id);
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);

  const loadSources = () => {
    setLoading(true);
    setError(null);
    const controller = new AbortController();

    const params: { category?: string; organization?: string; search?: string } = {};
    if (categoryFilter) params.category = categoryFilter;
    if (search.trim()) params.search = search.trim();
    if (scopeFilter === "global") {
      params.organization = "global";
    } else if (scopeFilter === "org" && organizationId) {
      params.organization = String(organizationId);
    }

    fetchKnowledgeSources(params, controller.signal)
      .then((items) => {
        setSources(Array.isArray(items) ? items : []);
        setLoading(false);
      })
      .catch((err) => {
        if (err.name !== "AbortError") {
          setError(errorMessage(err));
          setLoading(false);
        }
      });

    return () => controller.abort();
  };

  useEffect(() => {
    const cancel = loadSources();
    return () => {
      if (cancel) cancel();
    };
  }, [categoryFilter, scopeFilter, organizationId]);

  const handleSearchSubmit = (e: FormEvent) => {
    e.preventDefault();
    loadSources();
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("آیا از حذف این منبع اطمینان دارید؟")) return;
    try {
      await deleteKnowledgeSource(id);
      setSources((prev) => prev.filter((s) => s.id !== id));
    } catch (err) {
      alert(errorMessage(err));
    }
  };

  const handleCreateSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setModalError(null);

    const payload: Partial<KnowledgeSource> = {
      title: formData.title.trim(),
      code: formData.code.trim(),
      category: formData.category,
      issuing_authority: formData.issuing_authority.trim(),
      version: formData.version.trim() || "1.0",
      summary: formData.summary.trim(),
      content: formData.content.trim(),
      tags: formData.tags.trim(),
      organization: formData.is_global ? null : (organizationId ?? null),
    };

    try {
      const created = await createKnowledgeSource(payload);
      setSources((prev) => [created, ...prev]);
      setIsModalOpen(false);
      setFormData({
        title: "",
        code: "",
        category: "regulation",
        issuing_authority: "",
        version: "1.0",
        summary: "",
        content: "",
        tags: "",
        is_global: false,
      });
    } catch (err) {
      setModalError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="knowledge-page stack" dir="rtl" style={{ display: "grid", gap: "1.5rem" }}>
      <header className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h2>پایگاه دانش و مقررات HSE</h2>
          <p className="muted" style={{ fontSize: "0.85rem", marginTop: "0.25rem" }}>
            مخزن جامع آیین‌نامه‌ها، استانداردهای ملی و دستورالعمل‌های معتبر حفاظت فنی
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          style={{
            backgroundColor: "var(--primary, #0f6b57)",
            color: "#fff",
            border: "none",
            borderRadius: "6px",
            padding: "0.5rem 1rem",
            cursor: "pointer",
            fontWeight: "bold",
          }}
        >
          + ثبت منبع جدید
        </button>
      </header>

      {/* Summary statistics */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "1rem" }}>
        <div className="card" style={{ padding: "1rem" }}>
          <span className="muted" style={{ fontSize: "0.8rem" }}>کل منابع بارگذاری‌شده</span>
          <strong style={{ display: "block", fontSize: "1.4rem", marginTop: "0.25rem" }}>{sources.length}</strong>
        </div>
        <div className="card" style={{ padding: "1rem" }}>
          <span className="muted" style={{ fontSize: "0.8rem" }}>آیین‌نامه‌های حفاظت فنی</span>
          <strong style={{ display: "block", fontSize: "1.4rem", marginTop: "0.25rem", color: "var(--primary, #0f6b57)" }}>
            {sources.filter((s) => s.category === "regulation").length}
          </strong>
        </div>
        <div className="card" style={{ padding: "1rem" }}>
          <span className="muted" style={{ fontSize: "0.8rem" }}>استانداردهای ملی / ISO</span>
          <strong style={{ display: "block", fontSize: "1.4rem", marginTop: "0.25rem", color: "#166534" }}>
            {sources.filter((s) => s.category === "standard").length}
          </strong>
        </div>
        <div className="card" style={{ padding: "1rem" }}>
          <span className="muted" style={{ fontSize: "0.8rem" }}>دستورالعمل‌های سازمانی</span>
          <strong style={{ display: "block", fontSize: "1.4rem", marginTop: "0.25rem", color: "#9a3412" }}>
            {sources.filter((s) => s.category === "internal_procedure").length}
          </strong>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="card" style={{ padding: "1.25rem" }}>
        <form onSubmit={handleSearchSubmit} style={{ display: "flex", gap: "0.75rem", marginBottom: "1rem" }}>
          <input
            type="text"
            placeholder="جستجو در عنوان، کد استاندارد، برچسب‌ها یا متن مواد قانونی..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              flex: 1,
              padding: "0.5rem 0.75rem",
              borderRadius: "6px",
              border: "1px solid var(--border, #d9e0e7)",
              font: "inherit",
            }}
          />
          <button
            type="submit"
            style={{
              padding: "0.5rem 1.25rem",
              borderRadius: "6px",
              border: "1px solid var(--border, #d9e0e7)",
              backgroundColor: "var(--surface, #fff)",
              cursor: "pointer",
            }}
          >
            جستجو
          </button>
        </form>

        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "1rem", borderTop: "1px solid var(--border, #d9e0e7)", paddingTop: "0.75rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <label style={{ fontSize: "0.85rem", color: "var(--muted, #5b6b7a)" }}>دسته‌بندی:</label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              style={{ padding: "0.35rem 0.6rem", borderRadius: "6px", border: "1px solid var(--border, #d9e0e7)" }}
            >
              <option value="">همه دسته‌ها</option>
              {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <label style={{ fontSize: "0.85rem", color: "var(--muted, #5b6b7a)" }}>محدوده منابع:</label>
            <select
              value={scopeFilter}
              onChange={(e) => setScopeFilter(e.target.value)}
              style={{ padding: "0.35rem 0.6rem", borderRadius: "6px", border: "1px solid var(--border, #d9e0e7)" }}
            >
              <option value="all">همه منابع در دسترس</option>
              <option value="global">فقط قوانین و استانداردهای سراسری و ملی</option>
              <option value="org">دستورالعمل‌های اختصاصی سازمان</option>
            </select>
          </div>

          {organizations.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <label style={{ fontSize: "0.85rem", color: "var(--muted, #5b6b7a)" }}>سازمان انتخابی:</label>
              <select
                value={organizationId ?? ""}
                onChange={(e) => setOrganizationId(Number(e.target.value))}
                style={{ padding: "0.35rem 0.6rem", borderRadius: "6px", border: "1px solid var(--border, #d9e0e7)" }}
              >
                {organizations.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Content states */}
      {loading ? (
        <p className="muted" style={{ textAlign: "center", padding: "2rem" }}>در حال بارگذاری پایگاه دانش...</p>
      ) : error ? (
        <div className="alert alert-error">{error}</div>
      ) : sources.length === 0 ? (
        <div className="card" style={{ padding: "2.5rem", textAlign: "center" }}>
          <p className="muted">هیچ منبع دانشی با فیلترهای انتخابی یافت نشد.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: "1rem" }}>
          {sources.map((item) => {
            const isExpanded = expandedId === item.id;
            return (
              <div key={item.id} className="card" style={{ padding: "1.25rem", maxWidth: "100%" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem" }}>
                  <div style={{ display: "grid", gap: "0.35rem" }}>
                    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.5rem" }}>
                      <span
                        style={{
                          backgroundColor: "var(--primary-soft, #e3f2ee)",
                          color: "var(--primary, #0f6b57)",
                          padding: "0.15rem 0.45rem",
                          borderRadius: "4px",
                          fontSize: "0.75rem",
                          fontWeight: "bold",
                        }}
                      >
                        {item.code}
                      </span>
                      <span style={{ fontSize: "0.75rem", color: "var(--muted, #5b6b7a)" }}>
                        {item.category_display || CATEGORY_LABELS[item.category] || item.category}
                      </span>
                      {item.is_verified && (
                        <span
                          style={{
                            backgroundColor: "#dcfce7",
                            color: "#166534",
                            padding: "0.15rem 0.45rem",
                            borderRadius: "4px",
                            fontSize: "0.75rem",
                          }}
                        >
                          ✓ معتبر و لازم‌الاجرا
                        </span>
                      )}
                      {item.organization_name ? (
                        <span
                          style={{
                            backgroundColor: "#ffedd5",
                            color: "#9a3412",
                            padding: "0.15rem 0.45rem",
                            borderRadius: "4px",
                            fontSize: "0.75rem",
                          }}
                        >
                          سازمان: {item.organization_name}
                        </span>
                      ) : (
                        <span
                          style={{
                            backgroundColor: "#e0f2fe",
                            color: "#0369a1",
                            padding: "0.15rem 0.45rem",
                            borderRadius: "4px",
                            fontSize: "0.75rem",
                          }}
                        >
                          سراسری / ملی
                        </span>
                      )}
                    </div>

                    <h3 style={{ margin: "0.25rem 0 0", fontSize: "1.05rem" }}>{item.title}</h3>

                    {item.issuing_authority && (
                      <p className="muted" style={{ fontSize: "0.8rem", margin: 0 }}>
                        مرجع تصویب / انتشار: <strong>{item.issuing_authority}</strong>
                        {item.effective_date && ` • تاریخ اجرا: ${item.effective_date}`}
                        {item.version && ` • نسخه: ${item.version}`}
                      </p>
                    )}
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    {item.can_edit && (
                      <button
                        type="button"
                        onClick={() => handleDelete(item.id)}
                        style={{
                          background: "none",
                          border: "none",
                          color: "var(--danger, #b3261e)",
                          cursor: "pointer",
                          fontSize: "0.8rem",
                        }}
                      >
                        حذف
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setExpandedId(isExpanded ? null : item.id)}
                      style={{
                        padding: "0.35rem 0.75rem",
                        borderRadius: "6px",
                        border: "1px solid var(--border, #d9e0e7)",
                        backgroundColor: "var(--surface, #fff)",
                        fontSize: "0.8rem",
                        cursor: "pointer",
                      }}
                    >
                      {isExpanded ? "بستن متن کامل" : "مشاهده متن کامل"}
                    </button>
                  </div>
                </div>

                {item.summary && (
                  <p style={{ fontSize: "0.88rem", marginTop: "0.75rem", borderTop: "1px solid var(--border, #d9e0e7)", paddingTop: "0.6rem" }}>
                    {item.summary}
                  </p>
                )}

                {item.tags && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem", marginTop: "0.5rem" }}>
                    {item.tags.split(",").map((t, idx) => (
                      <span
                        key={idx}
                        style={{
                          backgroundColor: "var(--bg, #f4f6f8)",
                          color: "var(--muted, #5b6b7a)",
                          padding: "0.1rem 0.4rem",
                          borderRadius: "4px",
                          fontSize: "0.7rem",
                        }}
                      >
                        #{t.trim()}
                      </span>
                    ))}
                  </div>
                )}

                {isExpanded && (
                  <div
                    style={{
                      marginTop: "1rem",
                      padding: "1rem",
                      borderRadius: "6px",
                      backgroundColor: "var(--bg, #f4f6f8)",
                      border: "1px solid var(--border, #d9e0e7)",
                    }}
                  >
                    <h4 style={{ margin: "0 0 0.5rem", fontSize: "0.85rem" }}>متن و الزامات کلیدی استاندارد / آیین‌نامه:</h4>
                    <pre
                      style={{
                        margin: 0,
                        whiteSpace: "pre-wrap",
                        fontFamily: "inherit",
                        fontSize: "0.82rem",
                        lineHeight: "1.8",
                      }}
                    >
                      {item.content}
                    </pre>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create Modal */}
      {isModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
            display: "grid",
            placeItems: "center",
            padding: "1rem",
            zIndex: 100,
          }}
        >
          <div
            className="card"
            style={{
              width: "min(600px, 100%)",
              maxHeight: "90vh",
              overflowY: "auto",
              padding: "1.5rem",
              background: "#fff",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h3 style={{ margin: 0, fontSize: "1.1rem" }}>ثبت منبع / آیین‌نامه جدید</h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                style={{ background: "none", border: "none", fontSize: "1.2rem", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>

            {modalError && <div className="alert alert-error" style={{ marginBottom: "1rem" }}>{modalError}</div>}

            <form onSubmit={handleCreateSubmit} style={{ display: "grid", gap: "0.85rem" }}>
              <div>
                <label htmlFor="source-title" style={{ display: "block", fontSize: "0.85rem", marginBottom: "0.25rem" }}>
                  عنوان استاندارد یا دستورالعمل *
                </label>
                <input
                  id="source-title"
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  style={{ width: "100%", padding: "0.5rem", borderRadius: "6px", border: "1px solid var(--border, #d9e0e7)" }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <div>
                  <label htmlFor="source-code" style={{ display: "block", fontSize: "0.85rem", marginBottom: "0.25rem" }}>کد یا شناسه استاندارد *</label>
                  <input
                    id="source-code"
                    type="text"
                    required
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    style={{ width: "100%", padding: "0.5rem", borderRadius: "6px", border: "1px solid var(--border, #d9e0e7)" }}
                  />
                </div>
                <div>
                  <label htmlFor="source-category" style={{ display: "block", fontSize: "0.85rem", marginBottom: "0.25rem" }}>دسته‌بندی *</label>
                  <select
                    id="source-category"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value as KnowledgeSource["category"] })}
                    style={{ width: "100%", padding: "0.5rem", borderRadius: "6px", border: "1px solid var(--border, #d9e0e7)" }}
                  >
                    {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <div>
                  <label htmlFor="source-authority" style={{ display: "block", fontSize: "0.85rem", marginBottom: "0.25rem" }}>مرجع تصویب / ابلاغ</label>
                  <input
                    id="source-authority"
                    type="text"
                    value={formData.issuing_authority}
                    onChange={(e) => setFormData({ ...formData, issuing_authority: e.target.value })}
                    style={{ width: "100%", padding: "0.5rem", borderRadius: "6px", border: "1px solid var(--border, #d9e0e7)" }}
                  />
                </div>
                <div>
                  <label htmlFor="source-version" style={{ display: "block", fontSize: "0.85rem", marginBottom: "0.25rem" }}>نسخه</label>
                  <input
                    id="source-version"
                    type="text"
                    value={formData.version}
                    onChange={(e) => setFormData({ ...formData, version: e.target.value })}
                    style={{ width: "100%", padding: "0.5rem", borderRadius: "6px", border: "1px solid var(--border, #d9e0e7)" }}
                  />
                </div>
              </div>

              {user?.global_role === "platform_admin" && (
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", background: "var(--bg, #f4f6f8)", padding: "0.5rem", borderRadius: "6px" }}>
                  <input
                    type="checkbox"
                    id="is_global"
                    checked={formData.is_global}
                    onChange={(e) => setFormData({ ...formData, is_global: e.target.checked })}
                  />
                  <label htmlFor="is_global" style={{ fontSize: "0.8rem", cursor: "pointer" }}>
                    ثبت به عنوان استاندارد سراسری و ملی (در دسترس کلیه سازمان‌ها)
                  </label>
                </div>
              )}

              <div>
                <label htmlFor="source-summary" style={{ display: "block", fontSize: "0.85rem", marginBottom: "0.25rem" }}>خلاصه کاربردی</label>
                <textarea
                  id="source-summary"
                  rows={2}
                  value={formData.summary}
                  onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
                  style={{ width: "100%", padding: "0.5rem", borderRadius: "6px", border: "1px solid var(--border, #d9e0e7)" }}
                />
              </div>

              <div>
                <label htmlFor="source-content" style={{ display: "block", fontSize: "0.85rem", marginBottom: "0.25rem" }}>متن کامل مواد و الزامات *</label>
                <textarea
                  id="source-content"
                  rows={5}
                  required
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  style={{ width: "100%", padding: "0.5rem", borderRadius: "6px", border: "1px solid var(--border, #d9e0e7)" }}
                />
              </div>

              <div>
                <label htmlFor="source-tags" style={{ display: "block", fontSize: "0.85rem", marginBottom: "0.25rem" }}>برچسب‌های کلیدی</label>
                <input
                  id="source-tags"
                  type="text"
                  value={formData.tags}
                  onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                  placeholder="مثال: ارتفاع، داربست، سقوط (با کاما جدا کنید)"
                  style={{ width: "100%", padding: "0.5rem", borderRadius: "6px", border: "1px solid var(--border, #d9e0e7)" }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "0.5rem" }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  style={{ padding: "0.5rem 1rem", borderRadius: "6px", border: "1px solid var(--border, #d9e0e7)", background: "none", cursor: "pointer" }}
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    backgroundColor: "var(--primary, #0f6b57)",
                    color: "#fff",
                    border: "none",
                    borderRadius: "6px",
                    padding: "0.5rem 1rem",
                    cursor: "pointer",
                    fontWeight: "bold",
                  }}
                >
                  {submitting ? "در حال ثبت..." : "ذخیره منبع"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
export default KnowledgeBasePage;
