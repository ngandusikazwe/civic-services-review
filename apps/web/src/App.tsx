import { useCallback, useEffect, useMemo, useState } from "react";
import type { ApplicationStatus, WorkflowAction } from "@workflow/workflow";
import { ApplicationDetail } from "./components/ApplicationDetail";
import { ApplicationForm } from "./components/ApplicationForm";
import { ApplicationList } from "./components/ApplicationList";
import { Login } from "./components/Login";
import {
  createApplication,
  getApplication,
  listApplications,
  submitApplication,
  transitionApplication,
  updateApplication
} from "./lib/api";
import { statusLabel } from "./lib/format";
import type {
  Application,
  ApplicationPayload,
  ApplicationWithAudit,
  Session
} from "./types";

type WorkspaceMode = "detail" | "create" | "edit";

const statusFilters: Array<ApplicationStatus | "ALL"> = [
  "ALL",
  "SUBMITTED",
  "UNDER_REVIEW",
  "RETURNED",
  "DRAFT",
  "APPROVED",
  "REJECTED"
];

export function App() {
  const [session, setSession] = useState<Session | null>(() => readSession());
  const [applications, setApplications] = useState<Application[]>([]);
  const [summaryApplications, setSummaryApplications] = useState<Application[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ApplicationWithAudit | null>(null);
  const [statusFilter, setStatusFilter] = useState<ApplicationStatus | "ALL">("ALL");
  const [mode, setMode] = useState<WorkspaceMode>("detail");
  const [loadingList, setLoadingList] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const visibleFilter = session?.user.role === "REVIEWER" ? statusFilter : "ALL";
  const summaryItems = useMemo(
    () => buildSummaryItems(summaryApplications, session?.user.role ?? "APPLICANT"),
    [session?.user.role, summaryApplications]
  );

  const refreshList = useCallback(async () => {
    if (!session) {
      return;
    }

    setLoadingList(true);
    setError(null);

    try {
      const dataPromise = listApplications(
        session,
        visibleFilter === "ALL" ? undefined : visibleFilter
      );
      const summaryPromise =
        session.user.role === "REVIEWER" && visibleFilter !== "ALL"
          ? listApplications(session)
          : dataPromise;
      const [data, summaryData] = await Promise.all([dataPromise, summaryPromise]);

      setApplications(data);
      setSummaryApplications(summaryData);
      setSelectedId((current) =>
        current && data.some((application) => application.id === current)
          ? current
          : data[0]?.id ?? null
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load requests.");
    } finally {
      setLoadingList(false);
    }
  }, [session, visibleFilter]);

  const refreshDetail = useCallback(
    async (id: string | null) => {
      if (!session || !id) {
        setDetail(null);
        return;
      }

      setLoadingDetail(true);
      setError(null);

      try {
        setDetail(await getApplication(session, id));
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Could not load request.");
        setDetail(null);
      } finally {
        setLoadingDetail(false);
      }
    },
    [session]
  );

  useEffect(() => {
    void refreshList();
  }, [refreshList]);

  useEffect(() => {
    if (mode === "detail") {
      void refreshDetail(selectedId);
    }
  }, [mode, refreshDetail, selectedId]);

  function handleLogin(nextSession: Session) {
    localStorage.setItem("approval-desk-session", JSON.stringify(nextSession));
    setSession(nextSession);
    setSelectedId(null);
    setMode("detail");
  }

  function logout() {
    localStorage.removeItem("approval-desk-session");
    setSession(null);
    setApplications([]);
    setSummaryApplications([]);
    setDetail(null);
    setSelectedId(null);
  }

  async function saveNewApplication(payload: ApplicationPayload) {
    if (!session) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const created = await createApplication(session, payload);
      setNotice("Draft saved.");
      setMode("detail");
      setSelectedId(created.id);
      await refreshList();
    } finally {
      setSaving(false);
    }
  }

  async function saveExistingApplication(payload: ApplicationPayload) {
    if (!session || !detail) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await updateApplication(session, detail.id, payload);
      setNotice(detail.status === "RETURNED" ? "Returned request updated." : "Draft updated.");
      setMode("detail");
      await refreshList();
      await refreshDetail(detail.id);
    } finally {
      setSaving(false);
    }
  }

  async function submitDraft() {
    if (!session || !detail) {
      return;
    }

    await submitApplication(session, detail.id);
    setNotice(detail.status === "RETURNED" ? "Request resubmitted." : "Request submitted.");
    await refreshList();
    await refreshDetail(detail.id);
  }

  async function runTransition(action: WorkflowAction, comment?: string) {
    if (!session || !detail) {
      return;
    }

    await transitionApplication(session, detail.id, action, comment);
    setNotice("Workflow updated.");
    await refreshList();
    await refreshDetail(detail.id);
  }

  const selectedApplicationForEdit = useMemo(
    () => (mode === "edit" ? detail ?? undefined : undefined),
    [detail, mode]
  );

  if (!session) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <main className="app-shell">
      <div className="app-layout">
        <ApplicationList
          activeId={selectedId}
          applications={applications}
          loading={loadingList}
          session={session}
          onLogout={logout}
          onCreate={() => {
            setMode("create");
            setDetail(null);
          }}
          onSelect={(id) => {
            setSelectedId(id);
            setMode("detail");
          }}
        />

        <section className="workspace-column">
          {session.user.role === "REVIEWER" ? (
            <nav className="status-tabs" aria-label="Status filter">
              {statusFilters.map((status) => (
                <button
                  className={statusFilter === status ? "selected" : ""}
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  type="button"
                >
                  {status === "ALL" ? "All" : statusLabel(status)}
                </button>
              ))}
            </nav>
          ) : null}

          <section className="summary-strip" aria-label="Request summary">
            {summaryItems.map((item) => (
              <div className="summary-item" key={item.label}>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </div>
            ))}
          </section>

          {notice ? (
            <button className="notice" onClick={() => setNotice(null)} type="button">
              {notice}
            </button>
          ) : null}
          {error ? (
            <button className="app-error" onClick={() => setError(null)} type="button">
              {error}
            </button>
          ) : null}

          {mode === "create" || mode === "edit" ? (
            <ApplicationForm
              application={selectedApplicationForEdit}
              loading={saving}
              onCancel={() => setMode("detail")}
              onSubmit={mode === "create" ? saveNewApplication : saveExistingApplication}
            />
          ) : (
            <ApplicationDetail
              application={detail}
              loading={loadingDetail}
              session={session}
              onEdit={() => setMode("edit")}
              onSubmitDraft={submitDraft}
              onTransition={runTransition}
            />
          )}
        </section>
      </div>
    </main>
  );
}

function buildSummaryItems(applications: Application[], role: Session["user"]["role"]) {
  const count = (status: ApplicationStatus) =>
    applications.filter((application) => application.status === status).length;

  if (role === "REVIEWER") {
    return [
      { label: "New intake", value: count("SUBMITTED") },
      { label: "Assessment", value: count("UNDER_REVIEW") },
      { label: "With citizen", value: count("RETURNED") },
      { label: "Closed files", value: count("APPROVED") + count("REJECTED") }
    ];
  }

  return [
    { label: "Draft files", value: count("DRAFT") },
    { label: "At council", value: count("SUBMITTED") + count("UNDER_REVIEW") },
    { label: "Needs changes", value: count("RETURNED") },
    { label: "Closed files", value: count("APPROVED") + count("REJECTED") }
  ];
}

function readSession(): Session | null {
  const raw = localStorage.getItem("approval-desk-session");

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as Session;
  } catch {
    localStorage.removeItem("approval-desk-session");
    return null;
  }
}
