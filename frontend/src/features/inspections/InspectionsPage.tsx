import { useEffect, useState, type FormEvent } from "react";

import {
  ApiRequestError,
  addChecklistItem,
  closeNonConformity,
  completeInspection,
  createChecklist,
  createCorrectiveAction,
  createInspection,
  createNonConformity,
  fetchChecklists,
  fetchInspections,
  fetchInspection,
  fetchNonConformities,
  fetchCorrectiveActions,
  fetchOrganizations,
  fetchWorkplaces,
  updateInspection,
  updateInspectionResponse,
  updateNonConformity,
  updateCorrectiveAction,
  verifyCorrectiveAction,
  type Checklist,

  type CorrectiveAction,
  type Inspection,
  type InspectionResponse,
  type NonConformity,
  type Organization,
  type Workplace,
} from "../../services/api";

function errorMessage(error: unknown) {
  return error instanceof ApiRequestError ? error.message : "خطای نامشخص رخ داد.";
}

type Tab = "checklists" | "inspections" | "nonconformities" | "actions";

export function InspectionsPage() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [organizationId, setOrganizationId] = useState<number | null>(null);
  const [workplaces, setWorkplaces] = useState<Workplace[]>([]);
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [nonConformities, setNonConformities] = useState<NonConformity[]>([]);
  const [actions, setActions] = useState<CorrectiveAction[]>([]);
  const [tab, setTab] = useState<Tab>("checklists");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const [selectedChecklist, setSelectedChecklist] = useState<Checklist | null>(null);
  const [selectedInspection, setSelectedInspection] = useState<Inspection | null>(null);
  const [selectedNonConformity, setSelectedNonConformity] = useState<NonConformity | null>(null);
  const [selectedAction, setSelectedAction] = useState<CorrectiveAction | null>(null);

  const [checklistForm, setChecklistForm] = useState({ title: "", description: "" });
  const [itemForm, setItemForm] = useState({ text: "", is_required: true });
  const [inspectionForm, setInspectionForm] = useState({
    checklist: "",
    workplace: "",
    title: "",
    scheduled_at: "",
  });
  const [ncForm, setNcForm] = useState({
    description: "",
    severity: "medium",
    responsible: "",
  });
  const [actionForm, setActionForm] = useState({
    non_conformity: "",
    description: "",
    responsible: "",
    due_date: "",
  });
  const [resultText, setResultText] = useState("");
  const [saving, setSaving] = useState(false);

  async function loadAll(orgId: number) {
    setLoading(true);
    setError(null);
    try {
      const [checklistItems, inspectionItems, ncItems, actionItems, workplaceItems] =
        await Promise.all([
          fetchChecklists(orgId),
          fetchInspections(orgId),
          fetchNonConformities(orgId),
          fetchCorrectiveActions(orgId),
          fetchWorkplaces(orgId),
        ]);
      setChecklists(checklistItems);
      setInspections(inspectionItems);
      setNonConformities(ncItems);
      setActions(actionItems);
      setWorkplaces(workplaceItems);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    fetchOrganizations(controller.signal)
      .then((items) => {
        setOrganizations(items);
        if (items.length > 0) {
          setOrganizationId(items[0].id);
        }
      })
      .catch((err: unknown) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (organizationId === null) return;
    void loadAll(organizationId);
  }, [organizationId]);

  useEffect(() => {
    if (selectedInspection) {
      fetchInspection(selectedInspection.id)
        .then(setSelectedInspection)
        .catch((err: unknown) => setError(errorMessage(err)));
    }
  }, [selectedInspection?.id]);

  const selectedChecklistItems = selectedChecklist?.items ?? [];

  async function submitChecklist(event: FormEvent) {
    event.preventDefault();
    if (organizationId === null) return;
    setSaving(true);
    setFormError(null);
    try {
      const checklist = await createChecklist(organizationId, checklistForm);
      setChecklistForm({ title: "", description: "" });
      setChecklists((items) => [checklist, ...items]);
      setSelectedChecklist(checklist);
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function submitItem(event: FormEvent) {
    event.preventDefault();
    if (!selectedChecklist) return;
    setSaving(true);
    setFormError(null);
    try {
      const item = await addChecklistItem(selectedChecklist.id, {
        text: itemForm.text,
        is_required: itemForm.is_required,
      });
      setSelectedChecklist({ ...selectedChecklist, items: [...selectedChecklist.items, item] });
      setChecklists((items) =>
        items.map((checklist) =>
          checklist.id === selectedChecklist.id
            ? { ...checklist, items: [...checklist.items, item] }
            : checklist,
        ),
      );
      setItemForm({ text: "", is_required: true });
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function submitInspection(event: FormEvent) {
    event.preventDefault();
    if (organizationId === null) return;
    setSaving(true);
    setFormError(null);
    try {
      const inspection = await createInspection(organizationId, {
        checklist: Number(inspectionForm.checklist),
        title: inspectionForm.title,
        workplace: inspectionForm.workplace ? Number(inspectionForm.workplace) : null,
        scheduled_at: inspectionForm.scheduled_at
          ? `${inspectionForm.scheduled_at}T00:00:00Z`
          : null,
      });
      setInspectionForm({ checklist: "", workplace: "", title: "", scheduled_at: "" });
      setInspections((items) => [inspection, ...items]);
      setSelectedInspection(inspection);
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function startInspection(id: number) {
    setSaving(true);
    setFormError(null);
    try {
      const updated = await updateInspection(id, { status: "in_progress" });
      setSelectedInspection(updated);
      setInspections((items) => items.map((item) => (item.id === id ? updated : item)));
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function saveResponses() {
    if (!selectedInspection?.responses) return;
    setSaving(true);
    setFormError(null);
    try {
      await Promise.all(
        selectedInspection.responses.map((response) =>
          updateInspectionResponse(response.id, {
            result: response.result,
            notes: response.notes,
          }),
        ),
      );
      const refreshed = await fetchInspection(selectedInspection.id);
      setSelectedInspection(refreshed);
      setInspections((items) => items.map((item) => (item.id === refreshed.id ? refreshed : item)));
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function finishInspection() {
    if (!selectedInspection) return;
    setSaving(true);
    setFormError(null);
    try {
      const updated = await completeInspection(selectedInspection.id);
      setSelectedInspection(updated);
      setInspections((items) => items.map((item) => (item.id === updated.id ? updated : item)));
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function createNcFromResponse(response: InspectionResponse) {
    if (organizationId === null) return;
    setSaving(true);
    setFormError(null);
    try {
      const nc = await createNonConformity(organizationId, {
        inspection_response: response.id,
        description: response.notes || response.item_text,
        severity: "medium",
      });
      setNonConformities((items) => [nc, ...items]);
      setSelectedNonConformity(nc);
      setTab("nonconformities");
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function submitNonConformity(event: FormEvent) {
    event.preventDefault();
    if (organizationId === null) return;
    setSaving(true);
    setFormError(null);
    try {
      const nc = await createNonConformity(organizationId, {
        description: ncForm.description,
        severity: ncForm.severity,
        responsible: ncForm.responsible ? Number(ncForm.responsible) : null,
      });
      setNcForm({ description: "", severity: "medium", responsible: "" });
      setNonConformities((items) => [nc, ...items]);
      setSelectedNonConformity(nc);
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function changeNcStatus(nc: NonConformity, status: NonConformity["status"]) {
    setSaving(true);
    setFormError(null);
    try {
      const updated = await updateNonConformity(nc.id, { status });
      setNonConformities((items) => items.map((item) => (item.id === updated.id ? updated : item)));
      if (selectedNonConformity?.id === updated.id) setSelectedNonConformity(updated);
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function closeNc(id: number) {
    setSaving(true);
    setFormError(null);
    try {
      const updated = await closeNonConformity(id);
      setNonConformities((items) => items.map((item) => (item.id === updated.id ? updated : item)));
      if (selectedNonConformity?.id === updated.id) setSelectedNonConformity(updated);
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function submitAction(event: FormEvent) {
    event.preventDefault();
    if (organizationId === null) return;
    setSaving(true);
    setFormError(null);
    try {
      const action = await createCorrectiveAction(organizationId, {
        non_conformity: Number(actionForm.non_conformity),
        description: actionForm.description,
        responsible: actionForm.responsible ? Number(actionForm.responsible) : null,
        due_date: actionForm.due_date || null,
      });
      setActionForm({ non_conformity: "", description: "", responsible: "", due_date: "" });
      setActions((items) => [action, ...items]);
      setSelectedAction(action);
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function updateActionStatus(action: CorrectiveAction, status: CorrectiveAction["status"]) {
    setSaving(true);
    setFormError(null);
    try {
      const updated = await updateCorrectiveAction(action.id, { status });
      setActions((items) => items.map((item) => (item.id === updated.id ? updated : item)));
      if (selectedAction?.id === updated.id) setSelectedAction(updated);
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function submitActionForVerification(action: CorrectiveAction) {
    setSaving(true);
    setFormError(null);
    try {
      const updated = await updateCorrectiveAction(action.id, {
        status: "pending_verification",
        result_text: resultText,
      });
      setActions((items) => items.map((item) => (item.id === updated.id ? updated : item)));
      if (selectedAction?.id === updated.id) setSelectedAction(updated);
      setResultText("");
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function verifyAction(id: number) {
    setSaving(true);
    setFormError(null);
    try {
      const updated = await verifyCorrectiveAction(id);
      setActions((items) => items.map((item) => (item.id === updated.id ? updated : item)));
      if (selectedAction?.id === updated.id) setSelectedAction(updated);
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
    <div className="inspections-page">
      <section className="card">
        <div className="toolbar">
          <label htmlFor="inspection-organization">سازمان</label>
          <select
            id="inspection-organization"
            value={organizationId ?? ""}
            onChange={(event) => setOrganizationId(Number(event.target.value))}
          >
            {organizations.map((organization) => (
              <option key={organization.id} value={organization.id}>
                {organization.name}
              </option>
            ))}
          </select>
          <button type="button" className={`secondary ${tab === "checklists" ? "active" : ""}`} onClick={() => setTab("checklists")}>
            قالب‌ها
          </button>
          <button type="button" className={`secondary ${tab === "inspections" ? "active" : ""}`} onClick={() => setTab("inspections")}>
            بازرسی‌ها
          </button>
          <button type="button" className={`secondary ${tab === "nonconformities" ? "active" : ""}`} onClick={() => setTab("nonconformities")}>
            عدم‌انطباق‌ها
          </button>
          <button type="button" className={`secondary ${tab === "actions" ? "active" : ""}`} onClick={() => setTab("actions")}>
            اقدامات
          </button>
        </div>
        {error && <p className="alert alert-error">{error}</p>}
        {formError && <p className="alert alert-error">{formError}</p>}
      </section>

      {tab === "checklists" && (
        <>
          <section className="card">
            <h2>قالب‌های چک‌لیست</h2>
            {loading && <p className="muted">در حال بارگذاری…</p>}
            {!loading && checklists.length === 0 && (
              <p className="muted">قالبی ثبت نشده است.</p>
            )}
            {checklists.length > 0 && (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>عنوان</th>
                    <th>آیتم‌ها</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {checklists.map((checklist) => (
                    <tr key={checklist.id}>
                      <td>{checklist.title}</td>
                      <td>{checklist.items.length}</td>
                      <td>
                        <button
                          type="button"
                          className="link-button"
                          onClick={() => setSelectedChecklist(checklist)}
                        >
                          مشاهده/ویرایش
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className="card">
            <h2>ثبت قالب جدید</h2>
            <form className="stack" onSubmit={submitChecklist}>
              <label htmlFor="checklist-title">عنوان قالب</label>
              <input
                id="checklist-title"
                required
                value={checklistForm.title}
                onChange={(event) =>
                  setChecklistForm({ ...checklistForm, title: event.target.value })
                }
              />
              <label htmlFor="checklist-description">شرح</label>
              <textarea
                id="checklist-description"
                value={checklistForm.description}
                onChange={(event) =>
                  setChecklistForm({ ...checklistForm, description: event.target.value })
                }
              />
              <div className="form-actions">
                <button type="submit" disabled={saving}>
                  {saving ? "در حال ذخیره…" : "ثبت قالب"}
                </button>
              </div>
            </form>
          </section>

          {selectedChecklist && (
            <section className="card">
              <h2>آیتم‌های: {selectedChecklist.title}</h2>
              {selectedChecklistItems.length === 0 && (
                <p className="muted">آیتمی ثبت نشده است.</p>
              )}
              {selectedChecklistItems.length > 0 && (
                <table className="data-table">
                  <tbody>
                    {selectedChecklistItems.map((item) => (
                      <tr key={item.id}>
                        <td>{item.order}.</td>
                        <td>{item.text}</td>
                        <td>{item.is_required ? "الزامی" : "اختیاری"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <form className="stack" onSubmit={submitItem} style={{ marginTop: "1rem" }}>
                <label htmlFor="item-text">متن آیتم</label>
                <input
                  id="item-text"
                  required
                  value={itemForm.text}
                  onChange={(event) => setItemForm({ ...itemForm, text: event.target.value })}
                />
                <label>
                  <input
                    type="checkbox"
                    checked={itemForm.is_required}
                    onChange={(event) =>
                      setItemForm({ ...itemForm, is_required: event.target.checked })
                    }
                  />{" "}
                  الزامی
                </label>
                <div className="form-actions">
                  <button type="submit" disabled={saving}>
                    افزودن آیتم
                  </button>
                </div>
              </form>
            </section>
          )}
        </>
      )}

      {tab === "inspections" && (
        <>
          <section className="card">
            <h2>بازرسی‌ها</h2>
            {loading && <p className="muted">در حال بارگذاری…</p>}
            {!loading && inspections.length === 0 && (
              <p className="muted">بازرسی‌ای ثبت نشده است.</p>
            )}
            {inspections.length > 0 && (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>عنوان</th>
                    <th>وضعیت</th>
                    <th>پاسخ‌ها</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {inspections.map((inspection) => (
                    <tr key={inspection.id}>
                      <td>{inspection.title}</td>
                      <td>{inspection.status_display}</td>
                      <td>
                        {inspection.answered_responses}/{inspection.total_responses}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="link-button"
                          onClick={() => setSelectedInspection(inspection)}
                        >
                          اجرا/مشاهده
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className="card">
            <h2>ثبت بازرسی جدید</h2>
            <form className="stack" onSubmit={submitInspection}>
              <label htmlFor="inspection-checklist">چک‌لیست</label>
              <select
                id="inspection-checklist"
                required
                value={inspectionForm.checklist}
                onChange={(event) =>
                  setInspectionForm({ ...inspectionForm, checklist: event.target.value })
                }
              >
                <option value="">انتخاب کنید</option>
                {checklists.map((checklist) => (
                  <option key={checklist.id} value={checklist.id}>
                    {checklist.title}
                  </option>
                ))}
              </select>
              <label htmlFor="inspection-workplace">محل کار</label>
              <select
                id="inspection-workplace"
                value={inspectionForm.workplace}
                onChange={(event) =>
                  setInspectionForm({ ...inspectionForm, workplace: event.target.value })
                }
              >
                <option value="">—</option>
                {workplaces.map((workplace) => (
                  <option key={workplace.id} value={workplace.id}>
                    {workplace.name}
                  </option>
                ))}
              </select>
              <label htmlFor="inspection-title">عنوان بازرسی</label>
              <input
                id="inspection-title"
                value={inspectionForm.title}
                onChange={(event) =>
                  setInspectionForm({ ...inspectionForm, title: event.target.value })
                }
              />
              <label htmlFor="inspection-date">تاریخ برنامه‌ریزی</label>
              <input
                id="inspection-date"
                type="date"
                value={inspectionForm.scheduled_at}
                onChange={(event) =>
                  setInspectionForm({ ...inspectionForm, scheduled_at: event.target.value })
                }
              />
              <div className="form-actions">
                <button type="submit" disabled={saving}>
                  {saving ? "در حال ثبت…" : "ثبت بازرسی"}
                </button>
              </div>
            </form>
          </section>

          {selectedInspection && (
            <section className="card">
              <h2>اجرای بازرسی: {selectedInspection.title}</h2>
              <p className="muted">وضعیت: {selectedInspection.status_display}</p>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>آیتم</th>
                    <th>نتیجه</th>
                    <th>توضیحات</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {selectedInspection.responses?.map((response) => (
                    <tr key={response.id}>
                      <td>
                        {response.item_text}
                        {response.is_required && <span className="muted"> (الزامی)</span>}
                      </td>
                      <td>
                        <select
                          value={response.result}
                          disabled={selectedInspection.status === "completed"}
                          onChange={(event) => {
                            setSelectedInspection({
                              ...selectedInspection,
                              responses: selectedInspection.responses?.map((item) =>
                                item.id === response.id
                                  ? { ...item, result: event.target.value as InspectionResponse["result"] }
                                  : item,
                              ),
                            });
                          }}
                        >
                          <option value="">بدون پاسخ</option>
                          <option value="conform">مطابق</option>
                          <option value="nonconform">نامنطبق</option>
                          <option value="not_applicable">غیرقابل‌اعمال</option>
                        </select>
                      </td>
                      <td>
                        <input
                          value={response.notes}
                          disabled={selectedInspection.status === "completed"}
                          onChange={(event) => {
                            setSelectedInspection({
                              ...selectedInspection,
                              responses: selectedInspection.responses?.map((item) =>
                                item.id === response.id ? { ...item, notes: event.target.value } : item,
                              ),
                            });
                          }}
                        />
                      </td>
                      <td>
                        {response.result === "nonconform" &&
                          selectedInspection.status !== "completed" && (
                            <button
                              type="button"
                              className="link-button"
                              onClick={() => void createNcFromResponse(response)}
                            >
                              ثبت عدم‌انطباق
                            </button>
                          )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="form-actions">
                {selectedInspection.status === "draft" && (
                  <button type="button" disabled={saving} onClick={() => void startInspection(selectedInspection.id)}>
                    شروع بازرسی
                  </button>
                )}
                {selectedInspection.status === "in_progress" && (
                  <>
                    <button type="button" disabled={saving} onClick={() => void saveResponses()}>
                      ذخیره پاسخ‌ها
                    </button>
                    <button type="button" disabled={saving} onClick={() => void finishInspection()}>
                      تکمیل بازرسی
                    </button>
                  </>
                )}
              </div>
            </section>
          )}
        </>
      )}

      {tab === "nonconformities" && (
        <>
          <section className="card">
            <h2>عدم‌انطباق‌ها</h2>
            {loading && <p className="muted">در حال بارگذاری…</p>}
            {!loading && nonConformities.length === 0 && (
              <p className="muted">موردی ثبت نشده است.</p>
            )}
            {nonConformities.length > 0 && (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>شرح</th>
                    <th>شدت</th>
                    <th>وضعیت</th>
                    <th>اقدامات</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {nonConformities.map((nc) => (
                    <tr key={nc.id}>
                      <td>{nc.description}</td>
                      <td>{nc.severity_display}</td>
                      <td>{nc.status_display}</td>
                      <td>{nc.corrective_action_count}</td>
                      <td>
                        <button
                          type="button"
                          className="link-button"
                          onClick={() => setSelectedNonConformity(nc)}
                        >
                          جزئیات
                        </button>
                        {nc.status === "open" && (
                          <button
                            type="button"
                            className="link-button"
                            onClick={() => void changeNcStatus(nc, "in_progress")}
                          >
                            شروع رسیدگی
                          </button>
                        )}
                        {nc.status === "in_progress" && (
                          <button
                            type="button"
                            className="link-button"
                            onClick={() => void changeNcStatus(nc, "ready_for_review")}
                          >
                            ارسال برای بررسی
                          </button>
                        )}
                        {nc.status === "ready_for_review" && (
                          <>
                            <button
                              type="button"
                              className="link-button"
                              onClick={() => void changeNcStatus(nc, "in_progress")}
                            >
                              بازگشت
                            </button>
                            <button
                              type="button"
                              className="link-button"
                              onClick={() => void closeNc(nc.id)}
                            >
                              بستن
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className="card">
            <h2>ثبت دستی عدم‌انطباق</h2>
            <form className="stack" onSubmit={submitNonConformity}>
              <label htmlFor="nc-description">شرح</label>
              <textarea
                id="nc-description"
                required
                value={ncForm.description}
                onChange={(event) => setNcForm({ ...ncForm, description: event.target.value })}
              />
              <label htmlFor="nc-severity">شدت</label>
              <select
                id="nc-severity"
                value={ncForm.severity}
                onChange={(event) => setNcForm({ ...ncForm, severity: event.target.value })}
              >
                <option value="low">کم</option>
                <option value="medium">متوسط</option>
                <option value="high">زیاد</option>
                <option value="critical">بحرانی</option>
              </select>
              <label htmlFor="nc-responsible">شناسه مسئول پیگیری (اختیاری)</label>
              <input
                id="nc-responsible"
                value={ncForm.responsible}
                onChange={(event) => setNcForm({ ...ncForm, responsible: event.target.value })}
              />
              <div className="form-actions">
                <button type="submit" disabled={saving}>
                  {saving ? "در حال ثبت…" : "ثبت عدم‌انطباق"}
                </button>
              </div>
            </form>
          </section>
        </>
      )}

      {tab === "actions" && (
        <>
          <section className="card">
            <h2>اقدامات اصلاحی</h2>
            {loading && <p className="muted">در حال بارگذاری…</p>}
            {!loading && actions.length === 0 && <p className="muted">اقدامی ثبت نشده است.</p>}
            {actions.length > 0 && (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>شرح</th>
                    <th>عدم‌انطباق</th>
                    <th>مسئول</th>
                    <th>مهلت</th>
                    <th>وضعیت</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {actions.map((action) => (
                    <tr key={action.id}>
                      <td>{action.description}</td>
                      <td>{action.non_conformity}</td>
                      <td>{action.responsible ?? "—"}</td>
                      <td>{action.due_date ?? "—"}</td>
                      <td>{action.status_display}</td>
                      <td>
                        <button
                          type="button"
                          className="link-button"
                          onClick={() => setSelectedAction(action)}
                        >
                          مدیریت
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className="card">
            <h2>ثبت اقدام اصلاحی</h2>
            <form className="stack" onSubmit={submitAction}>
              <label htmlFor="action-nc">عدم‌انطباق</label>
              <select
                id="action-nc"
                required
                value={actionForm.non_conformity}
                onChange={(event) =>
                  setActionForm({ ...actionForm, non_conformity: event.target.value })
                }
              >
                <option value="">انتخاب کنید</option>
                {nonConformities.map((nc) => (
                  <option key={nc.id} value={nc.id}>
                    {nc.description.slice(0, 40)}
                  </option>
                ))}
              </select>
              <label htmlFor="action-description">شرح اقدام</label>
              <textarea
                id="action-description"
                required
                value={actionForm.description}
                onChange={(event) =>
                  setActionForm({ ...actionForm, description: event.target.value })
                }
              />
              <label htmlFor="action-responsible">شناسه مسئول اجرا (اختیاری)</label>
              <input
                id="action-responsible"
                value={actionForm.responsible}
                onChange={(event) =>
                  setActionForm({ ...actionForm, responsible: event.target.value })
                }
              />
              <label htmlFor="action-due">مهلت</label>
              <input
                id="action-due"
                type="date"
                value={actionForm.due_date}
                onChange={(event) =>
                  setActionForm({ ...actionForm, due_date: event.target.value })
                }
              />
              <div className="form-actions">
                <button type="submit" disabled={saving}>
                  {saving ? "در حال ثبت…" : "ثبت اقدام"}
                </button>
              </div>
            </form>
          </section>

          {selectedAction && (
            <section className="card">
              <h2>مدیریت اقدام: {selectedAction.description}</h2>
              <p className="muted">وضعیت: {selectedAction.status_display}</p>
              <div className="form-actions">
                {selectedAction.status === "open" && (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void updateActionStatus(selectedAction, "in_progress")}
                  >
                    شروع اقدام
                  </button>
                )}
                {selectedAction.status === "in_progress" && (
                  <>
                    <label htmlFor="result-text">نتیجه اجرا</label>
                    <textarea
                      id="result-text"
                      value={resultText}
                      onChange={(event) => setResultText(event.target.value)}
                    />
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => void submitActionForVerification(selectedAction)}
                    >
                      ارسال برای بررسی
                    </button>
                  </>
                )}
                {selectedAction.status === "pending_verification" && (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void verifyAction(selectedAction.id)}
                  >
                    تأیید اثربخشی
                  </button>
                )}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

