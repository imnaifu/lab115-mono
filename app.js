// ─── Conversion Data ───
const CATEGORIES = [
  {
    id: 'length', name: 'Length', icon: '📏',
    base: 'meter',
    units: [
      { id: 'mm', name: 'Millimeter', toBase: v => v * 0.001, fromBase: v => v / 0.001 },
      { id: 'cm', name: 'Centimeter', toBase: v => v * 0.01, fromBase: v => v / 0.01 },
      { id: 'm',  name: 'Meter',      toBase: v => v,       fromBase: v => v },
      { id: 'km', name: 'Kilometer',  toBase: v => v * 1000, fromBase: v => v / 1000 },
      { id: 'in', name: 'Inch',       toBase: v => v * 0.0254, fromBase: v => v / 0.0254 },
      { id: 'ft', name: 'Foot',       toBase: v => v * 0.3048, fromBase: v => v / 0.3048 },
      { id: 'yd', name: 'Yard',       toBase: v => v * 0.9144, fromBase: v => v / 0.9144 },
      { id: 'mi', name: 'Mile',       toBase: v => v * 1609.344, fromBase: v => v / 1609.344 },
    ]
  },
  {
    id: 'weight', name: 'Weight', icon: '⚖️',
    base: 'gram',
    units: [
      { id: 'mg', name: 'Milligram', toBase: v => v * 0.001, fromBase: v => v / 0.001 },
      { id: 'g',  name: 'Gram',      toBase: v => v,        fromBase: v => v },
      { id: 'kg', name: 'Kilogram',  toBase: v => v * 1000,  fromBase: v => v / 1000 },
      { id: 't',  name: 'Tonne',     toBase: v => v * 1e6,   fromBase: v => v / 1e6 },
      { id: 'oz', name: 'Ounce',     toBase: v => v * 28.3495, fromBase: v => v / 28.3495 },
      { id: 'lb', name: 'Pound',     toBase: v => v * 453.592, fromBase: v => v / 453.592 },
    ]
  },
  {
    id: 'temperature', name: 'Temperature', icon: '🌡️',
    base: 'celsius',
    units: [
      { id: 'C', name: 'Celsius',    toBase: v => v,       fromBase: v => v },
      { id: 'F', name: 'Fahrenheit', toBase: v => (v-32)*5/9, fromBase: v => v*9/5+32 },
      { id: 'K', name: 'Kelvin',     toBase: v => v - 273.15, fromBase: v => v + 273.15 },
    ]
  },
  {
    id: 'volume', name: 'Volume', icon: '🧪',
    base: 'liter',
    units: [
      { id: 'mL',   name: 'Milliliter',   toBase: v => v * 0.001, fromBase: v => v / 0.001 },
      { id: 'L',    name: 'Liter',         toBase: v => v,        fromBase: v => v },
      { id: 'gal',  name: 'Gallon (US)',  toBase: v => v * 3.78541, fromBase: v => v / 3.78541 },
      { id: 'qt',   name: 'Quart (US)',   toBase: v => v * 0.946353, fromBase: v => v / 0.946353 },
      { id: 'pt',   name: 'Pint (US)',    toBase: v => v * 0.473176, fromBase: v => v / 0.473176 },
      { id: 'cup',  name: 'Cup (US)',     toBase: v => v * 0.236588, fromBase: v => v / 0.236588 },
      { id: 'floz', name: 'Fluid Ounce',  toBase: v => v * 0.0295735, fromBase: v => v / 0.0295735 },
      { id: 'tbsp', name: 'Tablespoon',   toBase: v => v * 0.0147868, fromBase: v => v / 0.0147868 },
      { id: 'tsp',  name: 'Teaspoon',     toBase: v => v * 0.00492892, fromBase: v => v / 0.00492892 },
    ]
  },
  {
    id: 'area', name: 'Area', icon: '📐',
    base: 'sq-meter',
    units: [
      { id: 'mm2', name: 'mm²',  toBase: v => v * 1e-6,    fromBase: v => v / 1e-6 },
      { id: 'cm2', name: 'cm²',  toBase: v => v * 1e-4,    fromBase: v => v / 1e-4 },
      { id: 'm2',  name: 'm²',   toBase: v => v,           fromBase: v => v },
      { id: 'ha',  name: 'Hectare', toBase: v => v * 10000, fromBase: v => v / 10000 },
      { id: 'km2', name: 'km²',  toBase: v => v * 1e6,     fromBase: v => v / 1e6 },
      { id: 'in2', name: 'in²',  toBase: v => v * 0.00064516, fromBase: v => v / 0.00064516 },
      { id: 'ft2', name: 'ft²',  toBase: v => v * 0.092903, fromBase: v => v / 0.092903 },
      { id: 'ac',  name: 'Acre', toBase: v => v * 4046.86,  fromBase: v => v / 4046.86 },
      { id: 'mi2', name: 'mi²',  toBase: v => v * 2.59e6,  fromBase: v => v / 2.59e6 },
    ]
  },
  {
    id: 'speed', name: 'Speed', icon: '🚀',
    base: 'mps',
    units: [
      { id: 'mps',  name: 'm/s',    toBase: v => v,        fromBase: v => v },
      { id: 'kmh',  name: 'km/h',   toBase: v => v / 3.6,   fromBase: v => v * 3.6 },
      { id: 'mph',  name: 'mph',    toBase: v => v * 0.44704, fromBase: v => v / 0.44704 },
      { id: 'fps',  name: 'ft/s',   toBase: v => v * 0.3048,  fromBase: v => v / 0.3048 },
      { id: 'kn',   name: 'Knot',   toBase: v => v * 0.514444, fromBase: v => v / 0.514444 },
    ]
  },
  {
    id: 'time', name: 'Time', icon: '⏱️',
    base: 'second',
    units: [
      { id: 'ms',  name: 'Millisecond', toBase: v => v * 0.001,    fromBase: v => v / 0.001 },
      { id: 's',   name: 'Second',      toBase: v => v,            fromBase: v => v },
      { id: 'min', name: 'Minute',      toBase: v => v * 60,       fromBase: v => v / 60 },
      { id: 'h',   name: 'Hour',        toBase: v => v * 3600,     fromBase: v => v / 3600 },
      { id: 'd',   name: 'Day',         toBase: v => v * 86400,    fromBase: v => v / 86400 },
      { id: 'wk',  name: 'Week',        toBase: v => v * 604800,   fromBase: v => v / 604800 },
      { id: 'mo',  name: 'Month (30d)', toBase: v => v * 2592000,  fromBase: v => v / 2592000 },
      { id: 'yr',  name: 'Year (365d)', toBase: v => v * 31536000, fromBase: v => v / 31536000 },
    ]
  },
  {
    id: 'data', name: 'Data', icon: '💾',
    base: 'byte',
    units: [
      { id: 'B',  name: 'Byte',      toBase: v => v,          fromBase: v => v },
      { id: 'KB', name: 'Kilobyte',  toBase: v => v * 1024,   fromBase: v => v / 1024 },
      { id: 'MB', name: 'Megabyte',  toBase: v => v * 1048576, fromBase: v => v / 1048576 },
      { id: 'GB', name: 'Gigabyte',  toBase: v => v * 1.074e9, fromBase: v => v / 1.074e9 },
      { id: 'TB', name: 'Terabyte',  toBase: v => v * 1.1e12,  fromBase: v => v / 1.1e12 },
      { id: 'PB', name: 'Petabyte',  toBase: v => v * 1.126e15, fromBase: v => v / 1.126e15 },
    ]
  }
];

