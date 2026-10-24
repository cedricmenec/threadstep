import { PRIORITY_LABELS, PRIORITY_VALUES } from "./priority-options.js";

const VARIANTS = new Set(["badge", "field"]);

export function priorityControlClassName(variant, value, className) {
  if (!VARIANTS.has(variant)) {
    throw new TypeError("unknown priority control variant: " + String(variant));
  }
  if (!PRIORITY_VALUES.includes(value)) {
    throw new TypeError("unknown priority value: " + String(value));
  }
  if (variant === "field") {
    return className;
  }
  return ["priority", "priority-" + value, "priority-control", className]
    .filter(Boolean)
    .join(" ");
}

export function PriorityControl({
  value,
  onChange,
  variant = "field",
  className,
  ariaLabel,
  disabled = false,
  ...rest
}) {
  return (
    <select
      {...rest}
      className={priorityControlClassName(variant, value, className)}
      aria-label={ariaLabel}
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
    >
      {PRIORITY_VALUES.map((priority) => (
        <option key={priority} value={priority}>{PRIORITY_LABELS[priority]}</option>
      ))}
    </select>
  );
}

export default PriorityControl;
