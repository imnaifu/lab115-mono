import { useEffect, useState } from "react";
import { CATEGORIES, getCategory, type CategoryKey, type Lang, type Unit } from "../data/categories";
import { usePersistedState } from "../hooks/usePersistedState";
import { baseToUnit, unitToBase } from "../utils/convert";
import CategoryHead from "./CategoryHead";
import Hero from "./Hero";
import Intro from "./Intro";
import Sidebar from "./Sidebar";
import SiteFooter from "./SiteFooter";
import Tabs from "./Tabs";
import TopBar from "./TopBar";
import UnitGrid from "./UnitGrid";

export type FavEntry = {
  cat: CategoryKey;
  unit: string;
  value: number;
  base: number;
  ts: number;
};

// `baseValue` is always in the category's base unit (m, g, °C, L, m², m/s).
// `sourceUnit` is the unit the user last typed in — used to highlight the
// active card and pick which unit the hero number is displayed in.
type BaseState = { baseValue: number; sourceUnit: string };

function defaultBaseFor(catKey: CategoryKey): BaseState {
  const cat = getCategory(catKey) || CATEGORIES[0];
  const def = cat.units.find((u) => u.key === cat.defaultUnit) || cat.units[0];
  return {
    baseValue: unitToBase(def, cat.defaultValue),
    sourceUnit: def.key,
  };
}

type Props = {
  // SSR-side default language (Astro can pass this from request headers later).
  // Kept simple for now: server always renders "zh" so HTML is stable; the
  // client reads stored prefs / navigator.language in an effect after mount.
  initialLang?: Lang;
};

export default function ConverterApp({ initialLang = "zh" }: Props) {
  const [lang, setLang] = usePersistedState<Lang>("conv:lang", initialLang);
  const [storedCategory, setStoredCategory] = usePersistedState<CategoryKey>("conv:cat", "length");
  // Guard against legacy/corrupt localStorage values — fall back to "length"
  // rather than crashing if the persisted key isn't in CATEGORIES.
  const category: CategoryKey = getCategory(storedCategory) ? storedCategory : "length";

  const [favs, setFavs] = usePersistedState<FavEntry[]>("conv:favs", []);

  const [base, setBase] = useState<BaseState>(() => defaultBaseFor(category));

  // First-visit only: if there's no stored lang yet, pick zh/en from the
  // browser. Runs after mount so SSR output stays deterministic.
  useEffect(() => {
    if (localStorage.getItem("conv:lang") != null) return;
    const browserLang = (navigator.language || "").toLowerCase().startsWith("en") ? "en" : "zh";
    if (browserLang !== lang) setLang(browserLang);
    // We only want this to fire once on first mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reflect language on <html> so font fallbacks (CJK Noto Sans/Serif SC)
  // pick the correct script.
  useEffect(() => {
    document.documentElement.lang = lang === "zh" ? "zh" : "en";
    document.documentElement.dataset.lang = lang;
  }, [lang]);

  const cat = getCategory(category) || CATEGORIES[0];

  const switchCategory = (key: CategoryKey) => {
    if (key === category) return;
    setStoredCategory(key);
    setBase(defaultBaseFor(key));
  };

  const handleEdit = (unit: Unit, newBase: number) => {
    setBase({ baseValue: newBase, sourceUnit: unit.key });
  };

  // Identity key for dedup across categories — value uses the user-facing
  // unit so "1 m" and "100 cm" are stored as distinct entries (matches the
  // original behavior).
  const entryKey = (e: FavEntry) => `${e.cat}|${e.unit}|${e.value}`;

  const currentEntry = (): FavEntry => {
    const u = cat.units.find((x) => x.key === base.sourceUnit) || cat.units[0];
    return {
      cat: category,
      unit: base.sourceUnit,
      value: baseToUnit(u, base.baseValue),
      base: base.baseValue,
      ts: Date.now(),
    };
  };

  const isCurrentFav = favs.some((f) => entryKey(f) === entryKey(currentEntry()));

  const toggleFav = () => {
    const e = currentEntry();
    const k = entryKey(e);
    const idx = favs.findIndex((f) => entryKey(f) === k);
    if (idx >= 0) {
      setFavs(favs.filter((_, i) => i !== idx));
    } else {
      // Cap the list so it doesn't grow without bound across sessions.
      setFavs([e, ...favs].slice(0, 30));
    }
  };

  const loadFavEntry = (e: FavEntry) => {
    setStoredCategory(e.cat);
    const c = getCategory(e.cat) || CATEGORIES[0];
    const u = c.units.find((x) => x.key === e.unit) || c.units[0];
    setBase({ baseValue: unitToBase(u, e.value), sourceUnit: u.key });
  };

  const removeFav = (idx: number) => {
    setFavs(favs.filter((_, i) => i !== idx));
  };

  return (
    <>
      <TopBar lang={lang} onLangChange={setLang} />
      <Intro lang={lang} />
      <Tabs lang={lang} active={category} onSelect={switchCategory} />

      <main>
        <div className="accent-strip" />
        <div className="layout">
          <div className="content">
            <CategoryHead lang={lang} category={category} />
            <Hero
              lang={lang}
              cat={cat}
              baseValue={base.baseValue}
              sourceUnit={base.sourceUnit}
              isFav={isCurrentFav}
              onToggleFav={toggleFav}
            />
            <UnitGrid
              cat={cat}
              lang={lang}
              baseValue={base.baseValue}
              sourceUnit={base.sourceUnit}
              onEdit={handleEdit}
            />
          </div>

          <Sidebar lang={lang} favs={favs} onLoad={loadFavEntry} onRemove={removeFav} />
        </div>
      </main>

      <SiteFooter lang={lang} />
    </>
  );
}
