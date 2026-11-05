import type { ReactNode } from "react";
import { useEffect, useRef } from "react";
import Icon from "./Icon.tsx";
export default function Modal({
  children,
  onClose,
  busy,
  header = true,
  className = "",
  labelledBy = "action-title",
}: {
  children: ReactNode;
  onClose: () => void;
  busy: boolean;
  header?: boolean;
  className?: string;
  labelledBy?: string;
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
      className={className}
      ref={ref}
      aria-labelledby={labelledBy}
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
      {header && (
        <div className="dialog-top">
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

export function CloseDialogButton({ onClose }: { onClose: () => void }) {
  return (
    <div className="dialog-actions">
      <button className="button outline close-action" onClick={onClose}>
        Fermer
      </button>
    </div>
  );
}
