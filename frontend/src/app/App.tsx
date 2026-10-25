import { useEffect, useState } from "react";
import { AppLayout, type NavTab } from "../layouts/AppLayout";
import { AuthProvider } from "../features/auth/AuthContext";
import { HealthStatus } from "../features/health/HealthStatus";
import { DashboardPage } from "../features/dashboard/DashboardPage";
import { PermitsPage } from "../features/permits/PermitsPage";
import { AssetsPage } from "../features/assets/AssetsPage";
import { IncidentsPage } from "../features/incidents/IncidentsPage";
import { RisksPage } from "../features/risks/RisksPage";
import { InspectionsPage } from "../features/inspections/InspectionsPage";
import { ReportsPage } from "../features/reports/ReportsPage";
import { NotificationsPage } from "../features/notifications/NotificationsPage";
import { AuditLogPage } from "../features/auditlog/AuditLogPage";
import { KnowledgeBasePage } from "../features/knowledge/KnowledgeBasePage";
import { AiAssistantPage } from "../features/ai/AiAssistantPage";
import { fetchNotifications } from "../services/api";

function AppContent() {
  const [activeTab, setActiveTab] = useState<NavTab>("all");
  const [unreadCount, setUnreadCount] = useState<number>(0);

  useEffect(() => {
    fetchNotifications()
      .then((items) => {
        setUnreadCount(items.filter((n) => !n.is_read).length);
      })
      .catch(() => {
        // Silently ignore if unauthenticated or offline
      });
  }, [activeTab]);

  return (
    <AppLayout
      activeTab={activeTab}
      onTabChange={setActiveTab}
      unreadNotificationsCount={unreadCount}
    >
      <HealthStatus />

      {(activeTab === "all" || activeTab === "dashboard") && (
        <section id="dashboard" className="section-container" style={{ marginBottom: "2rem" }}>
          <DashboardPage />
        </section>
      )}

      {(activeTab === "all" || activeTab === "permits") && (
        <section id="permits" className="section-container" style={{ marginBottom: "2rem" }}>
          <PermitsPage />
        </section>
      )}

      {(activeTab === "all" || activeTab === "assets") && (
        <section id="assets" className="section-container" style={{ marginBottom: "2rem" }}>
          <AssetsPage />
        </section>
      )}

      {(activeTab === "all" || activeTab === "incidents") && (
        <section id="incidents" className="section-container" style={{ marginBottom: "2rem" }}>
          <IncidentsPage />
        </section>
      )}

      {(activeTab === "all" || activeTab === "risks") && (
        <section id="risks" className="section-container" style={{ marginBottom: "2rem" }}>
          <RisksPage />
        </section>
      )}

      {(activeTab === "all" || activeTab === "inspections") && (
        <section id="inspections" className="section-container" style={{ marginBottom: "2rem" }}>
          <InspectionsPage />
        </section>
      )}

      {(activeTab === "all" || activeTab === "knowledge") && (
        <section id="knowledge" className="section-container" style={{ marginBottom: "2rem" }}>
          <KnowledgeBasePage />
        </section>
      )}

      {(activeTab === "all" || activeTab === "ai") && (
        <section id="ai" className="section-container" style={{ marginBottom: "2rem" }}>
          <AiAssistantPage />
        </section>
      )}

      {(activeTab === "all" || activeTab === "reports") && (
        <section id="reports" className="section-container" style={{ marginBottom: "2rem" }}>
          <ReportsPage />
        </section>
      )}

      {(activeTab === "all" || activeTab === "notifications") && (
        <section id="notifications" className="section-container" style={{ marginBottom: "2rem" }}>
          <NotificationsPage />
        </section>
      )}

      {(activeTab === "all" || activeTab === "audit") && (
        <section id="audit" className="section-container" style={{ marginBottom: "2rem" }}>
          <AuditLogPage />
        </section>
      )}
    </AppLayout>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
