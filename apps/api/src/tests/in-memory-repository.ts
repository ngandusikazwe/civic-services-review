import crypto from "node:crypto";
import type { ApplicationStatus } from "@workflow/workflow";
import { conflict, notFound } from "../http/errors.js";
import { hashPassword } from "../http/auth.js";
import type { ApplicationRepository } from "../repositories/application-repository.js";
import type {
  ApplicationPayload,
  ApplicationRecord,
  ApplicationRevisionRecord,
  ApplicationWithAudit,
  AuditLogRecord,
  TransitionParams,
  User
} from "../types.js";

export class InMemoryApplicationRepository implements ApplicationRepository {
  private readonly users = new Map<string, User>();
  private readonly applications = new Map<string, ApplicationRecord>();
  private readonly auditLogs: AuditLogRecord[] = [];
  private readonly revisions: ApplicationRevisionRecord[] = [];

  constructor() {
    const passwordHash = hashPassword("password123");

    this.addUser({
      id: "applicant-1",
      name: "Amina Banda",
      email: "alice@example.com",
      passwordHash,
      role: "APPLICANT"
    });
    this.addUser({
      id: "applicant-2",
      name: "Noah Phiri",
      email: "ben@example.com",
      passwordHash,
      role: "APPLICANT"
    });
    this.addUser({
      id: "reviewer-1",
      name: "Chanda Mwila",
      email: "reviewer@example.com",
      passwordHash,
      role: "REVIEWER"
    });

    this.applications.set("submitted-1", {
      id: "submitted-1",
      ownerId: "applicant-1",
      title: "Drainage repair near Kamwala clinic",
      category: "PUBLIC_WORKS",
      description: "Storm water is collecting near the clinic entrance after heavy rain.",
      amountCents: 450000,
      status: "SUBMITTED",
      createdAt: now(),
      updatedAt: now()
    });
    this.recordRevision("submitted-1", "applicant-1");
  }

  async findUserByEmail(email: string): Promise<User | null> {
    const normalized = email.toLowerCase();
    return (
      [...this.users.values()].find((user) => user.email.toLowerCase() === normalized) ??
      null
    );
  }

  async findUserById(id: string): Promise<User | null> {
    return this.users.get(id) ?? null;
  }

  async listApplications(params: {
    user: User;
    status?: ApplicationStatus;
  }): Promise<ApplicationRecord[]> {
    return [...this.applications.values()].filter((application) => {
      const visible =
        params.user.role === "REVIEWER" || application.ownerId === params.user.id;
      const statusMatches = params.status ? application.status === params.status : true;
      return visible && statusMatches;
    });
  }

  async getApplication(id: string): Promise<ApplicationWithAudit | null> {
    const application = this.applications.get(id);

    if (!application) {
      return null;
    }

    const owner = this.users.get(application.ownerId);

    if (!owner) {
      throw notFound("Owner not found.");
    }

    return {
      ...application,
      owner: {
        id: owner.id,
        name: owner.name,
        email: owner.email
      },
      auditLog: this.auditLogs.filter((log) => log.applicationId === id),
      revisions: this.revisions
        .filter((revision) => revision.applicationId === id)
        .sort((first, second) => second.revisionNumber - first.revisionNumber)
    };
  }

  async createApplication(params: {
    ownerId: string;
    payload: ApplicationPayload;
  }): Promise<ApplicationRecord> {
    const application: ApplicationRecord = {
      id: crypto.randomUUID(),
      ownerId: params.ownerId,
      ...params.payload,
      status: "DRAFT",
      createdAt: now(),
      updatedAt: now()
    };

    this.applications.set(application.id, application);
    return application;
  }

  async updateDraft(params: {
    applicationId: string;
    payload: ApplicationPayload;
  }): Promise<ApplicationRecord> {
    const application = this.applications.get(params.applicationId);

    if (!application) {
      throw notFound("Application not found.");
    }

    if (application.status !== "DRAFT" && application.status !== "RETURNED") {
      throw conflict("Only draft or returned applications can be edited.", "NOT_DRAFT");
    }

    const updated = {
      ...application,
      ...params.payload,
      updatedAt: now()
    };

    this.applications.set(updated.id, updated);
    return updated;
  }

  async transition(params: TransitionParams): Promise<ApplicationWithAudit> {
    const application = this.applications.get(params.applicationId);

    if (!application) {
      throw notFound("Application not found.");
    }

    if (application.status !== params.expectedOldStatus) {
      throw conflict("The application status changed before this action was applied.");
    }

    const updated = {
      ...application,
      status: params.newStatus,
      updatedAt: now()
    };
    this.applications.set(updated.id, updated);

    const actor = this.users.get(params.actorId);

    if (params.recordRevision) {
      this.recordRevision(params.applicationId, params.actorId);
    }

    this.auditLogs.push({
      id: String(this.auditLogs.length + 1),
      applicationId: params.applicationId,
      actorId: params.actorId,
      actorName: actor?.name ?? "Unknown",
      oldStatus: params.expectedOldStatus,
      newStatus: params.newStatus,
      comment: params.comment ?? null,
      createdAt: now()
    });

    const withAudit = await this.getApplication(params.applicationId);

    if (!withAudit) {
      throw notFound("Application not found.");
    }

    return withAudit;
  }

  private addUser(user: User) {
    this.users.set(user.id, user);
  }

  private recordRevision(applicationId: string, submittedBy: string) {
    const application = this.applications.get(applicationId);

    if (!application) {
      throw notFound("Application not found.");
    }

    const submitter = this.users.get(submittedBy);
    const revisionNumber =
      this.revisions.filter((revision) => revision.applicationId === applicationId)
        .length + 1;

    this.revisions.push({
      id: String(this.revisions.length + 1),
      applicationId,
      revisionNumber,
      title: application.title,
      category: application.category,
      description: application.description,
      amountCents: application.amountCents,
      submittedBy,
      submittedByName: submitter?.name ?? "Unknown",
      submittedAt: now()
    });
  }
}

function now() {
  return new Date().toISOString();
}
