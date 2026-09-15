import { useEffect, useLayoutEffect, useRef, type CSSProperties, type ReactNode } from "react";

export function QuotePopover({ x, y, width, quoteId, label, onClose, children }: {
  x: number;
  y: number;
  width: number;
  quoteId: string;
  label: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const cardWidth = Math.min(420, width);
  const left = Math.max(0, Math.min(width - cardWidth, x - cardWidth / 2));

  useLayoutEffect(() => {
    const element = panel.current;
    element?.focus({ preventScroll: true });
    element?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [quoteId]);

  useEffect(() => {
    function outside(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Element) || panel.current?.contains(target) || target.closest(".air-chart-marker")) return;
      onClose();
    }
    function escape(event: KeyboardEvent) {
      if (event.key === "Escape") { event.preventDefault(); onClose(); }
    }
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [onClose]);

  return <div ref={panel} id={`quote-popover-${quoteId}`} className="air-quote-popover" role="dialog" aria-label={label} tabIndex={-1}
    style={{ left, top: y + 12, width: cardWidth, "--air-quote-tip": `${x - left}px` } as CSSProperties}>
    <div className="air-quote-popover-scroll">{children}</div>
  </div>;
}
