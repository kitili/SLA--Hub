"use client";

import { VisitRecord } from "@/domain/Visit";
import { signOutVisit } from "@/lib/visits-client";

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function VisitorBoard({
  visits,
  onChanged,
  onToast,
}: {
  visits: VisitRecord[];
  onChanged: () => void;
  onToast: (message: string) => void;
}) {
  async function signOut(id: string) {
    try {
      const visit = await signOutVisit(id);
      onToast(`Signed out ${visit.name}`);
      onChanged();
    } catch (error) {
      onToast(error instanceof Error ? error.message : "Could not sign out.");
    }
  }

  return (
    <div className="card">
      <div className="board-head">
        <h2>On site now</h2>
        <span className="count">
          {visits.length} {visits.length === 1 ? "visitor" : "visitors"}
        </span>
      </div>
      <div className="visitor-list">
        {visits.length === 0 ? (
          <div className="empty">No one signed in yet at this campus today.</div>
        ) : (
          visits.map((visit) => (
            <div className="visitor-row" key={visit.id}>
              <div className="avatar">
                {visit.photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={visit.photo} alt="" />
                ) : (
                  initials(visit.name)
                )}
              </div>
              <div className="visitor-info">
                <div className="name">{visit.name}</div>
                <div className="meta">
                  {visit.purpose} · visiting {visit.host}
                  {visit.source === "self" ? " · self check-in" : ""}
                </div>
              </div>
              <div className="visitor-time">In {formatTime(visit.signedInAt)}</div>
              <button type="button" className="signout-btn" onClick={() => signOut(visit.id)}>
                Sign out
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
