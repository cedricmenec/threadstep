import { PRIORITIES } from "../core.js";

export const PRIORITY_LABELS = Object.freeze({
  urgent: "Urgent",
  normal: "Normal",
  later: "Plus tard"
});

export const PRIORITY_VALUES = Object.freeze([...PRIORITIES]);

export function priorityLabel(priority) {
  const label = PRIORITY_LABELS[priority];
  if (typeof label !== "string") {
    throw new TypeError("unknown priority: " + String(priority));
  }
  return label;
}
