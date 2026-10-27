/**
 * Presentation-only drag session owned by the bounded Overview React surface.
 *
 * It keeps the dragged item, the candidate target and the before/after position
 * in React state and exposes them as props to the rendered cards. All visual
 * classes are derived from that state; no DOM node is mutated imperatively.
 * A valid drop delegates exactly one reorder intention to the existing
 * controller command, which keeps the business rules and persistence flow.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { canReorderWithinPriority } from "../core.js";

function releaseCapture(handle, pointerId) {
  if (!handle || typeof handle.releasePointerCapture !== "function" ||
      pointerId === undefined || pointerId === null) {
    return;
  }
  try {
    handle.releasePointerCapture(pointerId);
  } catch {
    /* the pointer may already be released */
  }
}

function candidateForElement(element, x, y, session, projects) {
  if (!element || typeof element.closest !== "function") return null;
  const task = element.closest(".task");
  if (!task) return null;
  const owner = task.closest(".subject");
  if (!owner || !owner.dataset || owner.dataset.subject !== session.subjectId) {
    return null;
  }
  const targetId = task.dataset ? task.dataset.item : null;
  if (typeof targetId !== "string" || targetId.length === 0) return null;
  const project = projects.find((entry) => entry.id === session.subjectId);
  if (!project || !Array.isArray(project.items)) return null;
  const target = project.items.find((entry) => entry.id === targetId);
  if (!target) return null;
  const topLevel = target.parentId === null || target.parentId === undefined;
  if (!topLevel) return null;
  const row = task.querySelector(".task-row") || task;
  let position = "after";
  if (typeof row.getBoundingClientRect === "function") {
    const rect = row.getBoundingClientRect();
    if (rect && Number.isFinite(rect.top) && Number.isFinite(rect.height) &&
        rect.height > 0) {
      position = y < rect.top + rect.height / 2 ? "before" : "after";
    }
  }
  if (!canReorderWithinPriority(project.items, session.itemId, targetId, position)) {
    return null;
  }
  return { targetId, position };
}

function resolveCandidate(event, session, projects) {
  const x = typeof event.clientX === "number" ? event.clientX : 0;
  const y = typeof event.clientY === "number" ? event.clientY : 0;
  if (typeof document !== "undefined" && typeof document.elementsFromPoint === "function") {
    const stack = document.elementsFromPoint(x, y);
    if (Array.isArray(stack)) {
      for (const element of stack) {
        const candidate = candidateForElement(element, x, y, session, projects);
        if (candidate) return candidate;
      }
    }
  }
  return candidateForElement(event.target, x, y, session, projects);
}

export function useOverviewDrag({ commands, projects, hideCompleted = false }) {
  const [session, setSession] = useState(null);
  const sessionRef = useRef(null);
  const commandsRef = useRef(commands);
  const projectsRef = useRef(projects);
  const hideCompletedRef = useRef(hideCompleted);
  commandsRef.current = commands;
  projectsRef.current = Array.isArray(projects) ? projects : [];
  hideCompletedRef.current = hideCompleted === true;

  const commitSession = useCallback((next) => {
    sessionRef.current = next;
    setSession(next);
  }, []);

  const cancel = useCallback(() => {
    const current = sessionRef.current;
    if (!current) return false;
    releaseCapture(current.handle, current.pointerId);
    commitSession(null);
    return true;
  }, [commitSession]);

  const startDrag = useCallback((subjectId, itemId, nativeEvent, handle) => {
    if (hideCompletedRef.current) return false;
    if (sessionRef.current) return false;
    const event = nativeEvent && typeof nativeEvent === "object" ? nativeEvent : {};
    if (typeof event.button === "number" && event.button !== 0) return false;
    const project = projectsRef.current.find((entry) => entry.id === subjectId);
    if (!project || !Array.isArray(project.items)) return false;
    const item = project.items.find((entry) => entry.id === itemId);
    if (!item) return false;
    if (handle && typeof handle.setPointerCapture === "function" &&
        event.pointerId !== undefined && event.pointerId !== null) {
      try {
        handle.setPointerCapture(event.pointerId);
      } catch {
        /* pointer capture may be unavailable */
      }
    }
    commitSession({
      pointerId: event.pointerId,
      subjectId,
      itemId,
      targetId: null,
      position: null,
      handle: handle || null
    });
    return true;
  }, [commitSession]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") {
      return undefined;
    }

    const finish = (drop) => {
      const current = sessionRef.current;
      if (!current) return;
      releaseCapture(current.handle, current.pointerId);
      commitSession(null);
      if (!drop) return;
      commandsRef.current.reorderItem(
        current.subjectId,
        current.itemId,
        drop.targetId,
        drop.position
      );
    };

    const onPointerMove = (event) => {
      const current = sessionRef.current;
      if (!current) return;
      if (current.pointerId !== undefined && event.pointerId !== undefined &&
          event.pointerId !== current.pointerId) {
        return;
      }
      if (event.cancelable) event.preventDefault();
      const candidate = resolveCandidate(event, current, projectsRef.current);
      if (!candidate) {
        if (current.targetId !== null) {
          commitSession({ ...current, targetId: null, position: null });
        }
        return;
      }
      if (candidate.targetId === current.targetId &&
          candidate.position === current.position) {
        return;
      }
      commitSession({ ...current, ...candidate });
    };

    const onPointerUp = (event) => {
      const current = sessionRef.current;
      if (!current) return;
      if (current.pointerId !== undefined && event.pointerId !== undefined &&
          event.pointerId !== current.pointerId) {
        return;
      }
      const candidate = resolveCandidate(event, current, projectsRef.current);
      const drop = candidate ||
        (current.targetId === null
          ? null
          : { targetId: current.targetId, position: current.position });
      finish(drop);
    };

    const onPointerCancel = () => {
      finish(null);
    };

    const onKeyDown = (event) => {
      if (event.key !== "Escape" || !sessionRef.current) return;
      event.preventDefault();
      finish(null);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerCancel);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerCancel);
      document.removeEventListener("keydown", onKeyDown);
      const current = sessionRef.current;
      if (current) {
        releaseCapture(current.handle, current.pointerId);
        sessionRef.current = null;
      }
    };
  }, [commitSession]);

  const draggingItemId = session ? session.itemId : null;
  const draggingSubjectId = session ? session.subjectId : null;

  return Object.freeze({
    startDrag,
    cancel,
    session,
    draggingItemId,
    draggingSubjectId,
    targetId: session ? session.targetId : null,
    dropPositionFor(itemId) {
      return session && session.targetId === itemId ? session.position : null;
    }
  });
}

export default useOverviewDrag;
