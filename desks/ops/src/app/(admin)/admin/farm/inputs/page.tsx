import { listInputs } from "@/lib/db/farm";
import { FarmSubnav } from "@/components/farm/FarmSubnav";
import { InputsClient } from "@/components/farm/InputsClient";

export default async function FarmInputsPage() {
  const inputs = await listInputs();

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <p className="text-xs font-semibold uppercase tracking-wide text-electric-blue">
        Admin · Farm
      </p>
      <h1 className="mt-1 text-2xl font-bold text-electric-blue">
        Inputs &amp; stock
      </h1>
      <p className="mt-2 max-w-2xl text-sm text-ink-muted">
        Track seed/fertilizer/tool stock levels so nothing runs out
        mid-season — low-stock items also raise SMS alerts via the
        farm-alerts cron.
      </p>

      <FarmSubnav active="inputs" />

      <div className="mt-2">
        <InputsClient initialInputs={inputs} />
      </div>
    </main>
  );
}