// ─── State ───
let currentCategory = 'length';
let fromUnit = 'm';
let toUnit = 'ft';
let fromValue = 1;

// ─── DOM refs ───
const el = id => document.getElementById(id);
const catTabs = el('categoryTabs');
const fromVal = el('fromValue');
const toVal = el('toValue');
const fromUnitSel = el('fromUnit');
const toUnitSel = el('toUnit');
const swapBtn = el('swapBtn');
const copyBtn = el('copyBtn');
const resultRow = el('resultRow');
const resultText = el('resultText');
const formulaBox = el('formulaBox');
const refTable = el('refTable');

// ─── Render Categories ───
function renderTabs() {
  catTabs.innerHTML = CATEGORIES.map(c =>
    `<button class="cat-tab${c.id === currentCategory ? ' active' : ''}" data-cat="${c.id}">
       ${c.icon} ${c.name}
     </button>`
  ).join('');
  catTabs.querySelectorAll('.cat-tab').forEach(btn => {
    btn.addEventListener('click', () => switchCategory(btn.dataset.cat));
  });
}

// ─── Switch Category ───
function switchCategory(catId) {
  currentCategory = catId;
  const cat = CATEGORIES.find(c => c.id === catId);
  fromUnit = cat.units[0].id;
  toUnit = cat.units[1]?.id || cat.units[0].id;
  renderTabs();
  populateUnits();
  convert();
}

