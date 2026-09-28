export type DeviceIconKey = "phone" | "tablet" | "laptop" | "desktop" | "projector" | "camera" | "printer" | "other";

export const DEVICE_ICON_OPTIONS: { value: DeviceIconKey; label: string }[] = [
  { value: "laptop", label: "Laptop" },
  { value: "desktop", label: "Desktop" },
  { value: "phone", label: "Phone" },
  { value: "tablet", label: "Tablet" },
  { value: "projector", label: "Projector" },
  { value: "camera", label: "Camera" },
  { value: "printer", label: "Printer" },
  { value: "other", label: "Other" },
];

const PATHS: Record<DeviceIconKey, React.ReactNode> = {
  phone: (
    <>
      <rect x="7" y="2" width="10" height="20" rx="2" />
      <line x1="11" y1="18" x2="13" y2="18" />
    </>
  ),
  tablet: (
    <>
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </>
  ),
  laptop: (
    <>
      <rect x="3" y="4" width="18" height="12" rx="1" />
      <path d="M2 19h20l-1.5-3h-17z" />
    </>
  ),
  desktop: (
    <>
      <rect x="4" y="4" width="16" height="11" rx="1" />
      <line x1="9" y1="20" x2="15" y2="20" />
      <line x1="12" y1="15" x2="12" y2="20" />
    </>
  ),
  projector: (
    <>
      <rect x="2" y="7" width="14" height="9" rx="2" />
      <circle cx="9" cy="11.5" r="2.5" />
      <line x1="16" y1="10" x2="21" y2="8" />
      <line x1="16" y1="13" x2="21" y2="15" />
    </>
  ),
  camera: (
    <>
      <path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" />
      <circle cx="12" cy="14" r="3.5" />
    </>
  ),
  printer: (
    <>
      <path d="M6 9V3h12v6" />
      <rect x="3" y="9" width="18" height="8" rx="1" />
      <rect x="6" y="14" width="12" height="7" />
    </>
  ),
  other: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <line x1="9" y1="12" x2="15" y2="12" />
    </>
  ),
};

export function DeviceIcon({ icon, className }: { icon: DeviceIconKey | string; className?: string }) {
  const key = (PATHS[icon as DeviceIconKey] ? icon : "other") as DeviceIconKey;
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className ?? "h-5 w-5"}
      aria-hidden="true"
    >
      {PATHS[key]}
    </svg>
  );
}
