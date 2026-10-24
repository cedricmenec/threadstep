/**
 * Pure decision about the single pilot React surface.
 *
 * It never reads the DOM, storage or the network. The vanilla controller
 * supplies the route, authorization flags and whether the requested project
 * exists in the current document.
 */

export const SURFACE_REASON = Object.freeze({
  SUBJECT_DETAIL: "subject-detail",
  NOT_DETAIL_ROUTE: "route-not-detail",
  BUSINESS_NOT_ALLOWED: "business-not-allowed",
  LOADING_BLOCKED: "loading-blocked",
  PROJECT_MISSING: "project-missing",
  INVALID_ROUTE: "route-invalid"
});

export function decideProjectDetailSurface({
  route,
  businessAllowed,
  isLoadingBlocked,
  documentLoaded,
  projectExists
} = {}) {
  if (!route || typeof route !== "object") {
    return Object.freeze({ mount: false, fallback: true, reason: SURFACE_REASON.INVALID_ROUTE });
  }
  if (route.view === "invalid") {
    return Object.freeze({ mount: false, fallback: true, reason: SURFACE_REASON.INVALID_ROUTE });
  }
  if (route.view === "settings") {
    return Object.freeze({ mount: false, fallback: false, reason: SURFACE_REASON.NOT_DETAIL_ROUTE });
  }
  if (route.view !== "subject" || typeof route.subjectId !== "string" || route.subjectId.length === 0) {
    return Object.freeze({ mount: false, fallback: false, reason: SURFACE_REASON.NOT_DETAIL_ROUTE });
  }
  if (businessAllowed !== true) {
    return Object.freeze({ mount: false, fallback: true, reason: SURFACE_REASON.BUSINESS_NOT_ALLOWED });
  }
  if (isLoadingBlocked === true || documentLoaded === false) {
    return Object.freeze({ mount: false, fallback: true, reason: SURFACE_REASON.LOADING_BLOCKED });
  }
  if (projectExists !== true) {
    return Object.freeze({ mount: false, fallback: true, reason: SURFACE_REASON.PROJECT_MISSING });
  }
  return Object.freeze({ mount: true, fallback: false, reason: SURFACE_REASON.SUBJECT_DETAIL });
}
