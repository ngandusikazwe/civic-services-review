import { applicationStatuses, type ApplicationStatus } from "@workflow/workflow";
import type { ApplicationCategory, ApplicationPayload } from "../types.js";
import { badRequest } from "./errors.js";

const categories: ApplicationCategory[] = [
  "BUSINESS_PERMIT",
  "BUILDING_PERMIT",
  "COMMUNITY_GRANT",
  "PUBLIC_WORKS",
  "GENERAL_SERVICE"
];

export function parseApplicationPayload(body: unknown): ApplicationPayload {
  if (!body || typeof body !== "object") {
    throw badRequest("Request body must be an object.");
  }

  const value = body as Record<string, unknown>;
  const title = stringField(value.title, "title", { min: 3, max: 120 });
  const category = enumField(value.category, "category", categories);
  const description = stringField(value.description, "description", {
    min: 10,
    max: 2000
  });
  const amountCents = optionalAmount(value.amountCents);

  return {
    title,
    category,
    description,
    amountCents
  };
}

export function parseStatusQuery(status: unknown): ApplicationStatus | undefined {
  if (status === undefined) {
    return undefined;
  }

  if (typeof status !== "string" || !applicationStatuses.includes(status as ApplicationStatus)) {
    throw badRequest("Unknown status filter.", { status }, "INVALID_STATUS");
  }

  return status as ApplicationStatus;
}

function stringField(
  value: unknown,
  field: string,
  limits: { min: number; max: number }
): string {
  if (typeof value !== "string") {
    throw badRequest(`${field} is required.`, { field });
  }

  const trimmed = value.trim();

  if (trimmed.length < limits.min || trimmed.length > limits.max) {
    throw badRequest(`${field} must be between ${limits.min} and ${limits.max} characters.`, {
      field
    });
  }

  return trimmed;
}

function enumField<T extends string>(
  value: unknown,
  field: string,
  allowed: T[]
): T {
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    throw badRequest(`${field} must be one of: ${allowed.join(", ")}.`, { field });
  }

  return value as T;
}

function optionalAmount(value: unknown): number | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < 0 ||
    value > 10_000_000_00
  ) {
    throw badRequest("amountCents must be a non-negative integer amount in cents.");
  }

  return value;
}
