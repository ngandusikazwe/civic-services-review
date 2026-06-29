import crypto from "node:crypto";
import type { Pool, PoolClient, QueryResultRow } from "pg";
import { conflict, notFound } from "../http/errors.js";
import type {
  ApplicationPayload,
  ApplicationRecord,
  ApplicationRevisionRecord,
  ApplicationWithAudit,
  AuditLogRecord,
  TransitionParams,
  User
} from "../types.js";
import type { ApplicationRepository } from "./application-repository.js";
import type { ApplicationStatus } from "@workflow/workflow";

export class PgApplicationRepository implements ApplicationRepository {
  constructor(private readonly pool: Pool) {}

  async findUserByEmail(email: string): Promise<User | null> {
    const result = await this.pool.query(
      `select id, name, email, password_hash, role
       from users
       where lower(email) = lower($1)`,
      [email]
    );

    return result.rows[0] ? mapUser(result.rows[0]) : null;
  }

  async findUserById(id: string): Promise<User | null> {
    const result = await this.pool.query(
      `select id, name, email, password_hash, role
       from users
       where id = $1`,
      [id]
    );

    return result.rows[0] ? mapUser(result.rows[0]) : null;
  }

  async listApplications(params: {
    user: User;
    status?: ApplicationStatus;
  }): Promise<ApplicationRecord[]> {
    const values: unknown[] = [];
    const filters: string[] = [];

    if (params.user.role === "APPLICANT") {
      values.push(params.user.id);
      filters.push(`owner_id = $${values.length}`);
    }

    if (params.status) {
      values.push(params.status);
      filters.push(`status = $${values.length}`);
    }

    const where = filters.length ? `where ${filters.join(" and ")}` : "";
    const result = await this.pool.query(
      `select id, owner_id, title, category, description, amount_cents, status, created_at, updated_at
       from applications
       ${where}
       order by updated_at desc`,
      values
    );

    return result.rows.map(mapApplication);
  }

  async getApplication(id: string): Promise<ApplicationWithAudit | null> {
    const applicationResult = await this.pool.query(
      `select a.id,
              a.owner_id,
              a.title,
              a.category,
              a.description,
              a.amount_cents,
              a.status,
              a.created_at,
              a.updated_at,
              u.name as owner_name,
              u.email as owner_email
       from applications a
       join users u on u.id = a.owner_id
       where a.id = $1`,
      [id]
    );

    if (!applicationResult.rows[0]) {
      return null;
    }

    const auditResult = await this.pool.query(
      `select l.id,
              l.application_id,
              l.actor_id,
              u.name as actor_name,
              l.old_status,
              l.new_status,
              l.comment,
              l.created_at
       from audit_logs l
       join users u on u.id = l.actor_id
       where l.application_id = $1
       order by l.created_at asc, l.id asc`,
      [id]
    );

    const revisionResult = await this.pool.query(
      `select r.id,
              r.application_id,
              r.revision_number,
              r.title,
              r.category,
              r.description,
              r.amount_cents,
              r.submitted_by,
              u.name as submitted_by_name,
              r.submitted_at
       from application_revisions r
       join users u on u.id = r.submitted_by
       where r.application_id = $1
       order by r.revision_number desc`,
      [id]
    );

    return {
      ...mapApplication(applicationResult.rows[0]),
      owner: {
        id: applicationResult.rows[0].owner_id,
        name: applicationResult.rows[0].owner_name,
        email: applicationResult.rows[0].owner_email
      },
      auditLog: auditResult.rows.map(mapAuditLog),
      revisions: revisionResult.rows.map(mapRevision)
    };
  }

  async createApplication(params: {
    ownerId: string;
    payload: ApplicationPayload;
  }): Promise<ApplicationRecord> {
    const result = await this.pool.query(
      `insert into applications (id, owner_id, title, category, description, amount_cents, status)
       values ($1, $2, $3, $4, $5, $6, 'DRAFT')
       returning id, owner_id, title, category, description, amount_cents, status, created_at, updated_at`,
      [
        crypto.randomUUID(),
        params.ownerId,
        params.payload.title,
        params.payload.category,
        params.payload.description,
        params.payload.amountCents
      ]
    );

    return mapApplication(result.rows[0]);
  }

