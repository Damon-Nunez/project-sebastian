"use client";

import { useState } from "react";

export function CopyTextButton({
  text,
  label = "Copy",
  emptyLabel = "Nothing to copy",
  className,
}: {
  text: string;
  label?: string;
  emptyLabel?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const disabled = !text.trim();

  return (
    <button
      type="button"
      disabled={disabled}
      className={className}
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
