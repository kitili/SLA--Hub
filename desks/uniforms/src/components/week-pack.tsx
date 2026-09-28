import { CopyText } from "@/components/copy-text";
import { ghostClass } from "@/components/forms";
import { weeklyWhatsAppHref } from "@/lib/briefing";

export function WeekPackActions({
  text,
  href,
}: {
  text: string;
  href: string;
}) {
  return (
    <div className="no-print flex flex-wrap gap-2">
      <a className={ghostClass()} href={href}>
        Print weekly pack
      </a>
      <a className={ghostClass()} href={weeklyWhatsAppHref(text)} target="_blank" rel="noreferrer">
        WhatsApp pack
      </a>
      <CopyText text={text} />
    </div>
  );
}
