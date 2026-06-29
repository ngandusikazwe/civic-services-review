import type { ApplicationStatus, Role } from "@workflow/workflow";

export type User = {
  id: string;
  name: string;
  email: string;
  role: Role;
};

export type ApplicationCategory =
  | "BUSINESS_PERMIT"
  | "BUILDING_PERMIT"
  | "COMMUNITY_GRANT"
  | "PUBLIC_WORKS"
  | "GENERAL_SERVICE";

export type Application = {
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

export type AuditLog = {
  id: string;
  applicationId: string;
  actorId: string;
  actorName: string;
  oldStatus: ApplicationStatus;
  newStatus: ApplicationStatus;
  comment: string | null;
  createdAt: string;
};

export type ApplicationRevision = {
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

export type ApplicationWithAudit = Application & {
  owner: Pick<User, "id" | "name" | "email">;
  auditLog: AuditLog[];
  revisions: ApplicationRevision[];
};

export type ApplicationPayload = {
  title: string;
  category: ApplicationCategory;
  description: string;
  amountCents: number | null;
};

export type Session = {
  token: string;
  user: User;
};
