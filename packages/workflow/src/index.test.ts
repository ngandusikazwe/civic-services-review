import { describe, expect, it } from "vitest";
import { canEditDraft, transitionApplication } from "./index";

describe("transitionApplication", () => {
  it("lets the owning applicant submit a draft", () => {
    const result = transitionApplication({
      currentStatus: "DRAFT",
      action: "SUBMIT",
      actorRole: "APPLICANT",
      isOwner: true
    });

    expect(result).toEqual({
      ok: true,
      oldStatus: "DRAFT",
      newStatus: "SUBMITTED",
      requiresAuditLog: true
    });
  });

  it("blocks a non-owner from submitting another applicant's draft", () => {
    const result = transitionApplication({
      currentStatus: "DRAFT",
      action: "SUBMIT",
      actorRole: "APPLICANT",
      isOwner: false
    });

    expect(result.ok).toBe(false);
    expect(result).toMatchObject({
      statusCode: 403,
      code: "OWNER_REQUIRED"
    });
  });

  it("lets a reviewer move submitted work into review and approve it", () => {
    const review = transitionApplication({
      currentStatus: "SUBMITTED",
      action: "START_REVIEW",
      actorRole: "REVIEWER",
      isOwner: false
    });
    const approve = transitionApplication({
      currentStatus: "UNDER_REVIEW",
      action: "APPROVE",
      actorRole: "REVIEWER",
      isOwner: false
    });

    expect(review).toMatchObject({ ok: true, newStatus: "UNDER_REVIEW" });
    expect(approve).toMatchObject({ ok: true, newStatus: "APPROVED" });
  });

  it("requires a reviewer role for review transitions", () => {
    const result = transitionApplication({
      currentStatus: "SUBMITTED",
      action: "APPROVE",
      actorRole: "APPLICANT",
      isOwner: true
    });

    expect(result.ok).toBe(false);
    expect(result).toMatchObject({
      statusCode: 403,
      code: "REVIEWER_REQUIRED"
    });
  });

  it("requires comments when rejecting or returning for changes", () => {
    const reject = transitionApplication({
      currentStatus: "SUBMITTED",
      action: "REJECT",
      actorRole: "REVIEWER",
      isOwner: false
    });
    const returnChanges = transitionApplication({
      currentStatus: "UNDER_REVIEW",
      action: "RETURN_CHANGES",
      actorRole: "REVIEWER",
      isOwner: false,
      comment: " "
    });

    expect(reject).toMatchObject({
      ok: false,
      statusCode: 400,
      code: "COMMENT_REQUIRED"
    });
    expect(returnChanges).toMatchObject({
      ok: false,
      statusCode: 400,
      code: "COMMENT_REQUIRED"
    });
  });

  it("marks a request returned when the reviewer sends it back for changes", () => {
    const result = transitionApplication({
      currentStatus: "UNDER_REVIEW",
      action: "RETURN_CHANGES",
      actorRole: "REVIEWER",
      isOwner: false,
      comment: "Please include the invoice date."
    });

    expect(result).toMatchObject({
      ok: true,
      oldStatus: "UNDER_REVIEW",
      newStatus: "RETURNED"
    });
  });

  it("lets the owner resubmit a returned request", () => {
    const result = transitionApplication({
      currentStatus: "RETURNED",
      action: "SUBMIT",
      actorRole: "APPLICANT",
      isOwner: true
    });

    expect(result).toMatchObject({
      ok: true,
      oldStatus: "RETURNED",
      newStatus: "SUBMITTED"
    });
  });

  it("blocks transitions after terminal approval", () => {
    const result = transitionApplication({
      currentStatus: "APPROVED",
      action: "REJECT",
      actorRole: "REVIEWER",
      isOwner: false,
      comment: "Changed my mind."
    });

    expect(result).toMatchObject({
      ok: false,
      statusCode: 409,
      code: "TERMINAL_STATUS"
    });
  });
});

describe("canEditDraft", () => {
  it("lets the owner edit a draft", () => {
    expect(
      canEditDraft({
        status: "DRAFT",
        actorRole: "APPLICANT",
        isOwner: true
      })
    ).toEqual({ ok: true });
  });

  it("lets the owner edit a returned request", () => {
    expect(
      canEditDraft({
        status: "RETURNED",
        actorRole: "APPLICANT",
        isOwner: true
      })
    ).toEqual({ ok: true });
  });

  it("blocks edits after submission", () => {
    const result = canEditDraft({
      status: "SUBMITTED",
      actorRole: "APPLICANT",
      isOwner: true
    });

    expect(result).toMatchObject({
      ok: false,
      statusCode: 409,
      code: "ILLEGAL_TRANSITION"
    });
  });
});
