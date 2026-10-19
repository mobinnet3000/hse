import { useEffect, useMemo, useState, type FormEvent } from "react";

import {
  ApiRequestError,
  HAZARD_CATEGORIES,
  createAssessment,
  createHazard,
  fetchAssessments,
  fetchHazards,
  fetchOrganizations,
  fetchWorkplaces,
  updateHazard,
  type Hazard,
  type Organization,
  type RiskAssessment,
  type Workplace,
} from "../../services/api";

type FormState = {
  id: number | null;
  title: string;
  description: string;
  category: string;
  source: string;
  causes: string;
  consequences: string;
  exposed_persons: string;
  existing_controls: string;
  workplace: string;
  status: string;
};

const emptyHazardForm: FormState = {
  id: null,
  title: "",
  description: "",
  category: "safety",
  source: "",
  causes: "",
  consequences: "",
  exposed_persons: "",
  existing_controls: "",
  workplace: "",
  status: "draft",
};

function errorMessage(error: unknown) {
  return error instanceof ApiRequestError ? error.message : "خطای نامشخص رخ داد.";
}

export function RisksPage() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [organizationId, setOrganizationId] = useState<number | null>(null);
  const [workplaces, setWorkplaces] = useState<Workplace[]>([]);
  const [hazards, setHazards] = useState<Hazard[]>([]);
  const [assessments, setAssessments] = useState<RiskAssessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({ category: "", level: "" });
  const [hazardForm, setHazardForm] = useState<FormState>(emptyHazardForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [assessmentForm, setAssessmentForm] = useState({
    hazard: "",
    likelihood: "3",
    severity: "3",
    proposed_controls: "",
    implemented_controls: "",
  });
  const [assessmentResult, setAssessmentResult] = useState<RiskAssessment | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetchOrganizations(controller.signal)
      .then((items) => {
        setOrganizations(items);
        setOrganizationId(items[0]?.id ?? null);
      })
      .catch((err: unknown) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (organizationId === null) return;
    const controller = new AbortController();
    setLoading(true);
    Promise.all([
      fetchHazards(organizationId, {}, controller.signal),
      fetchAssessments(organizationId, {}, controller.signal),
      fetchWorkplaces(organizationId, controller.signal),
    ])
      .then(([hazardItems, assessmentItems, workplaceItems]) => {
        setHazards(hazardItems);
        setAssessments(assessmentItems);
        setWorkplaces(workplaceItems);
        setError(null);
      })
      .catch((err: unknown) => {
        if (!controller.signal.aborted) setError(errorMessage(err));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [organizationId]);

  const visibleHazards = useMemo(
    () => hazards.filter((hazard) => !filters.category || hazard.category === filters.category),
    [hazards, filters.category],
  );

  const visibleAssessments = useMemo(
    () => assessments.filter((item) => !filters.level || item.level === filters.level),
    [assessments, filters.level],
  );

  async function reload(orgId: number) {
    const [hazardItems, assessmentItems] = await Promise.all([
      fetchHazards(orgId),
      fetchAssessments(orgId),
    ]);
    setHazards(hazardItems);
    setAssessments(assessmentItems);
  }

  function startEdit(hazard: Hazard) {
    setHazardForm({
      id: hazard.id,
      title: hazard.title,
      description: hazard.description,
      category: hazard.category,
      source: hazard.source,
      causes: hazard.causes,
      consequences: hazard.consequences,
      exposed_persons: hazard.exposed_persons,
      existing_controls: hazard.existing_controls,
      workplace: hazard.workplace ? String(hazard.workplace) : "",
      status: hazard.status,
    });
    setFormError(null);
  }

  async function submitHazard(event: FormEvent) {
    event.preventDefault();
    if (organizationId === null) return;
    setSaving(true);
    setFormError(null);
    const payload = {
      title: hazardForm.title.trim(),
      description: hazardForm.description,
      category: hazardForm.category,
      source: hazardForm.source,
      causes: hazardForm.causes,
      consequences: hazardForm.consequences,
      exposed_persons: hazardForm.exposed_persons,
      existing_controls: hazardForm.existing_controls,
      workplace: hazardForm.workplace ? Number(hazardForm.workplace) : null,
      status: hazardForm.status,
    };
    try {
      if (hazardForm.id === null) {
        await createHazard(organizationId, payload);
      } else {
        await updateHazard(hazardForm.id, payload);
      }
      setHazardForm(emptyHazardForm);
      await reload(organizationId);
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function submitAssessment(event: FormEvent) {
    event.preventDefault();
    if (organizationId === null) return;
    setSaving(true);
    setFormError(null);
    setAssessmentResult(null);
    try {
      const result = await createAssessment(organizationId, {
        hazard: Number(assessmentForm.hazard),
        likelihood: Number(assessmentForm.likelihood),
        severity: Number(assessmentForm.severity),
        proposed_controls: assessmentForm.proposed_controls,
        implemented_controls: assessmentForm.implemented_controls,
      });
      setAssessmentResult(result);
      setAssessmentForm({
        hazard: "",
        likelihood: "3",
        severity: "3",
        proposed_controls: "",
        implemented_controls: "",
      });
      await reload(organizationId);
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  if (loading && organizations.length === 0) {
    return <p className="muted">در حال بارگذاری…</p>;
  }

  if (organizations.length === 0) {
    return <p className="alert alert-error">شما عضو فعال هیچ سازمانی نیستید.</p>;
  }

  return (
    <div className="risks-page">
      <section className="card">
        <div className="toolbar">
          <label htmlFor="organization">سازمان</label>
          <select
            id="organization"
            value={organizationId ?? ""}
            onChange={(event) => setOrganizationId(Number(event.target.value))}
          >
            {organizations.map((organization) => (
              <option key={organization.id} value={organization.id}>
                {organization.name}
              </option>
            ))}
          </select>
          <label htmlFor="category-filter">دسته‌بندی</label>
          <select
            id="category-filter"
            value={filters.category}
            onChange={(event) => setFilters({ ...filters, category: event.target.value })}
          >
            <option value="">همه</option>
            {HAZARD_CATEGORIES.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <label htmlFor="level-filter">سطح ریسک</label>
          <select
            id="level-filter"
            value={filters.level}
            onChange={(event) => setFilters({ ...filters, level: event.target.value })}
          >
            <option value="">همه</option>
            <option value="low">کم</option>
            <option value="medium">متوسط</option>
            <option value="high">زیاد</option>
            <option value="critical">بحرانی</option>
          </select>
        </div>
        {error && <p className="alert alert-error">{error}</p>}
      </section>

      <section className="card">
        <h2>خطرها</h2>
        {loading && <p className="muted">در حال بارگذاری…</p>}
        {!loading && visibleHazards.length === 0 && (
          <p className="muted">خطری ثبت نشده است.</p>
        )}
        {visibleHazards.length > 0 && (
          <table className="data-table">
            <thead>
              <tr>
                <th>عنوان</th>
                <th>دسته‌بندی</th>
                <th>محل کار</th>
                <th>وضعیت</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visibleHazards.map((hazard) => (
                <tr key={hazard.id}>
                  <td>{hazard.title}</td>
                  <td>{hazard.category_display}</td>
                  <td>
                    {workplaces.find((workplace) => workplace.id === hazard.workplace)?.name ??
                      "—"}
                  </td>
                  <td>{hazard.status_display}</td>
                  <td>
                    <button type="button" className="link-button" onClick={() => startEdit(hazard)}>
                      ویرایش
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="card">
        <h2>{hazardForm.id === null ? "ثبت خطر جدید" : "ویرایش خطر"}</h2>
        <form className="stack" onSubmit={submitHazard}>
          <label htmlFor="title">عنوان</label>
          <input
            id="title"
            required
            value={hazardForm.title}
            onChange={(event) => setHazardForm({ ...hazardForm, title: event.target.value })}
          />

          <label htmlFor="description">شرح</label>
          <textarea
            id="description"
            value={hazardForm.description}
            onChange={(event) => setHazardForm({ ...hazardForm, description: event.target.value })}
          />

          <label htmlFor="category">دسته‌بندی</label>
          <select
            id="category"
            value={hazardForm.category}
            onChange={(event) => setHazardForm({ ...hazardForm, category: event.target.value })}
          >
            {HAZARD_CATEGORIES.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>

          <label htmlFor="workplace">محل کار</label>
          <select
            id="workplace"
            value={hazardForm.workplace}
            onChange={(event) => setHazardForm({ ...hazardForm, workplace: event.target.value })}
          >
            <option value="">—</option>
            {workplaces.map((workplace) => (
              <option key={workplace.id} value={workplace.id}>
                {workplace.name}
              </option>
            ))}
          </select>

          <label htmlFor="source">منبع خطر</label>
          <input
            id="source"
            value={hazardForm.source}
            onChange={(event) => setHazardForm({ ...hazardForm, source: event.target.value })}
          />

          <label htmlFor="causes">علل</label>
          <textarea
            id="causes"
            value={hazardForm.causes}
            onChange={(event) => setHazardForm({ ...hazardForm, causes: event.target.value })}
          />

          <label htmlFor="consequences">پیامدها</label>
          <textarea
            id="consequences"
            value={hazardForm.consequences}
            onChange={(event) => setHazardForm({ ...hazardForm, consequences: event.target.value })}
          />

          <label htmlFor="exposed">افراد در معرض</label>
          <textarea
            id="exposed"
            value={hazardForm.exposed_persons}
            onChange={(event) =>
              setHazardForm({ ...hazardForm, exposed_persons: event.target.value })
            }
          />

          <label htmlFor="existing-controls">کنترل‌های موجود</label>
          <textarea
            id="existing-controls"
            value={hazardForm.existing_controls}
            onChange={(event) =>
              setHazardForm({ ...hazardForm, existing_controls: event.target.value })
            }
          />

          <label htmlFor="hazard-status">وضعیت</label>
          <select
            id="hazard-status"
            value={hazardForm.status}
            onChange={(event) => setHazardForm({ ...hazardForm, status: event.target.value })}
          >
            <option value="draft">پیش‌نویس</option>
            <option value="active">فعال</option>
            <option value="closed">بسته‌شده</option>
          </select>

          {formError && (
            <p className="alert alert-error" role="alert">
              {formError}
            </p>
          )}

          <div className="form-actions">
            <button type="submit" disabled={saving}>
              {saving ? "در حال ذخیره…" : hazardForm.id === null ? "ثبت خطر" : "ذخیره تغییرات"}
            </button>
            {hazardForm.id !== null && (
              <button
                type="button"
                className="secondary"
                onClick={() => setHazardForm(emptyHazardForm)}
              >
                انصراف
              </button>
            )}
          </div>
        </form>
      </section>

      <section className="card">
        <h2>ارزیابی ریسک</h2>
        <form className="stack" onSubmit={submitAssessment}>
          <label htmlFor="assessment-hazard">خطر</label>
          <select
            id="assessment-hazard"
            required
            value={assessmentForm.hazard}
            onChange={(event) =>
              setAssessmentForm({ ...assessmentForm, hazard: event.target.value })
            }
          >
            <option value="">انتخاب کنید</option>
            {hazards.map((hazard) => (
              <option key={hazard.id} value={hazard.id}>
                {hazard.title}
              </option>
            ))}
          </select>

          <label htmlFor="likelihood">احتمال (۱ تا ۵)</label>
          <select
            id="likelihood"
            value={assessmentForm.likelihood}
            onChange={(event) =>
              setAssessmentForm({ ...assessmentForm, likelihood: event.target.value })
            }
          >
            {[1, 2, 3, 4, 5].map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>

          <label htmlFor="severity">شدت (۱ تا ۵)</label>
          <select
            id="severity"
            value={assessmentForm.severity}
            onChange={(event) =>
              setAssessmentForm({ ...assessmentForm, severity: event.target.value })
            }
          >
            {[1, 2, 3, 4, 5].map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>

          <label htmlFor="proposed-controls">کنترل‌های پیشنهادی</label>
          <textarea
            id="proposed-controls"
            value={assessmentForm.proposed_controls}
            onChange={(event) =>
              setAssessmentForm({ ...assessmentForm, proposed_controls: event.target.value })
            }
          />

          <label htmlFor="implemented-controls">کنترل‌های اجراشده</label>
          <textarea
            id="implemented-controls"
            value={assessmentForm.implemented_controls}
            onChange={(event) =>
              setAssessmentForm({ ...assessmentForm, implemented_controls: event.target.value })
            }
          />

          <div className="form-actions">
            <button type="submit" disabled={saving}>
              {saving ? "در حال محاسبه…" : "ثبت ارزیابی"}
            </button>
          </div>
        </form>

        {assessmentResult && (
          <p className="alert alert-success" role="status">
            امتیاز ریسک: {assessmentResult.score} — سطح: {assessmentResult.level_display}
          </p>
        )}

        {visibleAssessments.length === 0 ? (
          <p className="muted">ارزیابی‌ای ثبت نشده است.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>خطر</th>
                <th>احتمال</th>
                <th>شدت</th>
                <th>امتیاز</th>
                <th>سطح</th>
                <th>وضعیت</th>
              </tr>
            </thead>
            <tbody>
              {visibleAssessments.map((assessment) => (
                <tr key={assessment.id}>
                  <td>{hazards.find((hazard) => hazard.id === assessment.hazard)?.title ?? "—"}</td>
                  <td>{assessment.likelihood}</td>
                  <td>{assessment.severity}</td>
                  <td>{assessment.score}</td>
                  <td>{assessment.level_display}</td>
                  <td>{assessment.status_display}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
