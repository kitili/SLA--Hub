import type { ReactNode } from "react";
import type { DepartmentId } from "@/lib/departments";

type IconProps = { className?: string };

function Svg({ className, children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export function ActivityIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 19V9" />
      <path d="M10 19V5" />
      <path d="M16 19v-7" />
      <path d="M22 19V8" />
    </Svg>
  );
}

export function HomeIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z" />
    </Svg>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4 4" />
    </Svg>
  );
}

export function ExternalIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M14 5h5v5" />
      <path d="M19 5 10 14" />
      <path d="M17 13.5V18a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1h4.5" />
    </Svg>
  );
}

export function MenuIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </Svg>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M6 6l12 12M18 6 6 18" />
    </Svg>
  );
}

export function ArrowIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </Svg>
  );
}

export function DepartmentIcon({
  id,
  className,
}: {
  id: DepartmentId | "home";
  className?: string;
}) {
  if (id === "home") return <HomeIcon className={className} />;
  if (id === "onboarding") {
    return (
      <Svg className={className}>
        <circle cx="9" cy="8" r="3" />
        <path d="M4 19c.6-3 2.6-4.5 5-4.5s4.4 1.5 5 4.5" />
        <circle cx="16.5" cy="9" r="2.2" />
        <path d="M15 19c.4-2 1.7-3.2 3.5-3.4" />
      </Svg>
    );
  }
  if (id === "talent-academy") {
    return (
      <Svg className={className}>
        <path d="M4 10 12 6l8 4-8 4-8-4Z" />
        <path d="M7 12.2v4.2c0 .4 2.2 2.1 5 2.1s5-1.7 5-2.1v-4.2" />
        <path d="M20 10.5v5" />
      </Svg>
    );
  }
  if (id === "ops") {
    return (
      <Svg className={className}>
        <path d="M4 16h16" />
        <path d="M6 16V9l4-3h4l4 3v7" />
        <circle cx="8" cy="16" r="1.6" />
        <circle cx="16" cy="16" r="1.6" />
      </Svg>
    );
  }
  if (id === "uniforms") {
    return (
      <Svg className={className}>
        <path d="M9 5 12 7l3-2 3 2-1.5 3.5V20H7.5V10.5L6 7l3-2Z" />
        <path d="M9.5 20v-5h5v5" />
      </Svg>
    );
  }
  if (id === "marketing") {
    return (
      <Svg className={className}>
        <path d="M4 16V8l8-3v14l-8-3Z" />
        <path d="M12 8.5c3 .8 5 2.2 7 5.5" />
        <path d="M12 12.5c2 .4 3.4 1.2 5 3.2" />
      </Svg>
    );
  }
  if (id === "visitors") {
    return (
      <Svg className={className}>
        <path d="M4 20V6a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v14" />
        <path d="M14 10h5l1 10H14" />
        <circle cx="8.5" cy="9.5" r="1.6" />
        <path d="M6 15.5c.4-1.8 1.5-2.7 2.5-2.7s2.1.9 2.5 2.7" />
      </Svg>
    );
  }
  if (id === "workboard-tasks") {
    return (
      <Svg className={className}>
        <rect x="4" y="4" width="7" height="16" rx="1.2" />
        <rect x="13" y="4" width="7" height="10" rx="1.2" />
        <path d="M6 8h3M6 12h3M15 8h3" />
      </Svg>
    );
  }
  if (id === "lesson-plans") {
    return (
      <Svg className={className}>
        <path d="M5 5.5h6.5A2.5 2.5 0 0 1 14 8v11.5H7.5A2.5 2.5 0 0 1 5 17V5.5Z" />
        <path d="M14 8h4.5V19.5H14" />
        <path d="M7.5 9h4M7.5 12.5h4" />
      </Svg>
    );
  }
  if (id === "mel-dashboard") {
    return (
      <Svg className={className}>
        <path d="M4 19h16" />
        <rect x="5.5" y="11" width="3" height="6" rx="0.6" />
        <rect x="10.5" y="7" width="3" height="10" rx="0.6" />
        <rect x="15.5" y="9.5" width="3" height="7.5" rx="0.6" />
      </Svg>
    );
  }
  return (
    <Svg className={className}>
      <rect x="4" y="4" width="7" height="7" rx="1.2" />
      <rect x="13" y="4" width="7" height="7" rx="1.2" />
      <rect x="4" y="13" width="7" height="7" rx="1.2" />
      <path d="M16.5 13.5v6.5M13.5 16.8h6.5" />
    </Svg>
  );
}
