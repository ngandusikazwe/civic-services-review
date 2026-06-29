import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import path from "node:path";
import {
  canEditDraft,
  transitionApplication,
  type WorkflowAction
} from "@workflow/workflow";
import type { ApplicationRepository } from "../repositories/application-repository.js";
import type { ApplicationWithAudit, User } from "../types.js";
import { asyncHandler } from "./async-handler.js";
import {
  badRequest,
  conflict,
  forbidden,
  HttpError,
  notFound,
  unauthorized
} from "./errors.js";
import {
  authMiddleware,
  type AuthenticatedRequest,
  signToken,
  verifyPassword
} from "./auth.js";
import { parseApplicationPayload, parseStatusQuery } from "./validation.js";

type CreateAppParams = {
  repo: ApplicationRepository;
  jwtSecret: string;
  webOrigin: string;
  webDistPath?: string;
};

const transitionActions: WorkflowAction[] = [
  "START_REVIEW",
  "APPROVE",
  "REJECT",
  "RETURN_CHANGES"
];

export function createApp(params: CreateAppParams) {
  const app = express();

  app.use(
    cors({
      origin: params.webOrigin,
      credentials: false
    })
  );
  app.use(express.json({ limit: "1mb" }));

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.post(
    "/api/auth/login",
    asyncHandler(async (req, res) => {
      const { email, password } = parseLogin(req.body);
      const user = await params.repo.findUserByEmail(email);

      if (!user || !verifyPassword(password, user.passwordHash)) {
        throw unauthorized("Invalid email or password.");
      }

      res.json({
        token: signToken({
          user,
          secret: params.jwtSecret
        }),
        user: publicUser(user)
      });
    })
  );

  const api = express.Router();
  api.use(authMiddleware(params.repo, params.jwtSecret));

  api.get("/me", (req, res) => {
    res.json({ user: publicUser((req as AuthenticatedRequest).user) });
  });

  api.get(
    "/applications",
    asyncHandler(async (req, res) => {
      const user = (req as AuthenticatedRequest).user;
      const status = parseStatusQuery(req.query.status);
      const applications = await params.repo.listApplications({ user, status });

      res.json({ applications });
    })
  );

  api.post(
    "/applications",
    asyncHandler(async (req, res) => {
      const user = (req as AuthenticatedRequest).user;

      if (user.role !== "APPLICANT") {
        throw forbidden("Only applicants can create applications.");
      }

      const application = await params.repo.createApplication({
        ownerId: user.id,
        payload: parseApplicationPayload(req.body)
      });

      res.status(201).json({ application });
    })
  );

  api.get(
    "/applications/:id",
    asyncHandler(async (req, res) => {
      const user = (req as AuthenticatedRequest).user;
      const application = await getVisibleApplication(params.repo, paramId(req), user);

      res.json({ application });
    })
  );

  api.patch(
    "/applications/:id",
    asyncHandler(async (req, res) => {
      const user = (req as AuthenticatedRequest).user;
      const application = await getVisibleApplication(params.repo, paramId(req), user);
      const editCheck = canEditDraft({
        status: application.status,
        actorRole: user.role,
        isOwner: application.ownerId === user.id
      });

      if (!editCheck.ok) {
        throw new HttpError(editCheck.statusCode, editCheck.code, editCheck.message);
      }

      const updated = await params.repo.updateDraft({
        applicationId: application.id,
        payload: parseApplicationPayload(req.body)
      });

      res.json({ application: updated });
    })
  );

  api.post(
    "/applications/:id/submit",
    asyncHandler(async (req, res) => {
      const user = (req as AuthenticatedRequest).user;
      const application = await getVisibleApplication(params.repo, paramId(req), user);
      const transition = transitionApplication({
        currentStatus: application.status,
        action: "SUBMIT",
        actorRole: user.role,
        isOwner: application.ownerId === user.id
      });

      if (!transition.ok) {
        throw new HttpError(transition.statusCode, transition.code, transition.message);
      }

      const updated = await params.repo.transition({
        applicationId: application.id,
        actorId: user.id,
        expectedOldStatus: transition.oldStatus,
        newStatus: transition.newStatus,
        comment: null,
        recordRevision: true
      });

      res.json({ application: updated });
    })
  );

  api.post(
    "/applications/:id/transitions",
    asyncHandler(async (req, res) => {
      const user = (req as AuthenticatedRequest).user;
      const action = parseWorkflowAction(req.body);
      const comment = parseOptionalComment(req.body);
      const application = await getVisibleApplication(params.repo, paramId(req), user);
      const transition = transitionApplication({
        currentStatus: application.status,
        action,
        actorRole: user.role,
        isOwner: application.ownerId === user.id,
        comment
      });

      if (!transition.ok) {
        throw new HttpError(transition.statusCode, transition.code, transition.message);
      }

      const updated = await params.repo.transition({
        applicationId: application.id,
        actorId: user.id,
        expectedOldStatus: transition.oldStatus,
        newStatus: transition.newStatus,
        comment
      });

      res.json({ application: updated });
    })
  );

  app.use("/api", api);

  if (params.webDistPath) {
    app.use(express.static(params.webDistPath));
    app.use((req, res, next) => {
      if (req.method !== "GET" || req.path.startsWith("/api")) {
        next();
        return;
      }

      res.sendFile(path.join(params.webDistPath!, "index.html"));
    });
  }

  app.use(errorHandler);

  return app;
}

