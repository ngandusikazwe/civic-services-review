import type { ApplicationStatus } from "@workflow/workflow";
import { statusLabel } from "../lib/format";

export function StatusBadge({ status }: { status: ApplicationStatus }) {
  return (
    <span className={`status status-${status.toLowerCase().replace("_", "-")}`}>
      <span className="status-dot" aria-hidden="true" />
      {statusLabel(status)}
    </span>
  );
}
