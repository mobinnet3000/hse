import React, { type ReactNode, type ButtonHTMLAttributes } from "react";

export interface PaperCardProps {
  children: ReactNode;
  className?: string;
  variant?: "default" | "blueprint" | "kraft" | "critical";
  tag?: string;
  onClick?: () => void;
}

export const PaperCard: React.FC<PaperCardProps> = ({
  children,
  className = "",
  variant = "default",
  tag,
  onClick,
}) => {
  const variantStyles = {
    default: "bg-slate-900/90 border-slate-800 text-slate-100",
    blueprint: "bg-[#0b172a]/95 border-sky-800/60 text-sky-100 shadow-[0_15px_35px_rgba(2,132,199,0.12)]",
    kraft: "bg-[#161d29]/95 border-amber-900/40 text-amber-100",
    critical: "bg-rose-950/80 border-rose-800/80 text-rose-100 shadow-[0_15px_35px_rgba(225,29,72,0.15)]",
  };

  return (
    <div
      onClick={onClick}
      className={`paper-sheet rounded-2xl p-6 border relative overflow-hidden transition-all duration-300 ${
        variantStyles[variant]
      } ${onClick ? "cursor-pointer" : ""} ${className}`}
    >
      {tag && <div className="paper-tag-corner">{tag}</div>}
      {children}
    </div>
  );
};

export interface PaperButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "amber" | "outline" | "neutral";
  size?: "sm" | "md" | "lg";
  icon?: ReactNode;
}

export const PaperButton: React.FC<PaperButtonProps> = ({
  children,
  className = "",
  variant = "primary",
  size = "md",
  icon,
  ...props
}) => {
  const variantStyles = {
    primary: "bg-sky-600 hover:bg-sky-500 text-white shadow-md shadow-sky-950/60 border border-sky-400/40",
    secondary: "bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700",
    danger: "bg-rose-600 hover:bg-rose-500 text-white shadow-md shadow-rose-950/60 border border-rose-400/40",
    amber: "bg-amber-600 hover:bg-amber-500 text-white shadow-md shadow-amber-950/60 border border-amber-400/40",
    outline: "bg-transparent hover:bg-slate-800/60 text-sky-400 border border-sky-600/60",
    neutral: "bg-neutral-200 hover:bg-neutral-300 text-neutral-800 border border-neutral-300",
  };

  const sizeStyles = {
    sm: "px-3 py-1.5 text-xs rounded-xl gap-1.5",
    md: "px-4 py-2 text-xs font-bold rounded-xl gap-2",
    lg: "px-6 py-3 text-sm font-bold rounded-2xl gap-2.5",
  };

  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center font-medium transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:pointer-events-none ${
        variantStyles[variant]
      } ${sizeStyles[size]} ${className}`}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      <span>{children}</span>
    </button>
  );
};

export const PaperBadge: React.FC<{
  children: ReactNode;
  variant?: "blue" | "green" | "amber" | "red" | "slate" | "warning" | "neutral" | "success" | "danger";
  size?: "sm" | "md" | "lg";
  className?: string;
}> = ({ children, variant = "blue", size = "sm", className = "" }) => {
  const styles: Record<string, string> = {
    blue: "bg-sky-950/70 border-sky-600/70 text-sky-300",
    green: "bg-emerald-950/70 border-emerald-600/70 text-emerald-300",
    amber: "bg-amber-950/70 border-amber-600/70 text-amber-300",
    red: "bg-rose-950/70 border-rose-600/70 text-rose-300",
    slate: "bg-slate-800/80 border-slate-700 text-slate-300",
    warning: "bg-amber-100 border-amber-300 text-amber-900",
    neutral: "bg-neutral-100 border-neutral-300 text-neutral-800",
    success: "bg-emerald-100 border-emerald-300 text-emerald-900",
    danger: "bg-red-100 border-red-300 text-red-900",
  };

  const sizeStyles: Record<string, string> = {
    sm: "px-2.5 py-0.5 text-[11px]",
    md: "px-3 py-1 text-xs",
    lg: "px-4 py-1.5 text-sm",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full font-mono font-bold border ${styles[variant] || styles.blue} ${sizeStyles[size]} ${className}`}
    >
      {children}
    </span>
  );
};