function parseLogin(body: unknown): { email: string; password: string } {
  if (!body || typeof body !== "object") {
    throw badRequest("Request body must be an object.");
  }

  const value = body as Record<string, unknown>;

  if (typeof value.email !== "string" || typeof value.password !== "string") {
    throw badRequest("email and password are required.");
  }

  return {
    email: value.email.trim().toLowerCase(),
    password: value.password
  };
}

function parseWorkflowAction(body: unknown): WorkflowAction {
  if (!body || typeof body !== "object") {
    throw badRequest("Request body must be an object.");
  }

  const value = body as Record<string, unknown>;

  if (typeof value.action !== "string" || !transitionActions.includes(value.action as WorkflowAction)) {
    throw badRequest("Invalid workflow action.", {
      allowed: transitionActions
    });
  }

  return value.action as WorkflowAction;
}

function parseOptionalComment(body: unknown): string | null {
  if (!body || typeof body !== "object") {
    return null;
  }

  const comment = (body as Record<string, unknown>).comment;

  if (comment === undefined || comment === null) {
    return null;
  }

  if (typeof comment !== "string" || comment.trim().length > 500) {
    throw badRequest("comment must be a string up to 500 characters.");
  }

  return comment.trim() || null;
}

async function getVisibleApplication(
  repo: ApplicationRepository,
  id: string,
  user: User
): Promise<ApplicationWithAudit> {
  const application = await repo.getApplication(id);

  if (!application) {
    throw notFound("Application not found.");
  }

  if (user.role === "APPLICANT" && application.ownerId !== user.id) {
    throw forbidden("Applicants can only access their own applications.");
  }

  return application;
}

function paramId(req: Request): string {
  const value = req.params.id;

  if (typeof value !== "string" || value.length === 0) {
    throw notFound("Application not found.");
  }

  return value;
}

function publicUser(user: User) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role
  };
}

function errorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  if (error instanceof HttpError) {
    res.status(error.status).json({
      error: {
        code: error.code,
        message: error.message,
        details: error.details
      }
    });
    return;
  }

  if (error instanceof SyntaxError) {
    res.status(400).json({
      error: {
        code: "INVALID_JSON",
        message: "Request body contains invalid JSON."
      }
    });
    return;
  }

  console.error(error);
  res.status(500).json({
    error: {
      code: "INTERNAL_ERROR",
      message: "Something went wrong."
    }
  });
}
