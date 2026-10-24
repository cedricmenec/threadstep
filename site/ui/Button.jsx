const VARIANTS = new Set(["primary", "secondary", "subtle", "danger"]);

export function buttonClassName(variant, className) {
  if (!VARIANTS.has(variant)) {
    throw new TypeError("unknown button variant: " + String(variant));
  }
  return className ? variant + " " + className : variant;
}

export function Button({
  variant = "secondary",
  type = "button",
  className,
  children,
  onClick,
  disabled = false,
  ...rest
}) {
  return (
    <button
      {...rest}
      className={buttonClassName(variant, className)}
      type={type}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export default Button;
