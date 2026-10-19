import type { ReactNode } from "react";

import { useAuth } from "../features/auth/AuthContext";
import { LoginPage } from "../features/auth/LoginPage";

export type NavTab =
  | "all"
  | "dashboard"
  | "incidents"
  | "risks"
  | "inspections"
  | "reports"
  | "notifications"
  | "knowledge"
  | "ai"
  | "audit";

interface AppLayoutProps {
  children: ReactNode;
  activeTab?: NavTab;
  onTabChange?: (tab: NavTab) => void;
  unreadNotificationsCount?: number;
}

export function AppLayout({
  children,
  activeTab = "all",
  onTabChange,
  unreadNotificationsCount = 0,
}: AppLayoutProps) {
  const { user, loading, logout } = useAuth();

  if (loading) {
    return <p className="centered muted">در حال بارگذاری…</p>;
  }

  if (!user) {
    return <LoginPage />;
  }

  const navItems: Array<{ id: NavTab; label: string }> = [
    { id: "dashboard", label: "داشبورد" },
    { id: "incidents", label: "حوادث و شبه‌حوادث" },
    { id: "risks", label: "ریسک‌ها" },
    { id: "inspections", label: "بازرسی‌ها و اقدامات" },
    { id: "knowledge", label: "پایگاه دانش و مقررات" },
    { id: "ai", label: "دستیار هوشمند HSE" },
    { id: "reports", label: "گزارش‌ها" },
    { id: "notifications", label: "اعلان‌ها" },
    { id: "audit", label: "حسابرسی" },
    { id: "all", label: "همه بخش‌ها" },
  ];

  return (
    <div className="app-shell" dir="rtl">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">HSE</span>
          <span className="brand-name">HSE Guard</span>
        </div>
        <nav aria-label="منوی اصلی">
          <ul>
            {navItems.map((item) => (
              <li key={item.id}>
                <a
                  href={`#${item.id}`}
                  aria-current={activeTab === item.id ? "page" : undefined}
                  onClick={(e) => {
                    if (onTabChange) {
                      e.preventDefault();
                      onTabChange(item.id);
                    }
                  }}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    fontWeight: activeTab === item.id ? "bold" : "normal",
                  }}
                >
                  <span>{item.label}</span>
                  {item.id === "notifications" && unreadNotificationsCount > 0 && (
                    <span
                      className="nav-badge"
                      style={{
                        backgroundColor: "#d9534f",
                        color: "#fff",
                        padding: "0.1rem 0.45rem",
                        borderRadius: "10px",
                        fontSize: "0.75rem",
                      }}
                    >
                      {unreadNotificationsCount}
                    </span>
                  )}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="sidebar-footer">
          <span className="muted">{user.first_name || user.username}</span>
          <button type="button" className="link-button" onClick={() => void logout()}>
            خروج
          </button>
        </div>
      </aside>
      <main className="content">
        <header className="topbar">
          <h1>سامانه مدیریت ایمنی، بهداشت و محیط زیست</h1>
        </header>
        {children}
      </main>
    </div>
  );
}
