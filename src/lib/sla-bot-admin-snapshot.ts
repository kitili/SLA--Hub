import "server-only";

import { riskLevel } from "@/lib/at-risk";
import { slaBotRepo } from "@/lib/db/repositories";
import { getMemberMonitorOverview } from "@/lib/db/queries/admin";
import { listAllCandidates } from "@/lib/hiring/pipeline";
import { STAGE_LABELS, type CandidateStage } from "@/lib/hiring/types";
import {
  focusSnapshotOnQuery,
  formatAdminSnapshot,
  type AdminSnapshotAlert,
  type AdminSnapshotCandidate,
  type AdminSnapshotMember,
} from "@/lib/sla-bot-admin";

export {
  focusSnapshotOnQuery,
  formatAdminSnapshot,
} from "@/lib/sla-bot-admin";

export async function loadAdminSnapshot(query: string): Promise<string> {
  const now = new Date();
  const [overview, alerts, candidates] = await Promise.all([
    getMemberMonitorOverview(),
    slaBotRepo.listOpenAlerts(20),
    listAllCandidates(),
  ]);

  const members: AdminSnapshotMember[] = overview.members.map((m) => ({
    fullName: m.fullName,
    email: m.email,
    campus: m.campus,
    completionPct: m.completionPct,
    complete: m.complete,
    risk: riskLevel({
      startedAt: m.startedAt,
      completionPct: m.completionPct,
      lastActiveAt: m.lastActiveAt,
      now,
    }),
  }));

  const snapshotAlerts: AdminSnapshotAlert[] = alerts.map((a) => ({
    kind: a.kind,
    summary: a.summary,
    memberName: a.memberName,
  }));

  const snapshotCandidates: AdminSnapshotCandidate[] = candidates.map((c) => ({
    fullName: c.full_name,
    roleApplied: c.role_applied,
    stage:
      STAGE_LABELS[c.stage as CandidateStage] ?? c.stage.replaceAll("_", " "),
  }));

  const formatted = formatAdminSnapshot({
    members,
    alerts: snapshotAlerts,
    candidates: snapshotCandidates,
  });
  return focusSnapshotOnQuery(formatted, query, members, snapshotCandidates);
}
