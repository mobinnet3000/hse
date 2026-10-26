import type { ReactNode } from "react";
import { Inbox } from "lucide-react";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({
  icon = <Inbox size={36} strokeWidth={1.5} />,
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon" aria-hidden="true">
        {icon}
      </div>
      <h4 className="empty-state-title">{title}</h4>
      {description && <p className="empty-state-desc muted">{description}</p>}
      {action && <div className="empty-state-action">{action}</div>}
    </div>
  );
}
