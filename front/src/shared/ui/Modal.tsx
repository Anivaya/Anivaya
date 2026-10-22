import type { ReactNode } from "react";
import { useEffect, useRef } from "react";
import Icon from "./Icon.tsx";
export default function Modal({
  children,
  onClose,
  busy,
  compact = false,
  sharing = false,
}: {
  children: ReactNode;
  onClose: () => void;
  busy: boolean;
  compact?: boolean;
  sharing?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = ref.current!;
    const trigger = document.activeElement;
    element.showModal();
    return () => {
      element.close();
      if (trigger instanceof HTMLElement && trigger.isConnected)
        trigger.focus();
    };
  }, []);
  return (
    <dialog
      className={
        compact ? "animal-modal" : sharing ? "sharing-modal" : undefined
      }
      ref={ref}
      aria-labelledby="action-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
      onClick={(event) => {
        if (busy || event.target !== ref.current) return;
        const bounds = ref.current!.getBoundingClientRect();
        if (
          event.clientX < bounds.left ||
          event.clientX > bounds.right ||
          event.clientY < bounds.top ||
          event.clientY > bounds.bottom
        )
          onClose();
      }}
    >
      {!compact && (
        <div className="dialog-top">
          <span>MON ESPACE ANIVAYA</span>
          <button
            type="button"
            className="close"
            disabled={busy}
            onClick={onClose}
            aria-label="Fermer la fenêtre"
          >
            <Icon name="close" />
          </button>
        </div>
      )}
      {children}
    </dialog>
  );
}
