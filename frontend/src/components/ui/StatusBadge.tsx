import type { ReactNode } from "react";

export type BadgeVariant = "success" | "warning" | "danger" | "info" | "neutral" | "primary";

interface StatusBadgeProps {
  status?: string;
  variant?: BadgeVariant;
  children: ReactNode;
  className?: string;
}

const STATUS_VARIANT_MAP: Record<string, BadgeVariant> = {
  // Success
  completed: "success",
  closed: "success",
  active: "success",
  approved: "success",
  valid: "success",
  low: "success",
  operational: "success",

  // Warning
  pending: "warning",
  pending_verification: "warning",
  under_review: "warning",
  medium: "warning",
  calibration_due: "warning",
  maintenance_due: "warning",
  expired: "warning",

  // Danger
  critical: "danger",
  high: "danger",
  rejected: "danger",
  overdue: "danger",
  cancelled: "danger",
  suspended: "danger",
  failed: "danger",
  decommissioned: "danger",

  // Info / Primary
  in_progress: "info",
  open: "info",
  draft: "neutral",
  planned: "neutral",
};

export function StatusBadge({ status, variant, children, className = "" }: StatusBadgeProps) {
  const resolvedVariant: BadgeVariant =
    variant || (status ? STATUS_VARIANT_MAP[status.toLowerCase()] || "neutral" : "neutral");

  return (
    <span className={`badge badge-${resolvedVariant} ${className}`}>
      <span className="badge-dot" aria-hidden="true" />
      {children}
    </span>
  );
}
