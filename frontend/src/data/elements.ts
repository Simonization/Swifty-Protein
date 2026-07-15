// Per-element reference data: CPK/Jmol colors + van der Waals radii (Å).
// Bundled in the app (no network needed for colors).
//
// Full periodic table: VI.4 mandates CPK colors for "other elements" too, and a
// partial table silently renders real ligands wrong (B12's cobalt, the CU/ZN/FE
// ion ligands) rather than failing loudly.
//
// Colors are the Jmol CPK set (jmol.sourceforge.net/jscolors). Radii are Bondi
// van der Waals values where defined, extended with Alvarez (2013) for the rest;
// they only scale spheres, so the synthetic elements' 2.0 placeholder is cosmetic.
import type { Element } from '../types';

// [atomic number, symbol, name, CPK hex, van der Waals radius (Å)]
type Row = [number, string, string, string, number];

const ROWS: Row[] = [
  [1, 'H', 'Hydrogen', 'FFFFFF', 1.2],
  [2, 'HE', 'Helium', 'D9FFFF', 1.4],
  [3, 'LI', 'Lithium', 'CC80FF', 1.82],
  [4, 'BE', 'Beryllium', 'C2FF00', 1.53],
  [5, 'B', 'Boron', 'FFB5B5', 1.92],
  [6, 'C', 'Carbon', '909090', 1.7],
  [7, 'N', 'Nitrogen', '3050F8', 1.55],
  [8, 'O', 'Oxygen', 'FF0D0D', 1.52],
  [9, 'F', 'Fluorine', '90E050', 1.47],
  [10, 'NE', 'Neon', 'B3E3F5', 1.54],
  [11, 'NA', 'Sodium', 'AB5CF2', 2.27],
  [12, 'MG', 'Magnesium', '8AFF00', 1.73],
  [13, 'AL', 'Aluminium', 'BFA6A6', 1.84],
  [14, 'SI', 'Silicon', 'F0C8A0', 2.1],
  [15, 'P', 'Phosphorus', 'FF8000', 1.8],
  [16, 'S', 'Sulfur', 'FFFF30', 1.8],
  [17, 'CL', 'Chlorine', '1FF01F', 1.75],
  [18, 'AR', 'Argon', '80D1E3', 1.88],
  [19, 'K', 'Potassium', '8F40D4', 2.75],
  [20, 'CA', 'Calcium', '3DFF00', 2.31],
  [21, 'SC', 'Scandium', 'E6E6E6', 2.11],
  [22, 'TI', 'Titanium', 'BFC2C7', 1.87],
  [23, 'V', 'Vanadium', 'A6A6AB', 1.79],
  [24, 'CR', 'Chromium', '8A99C7', 1.89],
  [25, 'MN', 'Manganese', '9C7AC7', 1.97],
  [26, 'FE', 'Iron', 'E06633', 1.94],
  [27, 'CO', 'Cobalt', 'F090A0', 1.92],
  [28, 'NI', 'Nickel', '50D050', 1.63],
  [29, 'CU', 'Copper', 'C88033', 1.4],
  [30, 'ZN', 'Zinc', '7D80B0', 1.39],
  [31, 'GA', 'Gallium', 'C28F8F', 1.87],
  [32, 'GE', 'Germanium', '668F8F', 2.11],
  [33, 'AS', 'Arsenic', 'BD80E3', 1.85],
  [34, 'SE', 'Selenium', 'FFA100', 1.9],
  [35, 'BR', 'Bromine', 'A62929', 1.85],
  [36, 'KR', 'Krypton', '5CB8D1', 2.02],
  [37, 'RB', 'Rubidium', '702EB0', 3.03],
  [38, 'SR', 'Strontium', '00FF00', 2.49],
  [39, 'Y', 'Yttrium', '94FFFF', 2.19],
  [40, 'ZR', 'Zirconium', '94E0E0', 1.86],
  [41, 'NB', 'Niobium', '73C2C9', 2.07],
  [42, 'MO', 'Molybdenum', '54B5B5', 2.09],
  [43, 'TC', 'Technetium', '3B9E9E', 2.09],
  [44, 'RU', 'Ruthenium', '248F8F', 2.07],
  [45, 'RH', 'Rhodium', '0A7D8C', 1.95],
  [46, 'PD', 'Palladium', '006985', 2.02],
  [47, 'AG', 'Silver', 'C0C0C0', 1.72],
  [48, 'CD', 'Cadmium', 'FFD98F', 1.58],
  [49, 'IN', 'Indium', 'A67573', 1.93],
  [50, 'SN', 'Tin', '668080', 2.17],
  [51, 'SB', 'Antimony', '9E63B5', 2.06],
  [52, 'TE', 'Tellurium', 'D47A00', 2.06],
  [53, 'I', 'Iodine', '940094', 1.98],
  [54, 'XE', 'Xenon', '429EB0', 2.16],
  [55, 'CS', 'Caesium', '57178F', 3.43],
  [56, 'BA', 'Barium', '00C900', 2.68],
  [57, 'LA', 'Lanthanum', '70D4FF', 2.4],
  [58, 'CE', 'Cerium', 'FFFFC7', 2.35],
  [59, 'PR', 'Praseodymium', 'D9FFC7', 2.39],
  [60, 'ND', 'Neodymium', 'C7FFC7', 2.29],
  [61, 'PM', 'Promethium', 'A3FFC7', 2.36],
  [62, 'SM', 'Samarium', '8FFFC7', 2.29],
  [63, 'EU', 'Europium', '61FFC7', 2.33],
  [64, 'GD', 'Gadolinium', '45FFC7', 2.37],
  [65, 'TB', 'Terbium', '30FFC7', 2.21],
  [66, 'DY', 'Dysprosium', '1FFFC7', 2.29],
  [67, 'HO', 'Holmium', '00FF9C', 2.16],
  [68, 'ER', 'Erbium', '00E675', 2.35],
  [69, 'TM', 'Thulium', '00D452', 2.27],
  [70, 'YB', 'Ytterbium', '00BF38', 2.42],
  [71, 'LU', 'Lutetium', '00AB24', 2.21],
  [72, 'HF', 'Hafnium', '4DC2FF', 2.12],
  [73, 'TA', 'Tantalum', '4DA6FF', 2.17],
  [74, 'W', 'Tungsten', '2194D6', 2.1],
  [75, 'RE', 'Rhenium', '267DAB', 2.17],
  [76, 'OS', 'Osmium', '266696', 2.16],
  [77, 'IR', 'Iridium', '175487', 2.02],
  [78, 'PT', 'Platinum', 'D0D0E0', 2.09],
  [79, 'AU', 'Gold', 'FFD123', 1.66],
  [80, 'HG', 'Mercury', 'B8B8D0', 1.55],
  [81, 'TL', 'Thallium', 'A6544D', 1.96],
  [82, 'PB', 'Lead', '575961', 2.02],
  [83, 'BI', 'Bismuth', '9E4FB5', 2.07],
  [84, 'PO', 'Polonium', 'AB5C00', 1.97],
  [85, 'AT', 'Astatine', '754F45', 2.02],
  [86, 'RN', 'Radon', '428296', 2.2],
  [87, 'FR', 'Francium', '420066', 3.48],
  [88, 'RA', 'Radium', '007D00', 2.83],
  [89, 'AC', 'Actinium', '70ABFA', 2.6],
  [90, 'TH', 'Thorium', '00BAFF', 2.37],
  [91, 'PA', 'Protactinium', '00A1FF', 2.43],
  [92, 'U', 'Uranium', '008FFF', 1.86],
  [93, 'NP', 'Neptunium', '0080FF', 2.21],
  [94, 'PU', 'Plutonium', '006BFF', 2.43],
  [95, 'AM', 'Americium', '545CF2', 2.44],
  [96, 'CM', 'Curium', '785CE3', 2.45],
  [97, 'BK', 'Berkelium', '8A4FE3', 2.44],
  [98, 'CF', 'Californium', 'A136D4', 2.45],
  [99, 'ES', 'Einsteinium', 'B31FD4', 2.45],
  [100, 'FM', 'Fermium', 'B31FBA', 2.45],
  [101, 'MD', 'Mendelevium', 'B30DA6', 2.46],
  [102, 'NO', 'Nobelium', 'BD0D87', 2.46],
  [103, 'LR', 'Lawrencium', 'C70066', 2.46],
  [104, 'RF', 'Rutherfordium', 'CC0059', 2.0],
  [105, 'DB', 'Dubnium', 'D1004F', 2.0],
  [106, 'SG', 'Seaborgium', 'D90045', 2.0],
  [107, 'BH', 'Bohrium', 'E00038', 2.0],
  [108, 'HS', 'Hassium', 'E6002E', 2.0],
  [109, 'MT', 'Meitnerium', 'EB0026', 2.0],
  [110, 'DS', 'Darmstadtium', 'EB0026', 2.0],
  [111, 'RG', 'Roentgenium', 'EB0026', 2.0],
  [112, 'CN', 'Copernicium', 'EB0026', 2.0],
  [113, 'NH', 'Nihonium', 'EB0026', 2.0],
  [114, 'FL', 'Flerovium', 'EB0026', 2.0],
  [115, 'MC', 'Moscovium', 'EB0026', 2.0],
  [116, 'LV', 'Livermorium', 'EB0026', 2.0],
  [117, 'TS', 'Tennessine', 'EB0026', 2.0],
  [118, 'OG', 'Oganesson', 'EB0026', 2.0],
];

const ELEMENTS: Element[] = ROWS.map(([number, symbol, name, cpkHex, radius]) => ({
  symbol,
  name,
  number,
  cpkHex,
  radius,
}));

// Default for a symbol that is genuinely not an element (CPK "unknown" pink).
const DEFAULT: Element = { symbol: 'X', name: 'Unknown', number: 0, cpkHex: 'FF1493', radius: 1.6 };

const bySymbol = new Map(ELEMENTS.map((e) => [e.symbol, e]));

// For the renderer: never returns null — falls back to the "unknown" element.
export function elementFor(symbol: string): Element {
  return bySymbol.get((symbol ?? '').toUpperCase()) ?? DEFAULT;
}
