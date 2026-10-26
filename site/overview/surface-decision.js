import { OVERVIEW_PRESENTATION_STATE } from "../overview-read-state.js";

export const OVERVIEW_SURFACE_REASON = Object.freeze({
  OVERVIEW: "overview",
  NOT_OVERVIEW_ROUTE: "route-not-overview",
  BUSINESS_NOT_ALLOWED: "business-not-allowed",
  LOADING_BLOCKED: "loading-blocked",
  AWAITING_READ: "awaiting-read",
  ACTION_REQUIRED: "action-required",
  PRESENTATION_MISSING: "presentation-missing"
});

export function decideOverviewSurface({
  route,
  businessAllowed,
  documentLoaded,
  presentation
} = {}) {
  if (!route || typeof route !== "object" || route.view !== "overview") {
    return Object.freeze({ mount: false, reason: OVERVIEW_SURFACE_REASON.NOT_OVERVIEW_ROUTE });
  }
  if (businessAllowed !== true) {
    return Object.freeze({ mount: false, reason: OVERVIEW_SURFACE_REASON.BUSINESS_NOT_ALLOWED });
  }
  if (documentLoaded !== true) {
    return Object.freeze({ mount: false, reason: OVERVIEW_SURFACE_REASON.LOADING_BLOCKED });
  }
  if (!presentation || typeof presentation !== "object") {
    return Object.freeze({ mount: false, reason: OVERVIEW_SURFACE_REASON.PRESENTATION_MISSING });
  }
  if (presentation.state === OVERVIEW_PRESENTATION_STATE.AWAITING_READ) {
    return Object.freeze({ mount: false, reason: OVERVIEW_SURFACE_REASON.AWAITING_READ });
  }
  if (presentation.actionRequired === true && presentation.projectsAvailable !== true) {
    return Object.freeze({ mount: false, reason: OVERVIEW_SURFACE_REASON.ACTION_REQUIRED });
  }
  return Object.freeze({ mount: true, reason: OVERVIEW_SURFACE_REASON.OVERVIEW });
}

export default decideOverviewSurface;
