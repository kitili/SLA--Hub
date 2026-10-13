/** Paths the Academics service worker may keep on the device. */
export const ACADEMICS_BOARD_PATH =
  /^\/(en|sw)\/(feedback|curriculum|kg|assessment)\/?$/;

export const ACADEMICS_CACHE = "academics-boards-v1";
export const ACADEMICS_CACHE_MARKER = 'data-academics-cache="1"';

export function isAcademicsBoardPath(pathname: string): boolean {
  return ACADEMICS_BOARD_PATH.test(pathname);
}
