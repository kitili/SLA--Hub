import { connection } from "next/server";
import { setRequestLocale } from "next-intl/server";

import BoardOffline from "@/components/academics/BoardOffline";
import KgBoard, { type KgBoardStudent } from "@/components/kg/KgBoard";
import { getCurrentUser } from "@/lib/auth";
import { loadKgSnapshot } from "@/lib/kg/load";
import { KG_CAMPUSES, KG_CLASSES, KG_DOMAINS, TOTAL_ITEMS } from "@/lib/kg/score";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function KgChecklistPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  await connection();
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await getCurrentUser();
  const admin = Boolean(user?.isAdmin);

  try {
    const loaded = await loadKgSnapshot();
    const snapshot = loaded?.data;
    const students: KgBoardStudent[] = (snapshot?.students ?? []).map((student) => ({
      campus: student.campus,
      className: student.className,
      teacher: student.teacher,
      name: admin ? student.name : null,
      rounds: student.rounds.map((round) => ({
        status: round.status,
        indexNum: round.indexNum,
        indexLabel: round.indexLabel,
        cat: round.cat,
        flagged: round.flagged,
        done: round.done,
        domainCats: round.domainCats,
        flagReasons: admin ? round.flagReasons : [],
      })),
    }));
    const devices = snapshot?.devices ?? [];
    const hasRecords = students.length > 0 || devices.length > 0;
    return (
      <>
        <BoardOffline />
        <KgBoard
        students={students}
        devices={devices}
        campuses={snapshot?.campuses ?? KG_CAMPUSES}
        classes={snapshot?.classes ?? KG_CLASSES}
        domains={KG_DOMAINS.map((domain) => domain.name)}
        totalItems={TOTAL_ITEMS}
        admin={admin}
        source={!loaded || !hasRecords ? "empty" : loaded.source}
      />
      </>
    );
  } catch (error) {
    console.error("[kg]", error instanceof Error ? error.name : "error");
    return <p>The KG checklist could not be loaded. The shared database did not respond.</p>;
  }
}
