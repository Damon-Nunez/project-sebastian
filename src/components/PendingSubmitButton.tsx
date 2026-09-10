"use client";

import { useFormStatus } from "react-dom";

type PendingSubmitButtonProps = {
  idleLabel: string;
  pendingLabel: string;
  className?: string;
  /** Optional alternate server action (e.g. polish vs save on the same form). */
  formAction?: (formData: FormData) => void | Promise<void>;
};

/** Submit button that reflects parent <form> pending state. */
export function PendingSubmitButton({
  idleLabel,
  pendingLabel,
  className,
  formAction,
}: PendingSubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className={className}
      {...(formAction ? { formAction } : {})}
    >
      {pending ? pendingLabel : idleLabel}
    </button>
  );
}
