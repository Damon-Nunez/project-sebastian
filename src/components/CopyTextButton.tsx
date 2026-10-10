"use client";

import { useState } from "react";

export function CopyTextButton({
  text,
  label = "Copy",
  emptyLabel = "Nothing to copy",
  className,
  ariaLabel,
}: {
  text: string;
  label?: string;
  emptyLabel?: string;
  className?: string;
  ariaLabel?: string;
}) {
  const [copied, setCopied] = useState(false);
  const disabled = !text.trim();

  return (
    <button
      type="button"
      disabled={disabled}
      className={className}
      aria-label={ariaLabel}
      onClick={async () => {
        if (disabled) return;
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1500);
        } catch {
          setCopied(false);
        }
      }}
    >
      {disabled ? emptyLabel : copied ? "Copied" : label}
    </button>
  );
}