  async updateDraft(params: {
    applicationId: string;
    payload: ApplicationPayload;
  }): Promise<ApplicationRecord> {
    const result = await this.pool.query(
      `update applications
       set title = $2,
           category = $3,
           description = $4,
           amount_cents = $5,
           updated_at = now()
       where id = $1 and status in ('DRAFT', 'RETURNED')
       returning id, owner_id, title, category, description, amount_cents, status, created_at, updated_at`,
      [
        params.applicationId,
        params.payload.title,
        params.payload.category,
        params.payload.description,
        params.payload.amountCents
      ]
    );

    if (!result.rows[0]) {
      throw conflict("Only draft or returned applications can be edited.", "NOT_DRAFT");
    }

    return mapApplication(result.rows[0]);
  }

  async transition(params: TransitionParams): Promise<ApplicationWithAudit> {
    const client = await this.pool.connect();

    try {
      await client.query("begin");
      await this.transitionInsideTransaction(client, params);
      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }

    const updated = await this.getApplication(params.applicationId);

    if (!updated) {
      throw notFound("Application not found.");
    }

    return updated;
  }

  private async transitionInsideTransaction(
    client: PoolClient,
    params: TransitionParams
  ) {
    const current = await client.query(
      `select status, title, category, description, amount_cents
       from applications
       where id = $1
       for update`,
      [params.applicationId]
    );

    if (!current.rows[0]) {
      throw notFound("Application not found.");
    }

    if (current.rows[0].status !== params.expectedOldStatus) {
      throw conflict(
        "The application status changed before this action was applied.",
        "STALE_STATUS"
      );
    }

    await client.query(
      `update applications
       set status = $2,
           updated_at = now()
       where id = $1`,
      [params.applicationId, params.newStatus]
    );

    if (params.recordRevision) {
      await client.query(
        `insert into application_revisions (
           application_id,
           revision_number,
           title,
           category,
           description,
           amount_cents,
           submitted_by
         )
         values (
           $1,
           (
             select coalesce(max(revision_number), 0) + 1
             from application_revisions
             where application_id = $1
           ),
           $2,
           $3,
           $4,
           $5,
           $6
         )`,
        [
          params.applicationId,
          current.rows[0].title,
          current.rows[0].category,
          current.rows[0].description,
          current.rows[0].amount_cents,
          params.actorId
        ]
      );
    }

    await client.query(
      `insert into audit_logs (application_id, actor_id, old_status, new_status, comment)
       values ($1, $2, $3, $4, $5)`,
      [
        params.applicationId,
        params.actorId,
        params.expectedOldStatus,
        params.newStatus,
        params.comment ?? null
      ]
    );
  }
}

function mapUser(row: QueryResultRow): User {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    passwordHash: row.password_hash,
    role: row.role
  };
}

function mapApplication(row: QueryResultRow): ApplicationRecord {
  return {
    id: row.id,
    ownerId: row.owner_id,
    title: row.title,
    category: row.category,
    description: row.description,
    amountCents: row.amount_cents,
    status: row.status,
    createdAt: serializeDate(row.created_at),
    updatedAt: serializeDate(row.updated_at)
  };
}

function mapAuditLog(row: QueryResultRow): AuditLogRecord {
  return {
    id: String(row.id),
    applicationId: row.application_id,
    actorId: row.actor_id,
    actorName: row.actor_name,
    oldStatus: row.old_status,
    newStatus: row.new_status,
    comment: row.comment,
    createdAt: serializeDate(row.created_at)
  };
}

function mapRevision(row: QueryResultRow): ApplicationRevisionRecord {
  return {
    id: String(row.id),
    applicationId: row.application_id,
    revisionNumber: row.revision_number,
    title: row.title,
    category: row.category,
    description: row.description,
    amountCents: row.amount_cents,
    submittedBy: row.submitted_by,
    submittedByName: row.submitted_by_name,
    submittedAt: serializeDate(row.submitted_at)
  };
}

function serializeDate(value: unknown): string {
  return value instanceof Date ? value.toISOString() : String(value);
}
