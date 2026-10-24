export function TextField({
  as = "input",
  type,
  className,
  value,
  onChange,
  ariaLabel,
  ariaInvalid = false,
  errorId,
  required = false,
  maxLength,
  placeholder,
  rows,
  disabled = false,
  ...rest
}) {
  const shared = {
    ...rest,
    className,
    value,
    onChange,
    "aria-label": ariaLabel,
    "aria-invalid": ariaInvalid ? "true" : undefined,
    "aria-describedby": errorId || undefined,
    required,
    maxLength,
    placeholder,
    disabled
  };
  if (as === "textarea") {
    return <textarea {...shared} rows={rows} />;
  }
  if (as !== "input") {
    throw new TypeError("unknown text field type: " + String(as));
  }
  return <input {...shared} type={type} />;
}

export default TextField;
