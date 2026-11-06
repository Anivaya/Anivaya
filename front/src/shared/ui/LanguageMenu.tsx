import { useEffect, useId, useRef, useState } from "react";
import { languages, useLanguage } from "../language.ts";
import Icon from "./Icon.tsx";
import { useHomeText } from "../i18n/HomeLocale.tsx";

/** Survol temporaire ; un clic épingle le choix jusqu’au prochain clic ou à la sortie. */
export default function LanguageMenu({
  variant = "account",
}: {
  variant?: "account" | "public" | "preferences";
}) {
  const [language, select] = useLanguage();
  const t = useHomeText();
  const [hovered, setHovered] = useState(false);
  const [pinned, setPinned] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();
  const open = hovered || pinned;
  const close = () => {
    setHovered(false);
    setPinned(false);
  };
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !root.current?.contains(event.target)
      ) {
        setHovered(false);
        setPinned(false);
      }
    };
    const route = () => {
      setHovered(false);
      setPinned(false);
    };
    document.addEventListener("pointerdown", outside);
    window.addEventListener("hashchange", route);
    return () => {
      document.removeEventListener("pointerdown", outside);
      window.removeEventListener("hashchange", route);
    };
  }, [open]);
  const focusOption = (index: number) =>
    requestAnimationFrame(() =>
      root.current
        ?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]')
        [index]?.focus(),
    );
  return (
    <div
      ref={root}
      className={`language-menu language-menu--${variant}`}
      onPointerEnter={(event) => {
        if (event.pointerType === "mouse") setHovered(true);
      }}
      onPointerLeave={() => setHovered(false)}
      onBlur={(event) => {
        if (!root.current?.contains(event.relatedTarget)) close();
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          event.preventDefault();
          event.stopPropagation();
          close();
          trigger.current?.focus();
        }
      }}
    >
      <button
        ref={trigger}
        type="button"
        className="language-trigger"
        aria-label={`${t("Langue : ")}${languages.find((item) => item.code === language)!.name}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => {
          setPinned(!pinned);
          setHovered(false);
        }}
        onKeyDown={(event) => {
          if (["ArrowDown", "ArrowRight", "ArrowUp"].includes(event.key)) {
            event.preventDefault();
            setPinned(true);
            focusOption(event.key === "ArrowUp" ? languages.length - 1 : 0);
          }
        }}
      >
        <Icon name="globe" />
        <span>{languages.find((item) => item.code === language)!.name}</span>
        <Icon name={variant === "account" ? "chevron-right" : "down"} />
      </button>
      {open && (
        <div className="language-flyout">
          <div
            id={id}
            className="language-options"
            role="menu"
            aria-label={t("Choisir la langue")}
          >
            {languages.map((item, index) => (
              <button
                key={item.code}
                type="button"
                role="menuitemradio"
                aria-checked={language === item.code}
                lang={item.code}
                onClick={() => {
                  select(item.code);
                  setPinned(true);
                  setHovered(false);
                }}
                onKeyDown={(event) => {
                  const next =
                    event.key === "ArrowDown"
                      ? (index + 1) % languages.length
                      : event.key === "ArrowUp"
                        ? (index + languages.length - 1) % languages.length
                        : event.key === "Home"
                          ? 0
                          : event.key === "End"
                            ? languages.length - 1
                            : undefined;
                  if (next !== undefined) {
                    event.preventDefault();
                    focusOption(next);
                  }
                }}
              >
                <Icon name="globe" />
                <span>{item.name}</span>
                {language === item.code && <Icon name="check" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
