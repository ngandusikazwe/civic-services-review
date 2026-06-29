import { FileText, Landmark, LogOut, Plus } from "lucide-react";
import type { Application, Session } from "../types";
import { caseReference, categoryLabel, dateTime } from "../lib/format";
import { StatusBadge } from "./StatusBadge";

type ApplicationListProps = {
  applications: Application[];
  activeId: string | null;
  loading: boolean;
  session: Session;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onLogout: () => void;
};

export function ApplicationList({
  applications,
  activeId,
  loading,
  session,
  onSelect,
  onCreate,
  onLogout
}: ApplicationListProps) {
  const roleLabel =
    session.user.role === "REVIEWER" ? "Officer reviewer" : "Citizen requester";

  return (
    <aside className="list-panel" aria-busy={loading}>
      <div className="sidebar-brand">
        <div className="sidebar-brand-row">
          <div className="sidebar-mark" aria-hidden="true">
            <Landmark size={18} />
          </div>
          <div>
            <p>{roleLabel}</p>
            <h1>Civic Services Review</h1>
          </div>
        </div>
        <span>Office of Civic Services - Lusaka</span>
      </div>

      <div className="panel-heading">
        <div>
          <p className="eyebrow">
            {session.user.role === "REVIEWER" ? "Registry" : "My desk"}
          </p>
          <h2>{session.user.role === "REVIEWER" ? "Case register" : "My case files"}</h2>
        </div>
        <span className={`list-count ${loading ? "is-loading" : ""}`}>
          {loading ? "" : applications.length}
        </span>
        {session.user.role === "APPLICANT" ? (
          <button className="icon-button" onClick={onCreate} title="New request" type="button">
            <Plus size={18} />
          </button>
        ) : null}
      </div>

      {loading ? <span className="sr-only">Loading requests...</span> : null}
      {!loading && applications.length === 0 ? (
        <div className="empty-state">
          <FileText size={24} />
          <p>No requests</p>
        </div>
      ) : null}

      <div className="application-list">
        {loading
          ? Array.from({ length: 4 }, (_, index) => (
              <div className="application-row skeleton-row" key={index}>
                <span>
                  <span className="skeleton-chip" />
                  <span className="skeleton-line title" />
                  <span className="skeleton-line short" />
                </span>
              </div>
            ))
          : applications.map((application) => (
              <button
                className={`application-row ${activeId === application.id ? "active" : ""}`}
                key={application.id}
                onClick={() => onSelect(application.id)}
                type="button"
              >
                <span className="row-header">
                  <small className="row-ref">{caseReference(application.id)}</small>
                  <StatusBadge status={application.status} />
                </span>
                <strong className="row-title">{application.title}</strong>
                <span className="row-foot">
                  <small>{categoryLabel(application.category)}</small>
                  <small>{dateTime(application.updatedAt)}</small>
                </span>
              </button>
            ))}
      </div>

      <div className="sidebar-user">
        <div className="sidebar-avatar" aria-hidden="true">
          {session.user.name.slice(0, 1)}
        </div>
        <div>
          <strong>{session.user.name}</strong>
          <span>{session.user.role === "REVIEWER" ? "Officer" : "Citizen"}</span>
        </div>
        <button className="sidebar-logout" onClick={onLogout} title="Sign out" type="button">
          <LogOut size={17} />
        </button>
      </div>
    </aside>
  );
}
