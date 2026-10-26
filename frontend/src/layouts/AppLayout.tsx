import { type ReactNode, useState } from "react";
import { useAuth } from "../features/auth/AuthContext";
import { LoginPage } from "../features/auth/LoginPage";
import { Header } from "../components/layout/Header";
import { Sidebar } from "../components/layout/Sidebar";

export type NavTab =
  | "all"
  | "dashboard"
  | "workforce"
  | "permits"
  | "assets"
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
  const { user, loading } = useAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  if (loading) {
    return (
      <div className="centered muted app-loader" dir="rtl">
        <div className="spinner" aria-hidden="true" />
        <p>در حال بارگذاری سامانه HSE Guard…</p>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return (
    <div className={`app-shell ${sidebarCollapsed ? "sidebar-collapsed" : ""}`} dir="rtl">
      <Sidebar
        activeTab={activeTab}
        onTabChange={onTabChange}
        unreadCount={unreadNotificationsCount}
        collapsed={sidebarCollapsed}
        mobileOpen={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
      />

      <div className="main-viewport">
        <Header
          activeTab={activeTab}
          onTabChange={onTabChange}
          unreadCount={unreadNotificationsCount}
          sidebarCollapsed={sidebarCollapsed}
          onToggleSidebar={() => setSidebarCollapsed((prev) => !prev)}
          onOpenMobileSidebar={() => setMobileSidebarOpen(true)}
        />

        <main className="content" id="main-content">
          {children}
        </main>
      </div>
    </div>
  );
}
