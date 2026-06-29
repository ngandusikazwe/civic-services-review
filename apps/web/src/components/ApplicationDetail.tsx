import {
  CheckCircle2,
  ChevronDown,
  RotateCcw,
  Send,
  ThumbsDown,
  Timer,
  UserRoundPen
} from "lucide-react";
import { useState } from "react";
import type { WorkflowAction } from "@workflow/workflow";
import type { ApplicationWithAudit, Session } from "../types";
import {
  caseReference,
  categoryLabel,
  dateTime,
  money,
  officeLabel,
  statusLabel
} from "../lib/format";
import { StatusBadge } from "./StatusBadge";

type ApplicationDetailProps = {
  application: ApplicationWithAudit | null;
  loading: boolean;
  session: Session;
  onEdit: () => void;
  onSubmitDraft: () => Promise<void>;
  onTransition: (action: WorkflowAction, comment?: string) => Promise<void>;
};

export function ApplicationDetail({
  application,
  loading,
  session,
  onEdit,
  onSubmitDraft,
  onTransition
}: ApplicationDetailProps) {
  const [comment, setComment] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  async function runAction(action: WorkflowAction) {
    setActionError(null);
    setPendingAction(action);

    try {
      await onTransition(action, comment);
      setComment("");
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Action failed.");
    } finally {
      setPendingAction(null);
    }
  }

  async function submitDraft() {
    setActionError(null);
    setPendingAction("SUBMIT");

    try {
      await onSubmitDraft();
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Submit failed.");
    } finally {
      setPendingAction(null);
    }
  }

  if (loading) {
    return (
      <>
        <section className="workspace-panel case-panel skeleton-detail" aria-busy="true">
          <span className="sr-only">Loading request...</span>
          <div className="detail-header">
            <div className="skeleton-stack">
              <span className="skeleton-line tiny" />
              <span className="skeleton-chip" />
              <span className="skeleton-line heading" />
              <span className="skeleton-line medium" />
            </div>
            <span className="skeleton-pill" />
          </div>
          <div className="summary-grid skeleton-summary">
            {Array.from({ length: 4 }, (_, index) => (
              <div key={index}>
                <span className="skeleton-line tiny" />
                <span className="skeleton-line medium" />
              </div>
            ))}
          </div>
          <article className="description-block">
            <span className="skeleton-line tiny" />
            <span className="skeleton-block" />
          </article>
          <div className="reviewer-actions">
            <span className="skeleton-line medium" />
            <span className="skeleton-block compact" />
          </div>
        </section>
        <section className="records-panel loading-records" aria-busy="true">
          {Array.from({ length: 2 }, (_, index) => (
            <section className="record-section" key={index}>
              <span className="skeleton-line heading" />
              <span className="skeleton-block compact" />
            </section>
          ))}
        </section>
      </>
    );
  }

  if (!application) {
    return (
      <section className="workspace-panel empty-workspace">
        <Timer size={28} />
        <p>Select a request</p>
      </section>
    );
  }

  const canEdit =
    session.user.role === "APPLICANT" &&
    session.user.id === application.ownerId &&
    (application.status === "DRAFT" || application.status === "RETURNED");
  const canReview =
    session.user.role === "REVIEWER" &&
    (application.status === "SUBMITTED" || application.status === "UNDER_REVIEW");
  const submitLabel = application.status === "RETURNED" ? "Resubmit" : "Submit";
  const pendingSubmitLabel =
    application.status === "RETURNED" ? "Resubmitting" : "Submitting";
  const latestFeedback = latestDecisionNote(application);
  const latestRevision = application.revisions[0]?.revisionNumber ?? 0;

  return (
    <>
      <section className="workspace-panel case-panel">
        <div className="detail-header">
          <div>
            <p className="eyebrow">Case file</p>
            <p className="case-reference">{caseReference(application.id)}</p>
            <h2>{application.title}</h2>
            <p className="case-subtitle">
              {categoryLabel(application.category)} - {dateTime(application.updatedAt)}
            </p>
          </div>
          <StatusBadge status={application.status} />
        </div>

        <div className="summary-grid">
          <div>
            <span>Requester</span>
            <strong>{application.owner.name}</strong>
          </div>
          <div>
            <span>Routing desk</span>
            <strong>{officeLabel(application.category)}</strong>
          </div>
          <div>
            <span>Estimated value</span>
            <strong>{money(application.amountCents)}</strong>
          </div>
          <div>
            <span>Latest version</span>
            <strong>{latestRevision === 0 ? "Draft" : `Version ${latestRevision}`}</strong>
          </div>
        </div>

        <article className="description-block">
          <h3>Description</h3>
          <p>{application.description}</p>
        </article>

        {latestFeedback ? (
          <section className="decision-note">
            <p className="eyebrow">
              {latestFeedback.newStatus === "RETURNED"
                ? "Returned for changes"
                : "Decision note"}
            </p>
            <blockquote>{latestFeedback.comment}</blockquote>
            <span>
              {latestFeedback.actorName} - {dateTime(latestFeedback.createdAt)}
            </span>
          </section>
        ) : null}

        <div className="action-strip">
          {canEdit ? (
            <>
              <button className="secondary-action" onClick={onEdit} type="button">
                <UserRoundPen size={17} />
                Edit
              </button>
              <button
                className="primary-action"
                disabled={pendingAction !== null}
                onClick={submitDraft}
                type="button"
              >
                <Send size={17} />
                {pendingAction === "SUBMIT" ? pendingSubmitLabel : submitLabel}
              </button>
            </>
          ) : null}
          {canReview ? (
            <ReviewerActions
              comment={comment}
              pendingAction={pendingAction}
              status={application.status}
              onCommentChange={setComment}
              onRunAction={runAction}
            />
          ) : null}
        </div>

        {actionError ? <p className="form-error">{actionError}</p> : null}
      </section>

      <section className="records-panel" aria-label="Case records">
        <RevisionHistory application={application} />
        <AuditTrail application={application} />
      </section>
    </>
  );
}

