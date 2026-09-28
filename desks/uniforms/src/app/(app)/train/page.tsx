import Link from "next/link";
import { Card, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";

export default async function TrainPage() {
  await requireUser();
  return (
    <div className="grid gap-6">
      <PageHeader
        title="Usa River walkthrough"
        subtitle="Keep Excel until this campus is trained. Print the size chart for the shop wall."
        actions={
          <Link className="rounded-[10px] border border-card-border bg-white px-3 py-2 text-sm font-semibold text-electric-blue no-underline" href="/size-chart">
            Print size chart
          </Link>
        }
      />
      <Card>
        <h2 className="mb-2 font-semibold">English</h2>
        <ol className="list-decimal space-y-2 pl-5 text-sm">
          <li>Loveness: Sew a job, complete it so pieces land in MAIN. Cloth: log metres bought.</li>
          <li>Imani: Stock → receive city POs into MAIN only. Transfer some to the shop.</li>
          <li>Usa admin: Ask Imani for polos. Imani posts a delivery note.</li>
          <li>Parent: login with SLA/UR/2023/312. Add sibling SLA/UR/2024/088. Order, then pay at the window.</li>
          <li>When paid, click “Kit ready” and open WhatsApp. Parent sees “Come collect”.</li>
          <li>Issue Received all / few. Check Alerts for low sizes.</li>
        </ol>
      </Card>
      <Card>
        <h2 className="mb-2 font-semibold">Kiswahili</h2>
        <ol className="list-decimal space-y-2 pl-5 text-sm">
          <li>Loveness: Andika kazi ya kushona, kamilisha ili sare ziingie MAIN. Nguo: andika mita zilizonunuliwa.</li>
          <li>Imani: Stock — pokea oda za jiji MAIN tu. Hamisha baadhi duka la Usa River.</li>
          <li>Msimamizi wa Usa: Omba polo. Imani andika delivery note.</li>
          <li>Mzazi: ingia na SLA/UR/2023/312. Ongeza ndugu SLA/UR/2024/088. Agiza, kisha lipa dirishani.</li>
          <li>Ikiwa imelipwa, bonyeza “Kit ready” na WhatsApp. Mzazi anaona “Njoo uchukue”.</li>
          <li>Toa sare (zote / chache). Angalia Alerts kwa ukubwa ulioishia.</li>
        </ol>
      </Card>
    </div>
  );
}
