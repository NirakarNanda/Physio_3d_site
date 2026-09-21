import type { AnchorHTMLAttributes } from "react";

interface ButtonProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  variant?: "primary" | "secondary";
}

export function Button({ variant = "primary", className = "", children, ...props }: ButtonProps) {
  const base =
    "inline-flex items-center justify-center rounded-full px-7 py-3 text-xs font-body uppercase tracking-label transition-colors duration-300";
  const styles =
    variant === "primary"
      ? "bg-ink text-bg hover:bg-ink/85"
      : "border border-ink/20 text-ink hover:border-ink/50";

  return (
    <a className={`${base} ${styles} ${className}`} {...props}>
      {children}
    </a>
  );
}
