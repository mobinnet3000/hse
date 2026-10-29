import { useTheme } from "../../context/ThemeContext";
import { Sun, Monitor, Moon } from "lucide-react";

export function ThemeToggle() {
  const { theme, resolvedTheme, setTheme } = useTheme();

  return (
    <div className="theme-toggle" role="group" aria-label="انتخاب پوسته">
      <button
        type="button"
        className={`theme-toggle-btn ${theme === "light" ? "active" : ""}`}
        onClick={() => setTheme("light")}
        title="پوسته روشن"
        aria-pressed={theme === "light"}
      >
        <Sun size={15} aria-hidden="true" />
        <span className="sr-only">روشن</span>
      </button>
      <button
        type="button"
        className={`theme-toggle-btn ${theme === "system" ? "active" : ""}`}
        onClick={() => setTheme("system")}
        title={`خودکار سیستم (${resolvedTheme === "dark" ? "تاریک" : "روشن"})`}
        aria-pressed={theme === "system"}
      >
        <Monitor size={15} aria-hidden="true" />
        <span className="sr-only">خودکار</span>
      </button>
      <button
        type="button"
        className={`theme-toggle-btn ${theme === "dark" ? "active" : ""}`}
        onClick={() => setTheme("dark")}
        title="پوسته تاریک"
        aria-pressed={theme === "dark"}
      >
        <Moon size={15} aria-hidden="true" />
        <span className="sr-only">تاریک</span>
      </button>
    </div>
  );
}
