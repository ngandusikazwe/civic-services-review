export type Role = "APPLICANT" | "REVIEWER";

export type ApplicationStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "RETURNED"
  | "APPROVED"
  | "REJECTED";

export type WorkflowAction =
  | "SUBMIT"
  | "START_REVIEW"
  | "APPROVE"
  | "REJECT"
  | "RETURN_CHANGES";

export type WorkflowInput = {
  currentStatus: ApplicationStatus;
  action: WorkflowAction;
  actorRole: Role;
  isOwner: boolean;
  comment?: string | null;
};

export type WorkflowResult =
  | {
      ok: true;
      oldStatus: ApplicationStatus;
      newStatus: ApplicationStatus;
      requiresAuditLog: true;
    }
  | {
      ok: false;
      statusCode: 400 | 403 | 409;
      code: WorkflowErrorCode;
      message: string;
    };

export type WorkflowErrorCode =
  | "OWNER_REQUIRED"
  | "REVIEWER_REQUIRED"
  | "COMMENT_REQUIRED"
  | "ILLEGAL_TRANSITION"
  | "TERMINAL_STATUS";

const terminalStatuses: ReadonlySet<ApplicationStatus> = new Set([
  "APPROVED",
  "REJECTED"
]);

const reviewerActions = new Set<WorkflowAction>([
  "START_REVIEW",
  "APPROVE",
  "REJECT",
  "RETURN_CHANGES"
]);

export const applicationStatuses: ApplicationStatus[] = [
  "DRAFT",
  "SUBMITTED",
  "UNDER_REVIEW",
  "RETURNED",
  "APPROVED",
  "REJECTED"
];

export function transitionApplication(input: WorkflowInput): WorkflowResult {
  const comment = input.comment?.trim() ?? "";

  if (terminalStatuses.has(input.currentStatus)) {
    return {
      ok: false,
      statusCode: 409,
      code: "TERMINAL_STATUS",
      message: `${input.currentStatus} applications cannot be changed.`
    };
  }

  if (input.action === "SUBMIT") {
    if (input.actorRole !== "APPLICANT" || !input.isOwner) {
      return {
        ok: false,
        statusCode: 403,
        code: "OWNER_REQUIRED",
        message: "Only the applicant who owns a draft can submit it."
      };
    }

    if (input.currentStatus !== "DRAFT" && input.currentStatus !== "RETURNED") {
      return illegal(input);
    }

    return success(input.currentStatus, "SUBMITTED");
  }

  if (reviewerActions.has(input.action) && input.actorRole !== "REVIEWER") {
    return {
      ok: false,
      statusCode: 403,
      code: "REVIEWER_REQUIRED",
      message: "Only a reviewer can transition submitted applications."
    };
  }

  if (
    (input.action === "REJECT" || input.action === "RETURN_CHANGES") &&
    comment.length === 0
  ) {
    return {
      ok: false,
      statusCode: 400,
      code: "COMMENT_REQUIRED",
      message: "Rejecting or returning an application requires a comment."
    };
  }

  if (
    input.currentStatus !== "SUBMITTED" &&
    input.currentStatus !== "UNDER_REVIEW"
  ) {
    return illegal(input);
  }

  switch (input.action) {
    case "START_REVIEW":
      return input.currentStatus === "SUBMITTED"
        ? success(input.currentStatus, "UNDER_REVIEW")
        : illegal(input);
    case "APPROVE":
      return success(input.currentStatus, "APPROVED");
    case "REJECT":
      return success(input.currentStatus, "REJECTED");
    case "RETURN_CHANGES":
      return success(input.currentStatus, "RETURNED");
    default:
      return illegal(input);
  }
}

export function canEditDraft(params: {
  status: ApplicationStatus;
  actorRole: Role;
  isOwner: boolean;
}): WorkflowResult | { ok: true } {
  if (params.actorRole !== "APPLICANT" || !params.isOwner) {
    return {
      ok: false,
      statusCode: 403,
      code: "OWNER_REQUIRED",
      message: "Only the applicant who owns a draft can edit it."
    };
  }

  if (params.status !== "DRAFT" && params.status !== "RETURNED") {
    return {
      ok: false,
      statusCode: 409,
      code: "ILLEGAL_TRANSITION",
      message: "Applications can only be edited while they are drafts or returned for changes."
    };
  }

  return { ok: true };
}

function success(
  oldStatus: ApplicationStatus,
  newStatus: ApplicationStatus
): WorkflowResult {
  return {
    ok: true,
    oldStatus,
    newStatus,
    requiresAuditLog: true
  };
}

function illegal(input: WorkflowInput): WorkflowResult {
  return {
    ok: false,
    statusCode: 409,
    code: "ILLEGAL_TRANSITION",
    message: `Cannot ${input.action.toLowerCase()} from ${input.currentStatus}.`
  };
}
