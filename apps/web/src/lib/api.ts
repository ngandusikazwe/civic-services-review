import type {
  Application,
  ApplicationPayload,
  ApplicationWithAudit,
  Session
} from "../types";
import type { ApplicationStatus, WorkflowAction } from "@workflow/workflow";

const apiUrl = import.meta.env.VITE_API_URL ?? "/api";

type ApiErrorBody = {
  error?: {
    code?: string;
    message?: string;
  };
};

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string
  ) {
    super(message);
  }
}

export async function login(email: string, password: string): Promise<Session> {
  const body = await request<{ token: string; user: Session["user"] }>("/auth/login", {
    method: "POST",
    body: { email, password }
  });

  return {
    token: body.token,
    user: body.user
  };
}

export async function listApplications(
  session: Session,
  status?: ApplicationStatus
): Promise<Application[]> {
  const query = status ? `?status=${status}` : "";
  const body = await request<{ applications: Application[] }>(`/applications${query}`, {
    token: session.token
  });

  return body.applications;
}

export async function getApplication(
  session: Session,
  id: string
): Promise<ApplicationWithAudit> {
  const body = await request<{ application: ApplicationWithAudit }>(`/applications/${id}`, {
    token: session.token
  });

  return body.application;
}

export async function createApplication(
  session: Session,
  payload: ApplicationPayload
): Promise<Application> {
  const body = await request<{ application: Application }>("/applications", {
    method: "POST",
    token: session.token,
    body: payload
  });

  return body.application;
}

export async function updateApplication(
  session: Session,
  id: string,
  payload: ApplicationPayload
): Promise<Application> {
  const body = await request<{ application: Application }>(`/applications/${id}`, {
    method: "PATCH",
    token: session.token,
    body: payload
  });

  return body.application;
}

export async function submitApplication(
  session: Session,
  id: string
): Promise<ApplicationWithAudit> {
  const body = await request<{ application: ApplicationWithAudit }>(
    `/applications/${id}/submit`,
    {
      method: "POST",
      token: session.token
    }
  );

  return body.application;
}

export async function transitionApplication(
  session: Session,
  id: string,
  action: WorkflowAction,
  comment?: string
): Promise<ApplicationWithAudit> {
  const body = await request<{ application: ApplicationWithAudit }>(
    `/applications/${id}/transitions`,
    {
      method: "POST",
      token: session.token,
      body: { action, comment }
    }
  );

  return body.application;
}

async function request<T>(
  path: string,
  options: {
    method?: string;
    token?: string;
    body?: unknown;
  } = {}
): Promise<T> {
  const response = await fetch(`${apiUrl}${path}`, {
    method: options.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {})
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body)
  });

  const data = (await response.json().catch(() => ({}))) as ApiErrorBody;

  if (!response.ok) {
    throw new ApiError(
      response.status,
      data.error?.code ?? "REQUEST_FAILED",
      data.error?.message ?? "Request failed."
    );
  }

  return data as T;
}
