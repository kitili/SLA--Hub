/** Barrel — import everything from "@/lib/contracts" */
export type { CurrentUser } from "./user";
export type { StaffDTO } from "./staff";
export type {
  ItemRead,
  CheckpointCompletion,
  StaffProgress,
  AdminOverview,
} from "./progress";
export type { ApiError, ApiSuccess, ApiResult } from "./api";
export { isApiError } from "./api";
