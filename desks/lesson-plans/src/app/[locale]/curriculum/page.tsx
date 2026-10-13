import "@/components/curriculum/feedback.css";
import { connection } from "next/server";
import { setRequestLocale } from "next-intl/server";

import BoardOffline from "@/components/academics/BoardOffline";
import CoverageBoard from "@/components/curriculum/CoverageBoard";
import { loadCoverage } from "@/lib/curriculum-coverage/load";
import { buildCoverageModel } from "@/lib/curriculum-coverage/model";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CurriculumPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  await connection();
  const { locale } = await params;
  setRequestLocale(locale);

  try {
    const loaded = await loadCoverage();
    if (!loaded) {
      return (
        <section className="cfa">
          <BoardOffline />
          <header className="top">
            <div className="htext">
              <span className="hsup">Silverleaf Academy</span>
              <h1>Curriculum dashboard</h1>
            </div>
          </header>
          <p>
            The coverage snapshot is not in the shared database yet. Open this page while you are
            online and this device keeps a copy for when you are offline. The Google Sheets stay
            private to the school account.
          </p>
        </section>
      );
    }
    return (
      <>
        <BoardOffline />
        {loaded.source === "offline" ? <p>Showing the last copy saved on this server. It refreshes when the database is reachable.</p> : null}
        <CoverageBoard model={buildCoverageModel(loaded.data)} />
      </>
    );
  } catch (error) {
    console.error("[curriculum]", error instanceof Error ? error.name : "error");
    return <p>Silverleaf Curriculum could not be loaded. The shared database did not respond.</p>;
  }
}
