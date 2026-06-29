import type { ApplicationStatus } from "@workflow/workflow";
import type { ApplicationCategory } from "../types";

export function money(amountCents: number | null): string {
  if (amountCents === null) {
    return "Not set";
  }

  return new Intl.NumberFormat("en-ZM", {
    style: "currency",
    currency: "ZMW"
  }).format(amountCents / 100);
}

export function dateTime(value: string): string {
  return new Intl.DateTimeFormat("en-ZM", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

export function statusLabel(status: ApplicationStatus): string {
  return status
    .split("_")
    .map((part) => part[0] + part.slice(1).toLowerCase())
    .join(" ");
}

export function categoryLabel(category: ApplicationCategory): string {
  const labels: Record<ApplicationCategory, string> = {
    BUSINESS_PERMIT: "Business permit",
    BUILDING_PERMIT: "Building permit",
    COMMUNITY_GRANT: "Community grant",
    PUBLIC_WORKS: "Public works",
    GENERAL_SERVICE: "General service"
  };

  return labels[category];
}

export function officeLabel(category: ApplicationCategory): string {
  const labels: Record<ApplicationCategory, string> = {
    BUSINESS_PERMIT: "Licensing desk",
    BUILDING_PERMIT: "Planning desk",
    COMMUNITY_GRANT: "Community development",
    PUBLIC_WORKS: "Public works desk",
    GENERAL_SERVICE: "Customer services"
  };

  return labels[category];
}

export function caseReference(id: string): string {
  const compact = id.replace(/[^a-z0-9]/gi, "").toUpperCase();
  return `CSR-${compact.slice(-6).padStart(6, "0")}`;
}