function latestDecisionNote(application: ApplicationWithAudit) {
  return [...application.auditLog]
    .reverse()
    .find(
      (log) =>
        Boolean(log.comment) &&
        (log.newStatus === "RETURNED" || log.newStatus === "REJECTED")
    );
}

function RevisionHistory({ application }: { application: ApplicationWithAudit }) {
  return (
    <details className="revision-section record-section collapsible-record" open>
      <summary>
        <div>
          <h3>Revision history</h3>
          <small>{application.revisions.length} submitted version(s)</small>
        </div>
        <ChevronDown size={18} />
      </summary>
      <div className="record-content">
        {application.revisions.length === 0 ? (
          <p className="muted">No submitted versions yet</p>
        ) : (
          <ol className="revision-list">
            {application.revisions.map((revision) => (
              <li key={revision.id}>
                <div className="revision-header">
                  <strong>Version {revision.revisionNumber}</strong>
                  <span>
                    {revision.submittedByName} - {dateTime(revision.submittedAt)}
                  </span>
                </div>
                <h4>{revision.title}</h4>
                <div className="revision-meta">
                  <span>{categoryLabel(revision.category)}</span>
                  <span>{money(revision.amountCents)}</span>
                </div>
                <p>{revision.description}</p>
              </li>
            ))}
          </ol>
        )}
      </div>
    </details>
  );
}

function AuditTrail({ application }: { application: ApplicationWithAudit }) {
  return (
    <details className="audit-section record-section collapsible-record">
      <summary>
        <div>
          <h3>Audit trail</h3>
          <small>{application.auditLog.length} workflow event(s)</small>
        </div>
        <ChevronDown size={18} />
      </summary>
      <div className="record-content">
        {application.auditLog.length === 0 ? (
          <p className="muted">No transitions recorded</p>
        ) : (
          <ol className="audit-list">
            {application.auditLog.map((log) => (
              <li key={log.id}>
                <span className="audit-dot" aria-hidden="true" />
                <div>
                  <strong>
                    {statusLabel(log.oldStatus)} to {statusLabel(log.newStatus)}
                  </strong>
                  <p>
                    {log.actorName} - {dateTime(log.createdAt)}
                  </p>
                  {log.comment ? <blockquote>{log.comment}</blockquote> : null}
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </details>
  );
}

function ReviewerActions({
  comment,
  pendingAction,
  status,
  onCommentChange,
  onRunAction
}: {
  comment: string;
  pendingAction: string | null;
  status: string;
  onCommentChange: (value: string) => void;
  onRunAction: (action: WorkflowAction) => void;
}) {
  const hasComment = comment.trim().length > 0;

  return (
    <div className="reviewer-actions">
      <div className="reviewer-action-header">
        <span>Decision note</span>
        <small>Required for return or reject</small>
      </div>
      <textarea
        aria-label="Comment"
        onChange={(event) => onCommentChange(event.target.value)}
        placeholder="Comment"
        rows={2}
        value={comment}
      />
      <div className="reviewer-button-row">
        {status === "SUBMITTED" ? (
          <button
            className="secondary-action review-action"
            disabled={pendingAction !== null}
            onClick={() => onRunAction("START_REVIEW")}
            type="button"
          >
            <Timer size={17} />
            Start review
          </button>
        ) : null}
        <button
          className="approve-action"
          disabled={pendingAction !== null}
          onClick={() => onRunAction("APPROVE")}
          type="button"
        >
          <CheckCircle2 size={17} />
          Approve
        </button>
        <button
          className="secondary-action warning-action"
          disabled={pendingAction !== null || !hasComment}
          onClick={() => onRunAction("RETURN_CHANGES")}
          type="button"
        >
          <RotateCcw size={17} />
          Return
        </button>
        <button
          className="danger-action"
          disabled={pendingAction !== null || !hasComment}
          onClick={() => onRunAction("REJECT")}
          type="button"
        >
          <ThumbsDown size={17} />
          Reject
        </button>
      </div>
    </div>
  );
}
