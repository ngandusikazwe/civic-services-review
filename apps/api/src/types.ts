import type { ApplicationStatus, Role } from "@workflow/workflow";

export type User = {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: Role;
};

export type ApplicationCategory =
  | "BUSINESS_PERMIT"
  | "BUILDING_PERMIT"
  | "COMMUNITY_GRANT"
  | "PUBLIC_WORKS"
  | "GENERAL_SERVICE";

export type ApplicationRecord = {
  id: string;
  ownerId: string;
  title: string;
  category: ApplicationCategory;
  description: string;
  amountCents: number | null;
  status: ApplicationStatus;
  createdAt: string;
  updatedAt: string;
};

export type AuditLogRecord = {
  id: string;
  applicationId: string;
  actorId: string;
  actorName: string;
  oldStatus: ApplicationStatus;
  newStatus: ApplicationStatus;
  comment: string | null;
  createdAt: string;
};

export type ApplicationRevisionRecord = {
  id: string;
  applicationId: string;
  revisionNumber: number;
  title: string;
  category: ApplicationCategory;
  description: string;
  amountCents: number | null;
  submittedBy: string;
  submittedByName: string;
  submittedAt: string;
};

export type ApplicationWithAudit = ApplicationRecord & {
  owner: Pick<User, "id" | "name" | "email">;
  auditLog: AuditLogRecord[];
  revisions: ApplicationRevisionRecord[];
};

export type ApplicationPayload = {
  title: string;
  category: ApplicationCategory;
  description: string;
  amountCents: number | null;
};

export type TransitionParams = {
  applicationId: string;
  actorId: string;
  expectedOldStatus: ApplicationStatus;
  newStatus: ApplicationStatus;
  comment?: string | null;
  recordRevision?: boolean;
};
