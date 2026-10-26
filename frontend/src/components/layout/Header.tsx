import { useAuth } from "../../features/auth/AuthContext";
import { ThemeToggle } from "../ui/ThemeToggle";
import type { NavTab } from "../../layouts/AppLayout";
import { Menu, PanelLeftClose, PanelLeftOpen, Bell } from "lucide-react";

interface HeaderProps {
  activeTab: NavTab;
  onTabChange?: (tab: NavTab) => void;
  unreadCount?: number;
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  onOpenMobileSidebar: () => void;
}

const TAB_TITLES: Record<NavTab, string> = {
  all: "نمای یکپارچه سامانه",
  dashboard: "داشبورد تحلیلی و مدیریتی",
  workforce: "مدیریت کارکنان، صلاحیت و تجهیزات فردی (PPE)",
  permits: "مجوزهای انجام کار پرخطر (PTW) و تحویل شیفت",
  assets: "تجهیزات صنعتی، نگهداری و کالیبراسیون",
  incidents: "ثبت، تحقیق و تحلیل حوادث و شبه‌حوادث",
  risks: "شناسایی خطرات و ارزیابی ماتریس ریسک",
  inspections: "طرح‌های بازرسی، چک‌لیست‌ها و اقدامات اصلاحی",
  knowledge: "پایگاه دانش، قوانین و آیین‌نامه‌های ملی",
  ai: "دستیار هوشمند مستندسازی و تحلیل ایمنی",
  reports: "مرکز گزارش‌گیری تحلیلی و خروجی داده‌ها",
  notifications: "مرکز اعلان‌ها و هشدارهای سررسید",
  audit: "گزارش جامع رویدادها و ردپای حسابرسی",
};

export function Header({
  activeTab,
  onTabChange,
  unreadCount = 0,
  sidebarCollapsed,
  onToggleSidebar,
  onOpenMobileSidebar,
}: HeaderProps) {
  const { user } = useAuth();

  return (
    <header className="app-header">
      <div className="header-left">
        {/* Mobile menu trigger */}
        <button
          type="button"
          className="header-icon-btn mobile-menu-btn"
          onClick={onOpenMobileSidebar}
          aria-label="باز کردن منو"
          title="منو"
        >
          <Menu size={20} aria-hidden="true" />
        </button>

        {/* Desktop sidebar collapse trigger */}
        <button
          type="button"
          className="header-icon-btn desktop-collapse-btn"
          onClick={onToggleSidebar}
          aria-label={sidebarCollapsed ? "باز کردن منوی کناری" : "جمع کردن منوی کناری"}
          title={sidebarCollapsed ? "باز کردن منو" : "جمع کردن منو"}
        >
          {sidebarCollapsed ? (
            <PanelLeftOpen size={18} aria-hidden="true" />
          ) : (
            <PanelLeftClose size={18} aria-hidden="true" />
          )}
        </button>

        <div className="header-titles">
          <h1 className="header-app-title">سامانه مدیریت ایمنی، بهداشت و محیط زیست</h1>
          <nav aria-label="موقعیت فعلی" className="breadcrumb">
            <span className="breadcrumb-root">HSE Guard</span>
            <span className="breadcrumb-separator" aria-hidden="true">/</span>
            <span className="breadcrumb-current">{TAB_TITLES[activeTab] || "داشبورد"}</span>
          </nav>
        </div>
      </div>

      <div className="header-right">
        {/* Theme Toggle */}
        <ThemeToggle />

        {/* Notifications Icon Button */}
        <button
          type="button"
          className="header-icon-btn notif-btn"
          onClick={() => onTabChange && onTabChange("notifications")}
          title="اعلان‌ها و هشدارها"
          aria-label={`اعلان‌ها: ${unreadCount} اعلان خوانده‌نشده`}
        >
          <Bell size={18} aria-hidden="true" />
          {unreadCount > 0 && <span className="notif-badge-pill">{unreadCount}</span>}
        </button>

        {/* User Avatar Chip */}
        {user && (
          <div className="user-profile-chip" title={user.first_name || user.username}>
            <div className="user-avatar" aria-hidden="true">
              {(user.first_name?.[0] || user.username?.[0] || "U").toUpperCase()}
            </div>
            {user.global_role === "platform_admin" && <span className="user-role-badge">مدیر</span>}
          </div>
        )}
      </div>
    </header>
  );
}
