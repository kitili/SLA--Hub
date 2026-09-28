/**
 * Admin icon set — a tiny inline-SVG library for the admin chrome and cards.
 *
 * No icon dependency in this app yet (see {@link ../LogoutButton}); these are
 * hand-rolled outline glyphs on a 24×24 grid, stroked with `currentColor` so
 * they inherit the surrounding text colour and size via `font-size`/`width`.
 * All are decorative by default (`aria-hidden`); pass a `title` to label one.
 */

import type { SVGProps } from "react";

export type IconName =
  // shell / nav
  | "dashboard"
  | "aiStudio"
  | "plans"
  | "feedback"
  | "menu"
  | "close"
  | "collapse"
  | "back"
  | "logout"
  | "search"
  // dashboard cards
  | "book"
  | "eye"
  | "star"
  | "clock"
  | "flame"
  | "trendingUp"
  | "message"
  | "searchOff";

/** SVG inner markup per icon (paths use the shared stroke attrs on <svg>). */
const PATHS: Record<IconName, React.ReactNode> = {
  dashboard: (
    <>
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </>
  ),
  aiStudio: (
    <>
      <path d="M12 3l1.9 4.6L18.5 9.5 13.9 11.4 12 16l-1.9-4.6L5.5 9.5l4.6-1.9L12 3z" />
      <path d="M19 14l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8.8-2z" />
    </>
  ),
  plans: (
    <>
      <path d="M4 5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5z" />
      <path d="M13 3v5h5" />
      <path d="M8 13h7M8 17h5" />
    </>
  ),
  feedback: (
    <>
      <path d="M4 5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H9l-4 4v-4H6a2 2 0 0 1-2-2V5z" />
      <path d="M12 7.2l1 2 2.2.3-1.6 1.5.4 2.2-2-1-2 1 .4-2.2-1.6-1.5 2.2-.3 1-2z" />
    </>
  ),
  menu: (
    <>
      <line x1="4" y1="7" x2="20" y2="7" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="17" x2="20" y2="17" />
    </>
  ),
  close: (
    <>
      <line x1="6" y1="6" x2="18" y2="18" />
      <line x1="18" y1="6" x2="6" y2="18" />
    </>
  ),
  collapse: (
    <>
      <path d="M15 6l-6 6 6 6" />
    </>
  ),
  back: (
    <>
      <line x1="20" y1="12" x2="5" y2="12" />
      <polyline points="11 18 5 12 11 6" />
    </>
  ),
  logout: (
    <>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.5" y2="16.5" />
    </>
  ),
  book: (
    <>
      <path d="M4 5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5z" />
      <path d="M13 3v5h5" />
    </>
  ),
  eye: (
    <>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  star: (
    <>
      <polygon points="12 3 15 9.5 22 10.3 17 15 18.2 22 12 18.6 5.8 22 7 15 2 10.3 9 9.5 12 3" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 7 12 12 16 14" />
    </>
  ),
  flame: (
    <>
      <path d="M12 3c1 3.5 4 4.8 4 8a4 4 0 0 1-8 0c0-1.4.6-2.4 1.3-3.2C9 10 9.6 11 11 11c.4-2.6-1-4.3 1-8z" />
    </>
  ),
  trendingUp: (
    <>
      <polyline points="3 17 9 11 13 15 21 7" />
      <polyline points="15 7 21 7 21 13" />
    </>
  ),
  message: (
    <>
      <path d="M4 5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H9l-4 4v-4H6a2 2 0 0 1-2-2V5z" />
    </>
  ),
  searchOff: (
    <>
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.5" y2="16.5" />
      <line x1="8" y1="11" x2="14" y2="11" />
    </>
  ),
};

interface IconProps extends Omit<SVGProps<SVGSVGElement>, "name"> {
  name: IconName;
  /** Accessible label; when set the icon is exposed to AT instead of hidden. */
  title?: string;
  /** Pixel size (width = height). Defaults to 1em so it scales with text. */
  size?: number | string;
}

export default function Icon({ name, title, size = "1em", ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      {...rest}
    >
      {title ? <title>{title}</title> : null}
      {PATHS[name]}
    </svg>
  );
}
