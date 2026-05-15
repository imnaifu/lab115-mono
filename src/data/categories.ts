export type CategoryKey =
  | "length"
  | "weight"
  | "temp"
  | "volume"
  | "area"
  | "speed";

export type Lang = "zh" | "en";

export type Unit = {
  key: string;
  name: Record<Lang, string>;
  sym: string;
  decimals: number;
  // Linear units: value = base * factor; base = value / factor
  factor?: number;
  // Non-linear units (temperature): explicit converters
  toBase?: (v: number) => number;
  fromBase?: (v: number) => number;
};

export type Category = {
  key: CategoryKey;
  base: string;
  units: Unit[];
  defaultValue: number;
  defaultUnit: string;
  isTemp?: boolean;
};

export const CATEGORIES: Category[] = [
  {
    key: "length",
    base: "m",
    units: [
      { key: "mm", name: { zh: "毫米", en: "Millimeter" }, sym: "mm", factor: 1000,        decimals: 1 },
      { key: "cm", name: { zh: "厘米", en: "Centimeter" }, sym: "cm", factor: 100,         decimals: 2 },
      { key: "m",  name: { zh: "米",   en: "Meter"      }, sym: "m",  factor: 1,           decimals: 3 },
      { key: "km", name: { zh: "公里", en: "Kilometer"  }, sym: "km", factor: 0.001,       decimals: 4 },
      { key: "in", name: { zh: "英寸", en: "Inch"       }, sym: "in", factor: 39.3700787,  decimals: 2 },
      { key: "ft", name: { zh: "英尺", en: "Foot"       }, sym: "ft", factor: 3.2808399,   decimals: 3 },
      { key: "yd", name: { zh: "码",   en: "Yard"       }, sym: "yd", factor: 1.0936133,   decimals: 3 },
      { key: "mi", name: { zh: "英里", en: "Mile"       }, sym: "mi", factor: 0.000621371, decimals: 4 },
    ],
    defaultValue: 5,
    defaultUnit: "m",
  },
  {
    key: "weight",
    base: "g",
    units: [
      { key: "mg", name: { zh: "毫克", en: "Milligram" }, sym: "mg", factor: 1000,        decimals: 0 },
      { key: "g",  name: { zh: "克",   en: "Gram"      }, sym: "g",  factor: 1,           decimals: 2 },
      { key: "kg", name: { zh: "千克", en: "Kilogram"  }, sym: "kg", factor: 0.001,       decimals: 3 },
      { key: "t",  name: { zh: "吨",   en: "Ton"       }, sym: "t",  factor: 0.000001,    decimals: 4 },
      { key: "oz", name: { zh: "盎司", en: "Ounce"     }, sym: "oz", factor: 0.03527396,  decimals: 2 },
      { key: "lb", name: { zh: "磅",   en: "Pound"     }, sym: "lb", factor: 0.00220462,  decimals: 3 },
      { key: "st", name: { zh: "英石", en: "Stone"     }, sym: "st", factor: 0.000157473, decimals: 3 },
    ],
    defaultValue: 1,
    defaultUnit: "kg",
  },
  {
    key: "temp",
    base: "C",
    isTemp: true,
    units: [
      {
        key: "C", name: { zh: "摄氏度", en: "Celsius" }, sym: "°C", decimals: 2,
        toBase: v => v, fromBase: v => v,
      },
      {
        key: "F", name: { zh: "华氏度", en: "Fahrenheit" }, sym: "°F", decimals: 1,
        toBase: v => ((v - 32) * 5) / 9, fromBase: v => (v * 9) / 5 + 32,
      },
      {
        key: "K", name: { zh: "开尔文", en: "Kelvin" }, sym: "K", decimals: 2,
        toBase: v => v - 273.15, fromBase: v => v + 273.15,
      },
    ],
    defaultValue: 25,
    defaultUnit: "C",
  },
  {
    key: "volume",
    base: "L",
    units: [
      { key: "mL",   name: { zh: "毫升",     en: "Milliliter"  }, sym: "mL",    factor: 1000,        decimals: 1 },
      { key: "cL",   name: { zh: "厘升",     en: "Centiliter"  }, sym: "cL",    factor: 100,         decimals: 2 },
      { key: "L",    name: { zh: "升",       en: "Liter"       }, sym: "L",     factor: 1,           decimals: 3 },
      { key: "floz", name: { zh: "液量盎司", en: "Fluid Ounce" }, sym: "fl oz", factor: 33.8140227,  decimals: 2 },
      { key: "cup",  name: { zh: "杯",       en: "Cup (US)"    }, sym: "cup",   factor: 4.22675284,  decimals: 2 },
      { key: "pt",   name: { zh: "品脱",     en: "Pint (US)"   }, sym: "pt",    factor: 2.11337642,  decimals: 3 },
      { key: "gal",  name: { zh: "加仑",     en: "Gallon (US)" }, sym: "gal",   factor: 0.264172052, decimals: 4 },
    ],
    defaultValue: 1,
    defaultUnit: "L",
  },
  {
    key: "area",
    base: "m2",
    units: [
      { key: "cm2", name: { zh: "平方厘米", en: "Square cm"    }, sym: "cm²",  factor: 10000,       decimals: 0 },
      { key: "m2",  name: { zh: "平方米",   en: "Square meter" }, sym: "m²",   factor: 1,           decimals: 3 },
      { key: "ha",  name: { zh: "公顷",     en: "Hectare"      }, sym: "ha",   factor: 0.0001,      decimals: 4 },
      { key: "km2", name: { zh: "平方公里", en: "Square km"    }, sym: "km²",  factor: 0.000001,    decimals: 5 },
      { key: "mu",  name: { zh: "亩",       en: "Mu (chinese)" }, sym: "mu",   factor: 0.0015,      decimals: 4 },
      { key: "ft2", name: { zh: "平方英尺", en: "Square foot"  }, sym: "ft²",  factor: 10.7639,     decimals: 2 },
      { key: "yd2", name: { zh: "平方码",   en: "Square yard"  }, sym: "yd²",  factor: 1.19599,     decimals: 3 },
      { key: "ac",  name: { zh: "英亩",     en: "Acre"         }, sym: "acre", factor: 0.000247105, decimals: 4 },
    ],
    defaultValue: 100,
    defaultUnit: "m2",
  },
  {
    key: "speed",
    base: "ms",
    units: [
      { key: "ms",   name: { zh: "米/秒",     en: "Meter/sec"    }, sym: "m/s",  factor: 1,          decimals: 3 },
      { key: "kmh",  name: { zh: "公里/小时", en: "Km per hour"  }, sym: "km/h", factor: 3.6,        decimals: 2 },
      { key: "mph",  name: { zh: "英里/小时", en: "Miles per hr" }, sym: "mph",  factor: 2.23694,    decimals: 2 },
      { key: "knot", name: { zh: "节",        en: "Knot"         }, sym: "kn",   factor: 1.94384,    decimals: 2 },
      { key: "fts",  name: { zh: "英尺/秒",   en: "Feet/sec"     }, sym: "ft/s", factor: 3.28084,    decimals: 2 },
      { key: "mach", name: { zh: "马赫",      en: "Mach"         }, sym: "Ma",   factor: 0.00291545, decimals: 5 },
    ],
    defaultValue: 10,
    defaultUnit: "ms",
  },
];

export function getCategory(key: string): Category | undefined {
  return CATEGORIES.find(c => c.key === key);
}