// ─── Populate Unit Selects ───
function populateUnits() {
  const cat = CATEGORIES.find(c => c.id === currentCategory);
  const opts = cat.units.map(u =>
    `<option value="${u.id}"${u.id === fromUnit ? ' selected' : ''}>${u.name}</option>`
  ).join('');
  fromUnitSel.innerHTML = opts;
  toUnitSel.innerHTML = cat.units.map(u =>
    `<option value="${u.id}"${u.id === toUnit ? ' selected' : ''}>${u.name}</option>`
  ).join('');
}

// ─── Convert ───
function convert() {
  const cat = CATEGORIES.find(c => c.id === currentCategory);
  const from = cat.units.find(u => u.id === fromUnit);
  const to = cat.units.find(u => u.id === toUnit);
  if (!from || !to) return;

  const val = parseFloat(fromVal.value);
  if (isNaN(val)) {
    toVal.value = '';
    resultText.textContent = '';
    formulaBox.innerHTML = '';
    return;
  }

  // Convert: fromValue -> base -> toValue
  const baseVal = from.toBase(val);
  const result = to.fromBase(baseVal);

  // Format result
  const formatted = formatNum(result);
  toVal.value = formatted;
  resultText.innerHTML = `<strong>${formatNum(val)}</strong> ${from.name} = <strong class="result-highlight">${formatted}</strong> ${to.name}`;
  resultRow.classList.add('show');

  // Formula
  if (from.id === 'C' || from.id === 'F' || from.id === 'K') {
    formulaBox.innerHTML = `<span class="formula">Formula: ${getTempFormula(from.id, to.id)}</span>`;
  } else if (from.id !== to.id) {
    const factor = cat.id === 'temperature' ? 1 : baseVal / val;
    formulaBox.innerHTML = `<span class="formula">1 ${from.name} = ${formatNum(Math.abs(result / val))} ${to.name}</span>`;
  } else {
    formulaBox.innerHTML = '';
  }

  renderQuickTable(cat, from, to, val);
}

function formatNum(n) {
  if (Math.abs(n) >= 1e12 || (Math.abs(n) < 1e-10 && n !== 0)) return n.toExponential(6);
  if (Number.isInteger(n) && Math.abs(n) < 1e15) return n.toString();
  const s = n.toPrecision(10);
  // Remove trailing zeros
  return parseFloat(s).toString();
}

function getTempFormula(from, to) {
  const pairs = {
    'C,F': '°F = °C × 9/5 + 32',
    'C,K': 'K = °C + 273.15',
    'F,C': '°C = (°F − 32) × 5/9',
    'F,K': 'K = (°F − 32) × 5/9 + 273.15',
    'K,C': '°C = K − 273.15',
    'K,F': '°F = (K − 273.15) × 9/5 + 32',
  };
  return pairs[`${from},${to}`] || '';
}

// ─── Quick Reference Table ───
function renderQuickTable(cat, from, to, val) {
  const baseVal = from.toBase(val);
  const rows = cat.units.map(u => {
    const converted = u.fromBase(baseVal);
    return `<tr><td>${u.name}</td><td>${formatNum(converted)}</td></tr>`;
  }).join('');
  refTable.innerHTML = `<tr><th>Unit</th><th>Value</th></tr>${rows}`;
}

// ─── Event Listeners ───
fromVal.addEventListener('input', () => { fromValue = fromVal.value; convert(); });
fromUnitSel.addEventListener('change', () => { fromUnit = fromUnitSel.value; convert(); });
toUnitSel.addEventListener('change', () => { toUnit = toUnitSel.value; convert(); });

swapBtn.addEventListener('click', () => {
  [fromUnit, toUnit] = [toUnit, fromUnit];
  [fromVal.value, toVal.value] = [toVal.value || '1', fromVal.value];
  fromValue = fromVal.value;
  populateUnits();
  convert();
});

copyBtn.addEventListener('click', () => {
  const text = toVal.value;
  navigator.clipboard.writeText(text).then(() => {
    copyBtn.textContent = '✅';
    setTimeout(() => { copyBtn.textContent = '📋'; }, 1500);
  });
});

// Keyboard shortcuts
document.addEventListener('keydown', e => {
  if (e.key === 'Tab' && !e.shiftKey) {
    // Focus from value, or next input
  }
});

// ─── Init ───
renderTabs();
populateUnits();
fromVal.value = '1';
convert();

// Footer year
document.getElementById('year').textContent = new Date().getFullYear();
