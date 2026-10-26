import type { ReactNode } from "react";
import type { NavTab } from "../../layouts/AppLayout";
import { useAuth } from "../../features/auth/AuthContext";
import {
  ShieldCheck,
  LayoutDashboard,
  Layers,
  FileCheck,
  ClipboardCheck,
  AlertTriangle,
  Users,
  Wrench,
  ShieldAlert,
  BookOpen,
  Sparkles,
  BarChart3,
  Bell,
  History,
  Leaf,
  Hammer,
  X,
  LogOut,
} from "lucide-react";

interface SidebarProps {
  activeTab: NavTab;
  onTabChange?: (tab: NavTab) => void;
  unreadCount?: number;
  collapsed: boolean;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

interface NavItem {
  id: NavTab;
  label: string;
  icon: ReactNode;
}

interface NavGroup {
  groupTitle: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    groupTitle: "اصلی",
    items: [
      { id: "dashboard", label: "داشبورد", icon: <LayoutDashboard size={18} /> },
      { id: "all", label: "همه بخش‌ها", icon: <Layers size={18} /> },
    ],
  },
  {
    groupTitle: "عملیات میدانی",
    items: [
      { id: "permits", label: "مجوزهای کار و تحویل شیفت", icon: <FileCheck size={18} /> },
      { id: "scaffolds", label: "داربست‌ها و کار در ارتفاع", icon: <Hammer size={18} /> },
      { id: "inspections", label: "بازرسی‌ها و اقدامات", icon: <ClipboardCheck size={18} /> },
      { id: "incidents", label: "حوادث و شبه‌حوادث", icon: <AlertTriangle size={18} /> },
      { id: "environment", label: "محیط زیست و بهداشت", icon: <Leaf size={18} /> },
    ],
  },
  {
    groupTitle: "سرمایه و منابع",
    items: [
      { id: "workforce", label: "کارکنان، آموزش و PPE", icon: <Users size={18} /> },
      { id: "assets", label: "تجهیزات و کالیبراسیون", icon: <Wrench size={18} /> },
      { id: "risks", label: "ریسک‌ها", icon: <ShieldAlert size={18} /> },
    ],
  },
  {
    groupTitle: "دانش و هوش مصنوعی",
    items: [
      { id: "knowledge", label: "پایگاه دانش و مقررات", icon: <BookOpen size={18} /> },
      { id: "ai", label: "دستیار هوشمند HSE", icon: <Sparkles size={18} /> },
    ],
  },
  {
    groupTitle: "نظارت و مدیریت",
    items: [
      { id: "reports", label: "گزارش‌ها", icon: <BarChart3 size={18} /> },
      { id: "notifications", label: "اعلان‌ها", icon: <Bell size={18} /> },
      { id: "audit", label: "حسابرسی", icon: <History size={18} /> },
    ],
  },
];

export function Sidebar({
  activeTab,
  onTabChange,
  unreadCount = 0,
  collapsed,
  mobileOpen,
  onCloseMobile,
}: SidebarProps) {
  const { user, logout } = useAuth();

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          className="sidebar-backdrop show"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      <aside
        className={`sidebar ${collapsed ? "collapsed" : ""} ${mobileOpen ? "open" : ""}`}
        aria-label="نوار کناری سامانه"
      >
        {/* Brand Area */}
        <div className="brand">
          <div className="brand-logo-wrap">
            <ShieldCheck size={26} className="brand-shield-icon" aria-hidden="true" />
          </div>
          <div className="brand-info">
            <span className="brand-name">HSE Guard</span>
            <span className="brand-tagline">سامانه یکپارچه ایمنی و سلامت</span>
          </div>
          {mobileOpen && (
            <button
              type="button"
              className="mobile-close-btn"
              onClick={onCloseMobile}
              aria-label="بستن منو"
            >
              <X size={18} aria-hidden="true" />
            </button>
          )}
        </div>

        {/* Navigation */}
        <nav aria-label="منوی اصلی" className="sidebar-nav">
          {NAV_GROUPS.map((group) => (
            <div key={group.groupTitle} className="nav-group">
              <div className="nav-group-header">{group.groupTitle}</div>
              <ul className="nav-group-list">
                {group.items.map((item) => {
                  const isActive = activeTab === item.id;
                  return (
                    <li key={item.id} className="nav-item">
                      <a
                        href={`#${item.id}`}
                        aria-current={isActive ? "page" : undefined}
                        className={`nav-link ${isActive ? "active" : ""}`}
                        title={item.label}
                        onClick={(e) => {
                          if (onTabChange) {
                            e.preventDefault();
                            onTabChange(item.id);
                            onCloseMobile();
                          }
                        }}
                      >
                        <span className="nav-icon" aria-hidden="true">
                          {item.icon}
                        </span>
                        <span className="nav-text">{item.label}</span>
                        {item.id === "notifications" && unreadCount > 0 && (
                          <span className="nav-badge" aria-label={`${unreadCount} اعلان خوانده نشده`}>
                            {unreadCount}
                          </span>
                        )}
                      </a>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* Sidebar Footer */}
        <div className="sidebar-footer">
          <span className="muted">{user ? (user.first_name || user.username) : ""}</span>
          <button
            type="button"
            className="link-button logout-btn"
            onClick={() => void logout()}
          >
            <LogOut size={14} aria-hidden="true" style={{ verticalAlign: "middle", marginLeft: "4px" }} />
            خروج
          </button>
        </div>
      </aside>
    </>
  );
}
