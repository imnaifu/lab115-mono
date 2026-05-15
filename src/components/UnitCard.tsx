import { useLayoutEffect, useRef } from "react";
import type { Lang, Unit } from "../data/categories";
import { fmt } from "../utils/format";

type Props = {
  unit: Unit;
  lang: Lang;
  value: number;
  isSource: boolean;
  onEdit: (rawText: string) => void;
};

// The `.value` span is contentEditable, so React shouldn't manage its
// children — we mount it empty and sync textContent imperatively via ref.
// This avoids cursor jumps when the user is typing, and avoids React fighting
// the browser over caret position.
export default function UnitCard({ unit, lang, value, isSource, onEdit }: Props) {
  const ref = useRef<HTMLSpanElement>(null);
  const formatted = fmt(value, unit.decimals);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Don't overwrite text while user is mid-edit in this very cell.
    if (document.activeElement === el) return;
    if (el.textContent !== formatted) {
      el.textContent = formatted;
    }
  }, [formatted]);

  return (
    <div className={`card ${isSource ? "source" : ""}`}>
      <div className="unit-name">{unit.name[lang]}</div>
      <div className="unit-symbol">{unit.sym}</div>
      <div className="value-row">
        <span
          ref={ref}
          className="value"
          contentEditable
          suppressContentEditableWarning
          inputMode="decimal"
          spellCheck={false}
          onFocus={(e) => {
            // Select existing content so typing replaces it (matches the
            // original UX where every card pre-selects on focus).
            const range = document.createRange();
            range.selectNodeContents(e.currentTarget);
            const sel = window.getSelection();
            sel?.removeAllRanges();
            sel?.addRange(range);
          }}
          onInput={(e) => onEdit(e.currentTarget.textContent ?? "")}
          onBlur={(e) => {
            // Snap back to the canonical formatted value on blur.
            e.currentTarget.textContent = formatted;
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              e.currentTarget.blur();
            }
          }}
        />
      </div>
    </div>
  );
}
