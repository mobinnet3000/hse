import { useEffect, useState } from "react";
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationItem,
} from "../../services/api";

export function NotificationsPage() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    fetchNotifications(controller.signal)
      .then(setNotifications)
      .catch((err: Error) => {
        if (err.name !== "AbortError") setError(err.message);
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, []);

  async function handleMarkRead(id: number) {
    try {
      await markNotificationRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "خطا در بروزرسانی وضعیت اعلان";
      setError(msg);
    }
  }

  async function handleMarkAllRead() {
    try {
      await markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "خطا در بروزرسانی اعلان‌ها";
      setError(msg);
    }
  }

  const filtered = unreadOnly ? notifications.filter((n) => !n.is_read) : notifications;
  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <div className="notifications-page stack" dir="rtl">
      <header
        className="page-header"
        style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
      >
        <div>
          <h2>اعلان‌های سامانه</h2>
          <p className="muted">
            تعداد اعلان‌های خوانده‌نشده: <strong>{unreadCount}</strong>
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setUnreadOnly(!unreadOnly)}
          >
            {unreadOnly ? "نمایش همه" : "فقط خوانده‌نشده‌ها"}
          </button>
          {unreadCount > 0 && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleMarkAllRead}
            >
              علامت‌گذاری همه به عنوان خوانده‌شده
            </button>
          )}
        </div>
      </header>

      {loading && <p className="muted">در حال بارگذاری اعلان‌ها…</p>}
      {error && <div className="alert alert-error">{error}</div>}

      {!loading && filtered.length === 0 && (
        <div className="card" style={{ textAlign: "center", padding: "2rem" }}>
          <p className="muted">
            {unreadOnly ? "هیچ اعلان خوانده‌نشده‌ای ندارید." : "هیچ اعلانی ثبت نشده است."}
          </p>
        </div>
      )}

      <div className="notifications-list stack" style={{ gap: "0.75rem" }}>
        {filtered.map((n) => (
          <div
            key={n.id}
            className="card"
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              backgroundColor: n.is_read ? "#fdfdfd" : "#eef6ff",
              borderRight: n.is_read ? "3px solid #ccc" : "3px solid #0056b3",
              padding: "1rem",
            }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <strong>{n.title}</strong>
                {!n.is_read && (
                  <span
                    style={{
                      background: "#0056b3",
                      color: "#fff",
                      borderRadius: "4px",
                      padding: "0.1rem 0.4rem",
                      fontSize: "0.75rem",
                    }}
                  >
                    جدید
                  </span>
                )}
              </div>
              <p style={{ margin: "0.4rem 0 0.2rem" }}>{n.message}</p>
              <small className="muted">
                {n.created_at ? n.created_at.replace("T", " ").substring(0, 16) : ""}
              </small>
            </div>
            {!n.is_read && (
              <button
                type="button"
                className="btn btn-sm btn-link"
                onClick={() => handleMarkRead(n.id)}
                style={{ whiteSpace: "nowrap" }}
              >
                خوانده شد
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
