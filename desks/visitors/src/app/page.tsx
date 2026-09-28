import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";
import { CAMPUS_HUB } from "@/lib/campus-routes";

export default function HomePage() {
  return (
    <div className="hub-shell">
      <div className="hub-hero">
        <BrandLogo variant="brandmark" height={52} priority />
        <h1>Silverleaf Visitor Log</h1>
        <p>Choose your campus dashboard — no login required.</p>
      </div>
      <div className="campus-hub-grid">
        {CAMPUS_HUB.map((campus) => (
          <Link
            key={campus.slug}
            href={campus.href}
            className="campus-hub-card card"
            style={{ background: campus.gradient }}
          >
            <span className="campus-hub-name">{campus.name}</span>
            <span className="campus-hub-cta">Open front desk →</span>
          </Link>
        ))}
      </div>
      <p className="footnote hub-footnote">
        Visitors can self check-in by scanning the{" "}
        <a href="/qr">QR check-in poster</a> inside any campus dashboard.
      </p>
    </div>
  );
}
