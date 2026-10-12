import "@/components/curriculum/feedback.css";
import { setRequestLocale } from "next-intl/server";

import CoverageBoard from "@/components/curriculum/CoverageBoard";
import { loadCoverage } from "@/lib/curriculum-coverage/load";
import { buildCoverageModel } from "@/lib/curriculum-coverage/model";

export const dynamic = "force-dynamic";

export default async function CurriculumPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  try {
    const loaded = await loadCoverage();
    if (!loaded) {
      return (
        <section className="cfa">
          <header className="top">
            <div className="htext">
              <span className="hsup">Silverleaf Academy</span>
              <h1>Curriculum dashboard</h1>
            </div>
          </header>
          <p>
            The coverage snapshot is not in the shared database yet, and there is no copy saved on
            this computer. The Google Sheets stay private to the school account.
          </p>
        </section>
      );
    }
    return (
      <>
        {loaded.source === "offline" ? <p>Showing the copy saved on this computer.</p> : null}
        <CoverageBoard model={buildCoverageModel(loaded.data)} />
      </>
    );
  } catch (error) {
    console.error("[curriculum]", error instanceof Error ? error.name : "error");
    return <p>Silverleaf Curriculum could not be loaded. The shared database did not respond.</p>;
  }
}
