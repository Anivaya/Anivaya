import { useCallback, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, HTMLAttributes } from "react";

/** Une barre indicatrice persistante, indépendante des barres masquées par le système. */
export default function TabScroller({
  as: Tag = "nav",
  className = "",
  children,
  ...props
}: HTMLAttributes<HTMLElement> & { as?: "nav" | "div" }) {
  const element = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ start: 0, end: 100, overflow: false });
  const measure = useCallback(() => {
    const node = element.current;
    if (!node) return;
    const total = Math.max(1, node.scrollWidth);
    const next = {
      start: Math.max(0, node.scrollLeft) / total * 100,
      end: Math.min(100, (Math.max(0, node.scrollLeft) + node.clientWidth) / total * 100),
      overflow: node.scrollWidth > node.clientWidth + 1,
    };
    setPosition(previous =>
      previous.start === next.start && previous.end === next.end && previous.overflow === next.overflow
        ? previous
        : next,
    );
  }, []);
  useLayoutEffect(() => {
    const node = element.current;
    if (!node) return;
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    Array.from(node.children).forEach(child => observer.observe(child));
    measure();
    return () => observer.disconnect();
  }, [children, measure]);
  return (
    <Tag
      {...props}
      ref={element}
      className={`page-tabs ${className}`}
      data-scrollable={position.overflow || undefined}
      onScroll={measure}
      onFocusCapture={event => {
        props.onFocusCapture?.(event);
        const node = element.current;
        if (!node || !(event.target instanceof HTMLElement)) return;
        const frame = node.getBoundingClientRect();
        const focused = event.target.getBoundingClientRect();
        if (focused.left < frame.left) node.scrollLeft += focused.left - frame.left;
        else if (focused.right > frame.right) node.scrollLeft += focused.right - frame.right;
        measure();
      }}
      style={{
        ...props.style,
        "--tab-scroll-start": `${position.start}%`,
        "--tab-scroll-end": `${position.end}%`,
      } as CSSProperties}
    >
      {children}
    </Tag>
  );
}
