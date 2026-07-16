import type { Category, Lang, Unit } from "../data/categories";
import { baseToUnit, unitToBase } from "../utils/convert";
import UnitCard from "./UnitCard";

type Props = {
  cat: Category;
  lang: Lang;
  baseValue: number;
  sourceUnit: string;
  onEdit: (unit: Unit, newBase: number) => void;
};

export default function UnitGrid({ cat, lang, baseValue, sourceUnit, onEdit }: Props) {
  const handleEdit = (unit: Unit) => (rawText: string) => {
    const raw = rawText.replace(/,/g, "").trim();
    // Allow transient incomplete inputs ("", "-", ".") while the user is typing.
    if (raw === "" || raw === "-" || raw === ".") return;
    const v = parseFloat(raw);
    if (!isFinite(v)) return;
    onEdit(unit, unitToBase(unit, v));
  };

  return (
    <div className="grid">
      {cat.units.map((u) => (
        <UnitCard
          key={u.key}
          unit={u}
          lang={lang}
          value={baseToUnit(u, baseValue)}
          isSource={u.key === sourceUnit}
          onEdit={handleEdit(u)}
        />
      ))}
    </div>
  );
}
