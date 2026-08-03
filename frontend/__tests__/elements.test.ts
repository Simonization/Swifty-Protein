import { elementFor } from '../src/data/elements';

describe('elementFor', () => {
  it('is case-insensitive', () => {
    expect(elementFor('c')).toEqual(elementFor('C'));
    expect(elementFor('cl')).toEqual(elementFor('Cl'));
    expect(elementFor('CL')).toEqual(elementFor('Cl'));
  });

  it('never returns null, falling back to the "unknown" CPK-pink element', () => {
    const unknown = elementFor('ZZ');
    expect(unknown.symbol).toBe('X');
    expect(unknown.cpkHex).toBe('FF1493');
  });

  it('resolves cobalt distinctly from carbon (the B12 regression VI.4 called out)', () => {
    const cobalt = elementFor('CO');
    const carbon = elementFor('C');
    expect(cobalt.cpkHex).not.toBe(carbon.cpkHex);
    expect(cobalt.cpkHex).not.toBe('FF1493'); // must be a real table entry, not the unknown fallback
  });

  it('resolves the ion ligands the single-row parser fix exists for (Cu, Zn, Fe)', () => {
    for (const symbol of ['Cu', 'Zn', 'Fe']) {
      const el = elementFor(symbol);
      expect(el.cpkHex).not.toBe('FF1493');
      expect(el.symbol.toUpperCase()).toBe(symbol.toUpperCase());
    }
  });

  it('matches the mandated CPK colors for the elements VI.4 names explicitly', () => {
    expect(elementFor('O').cpkHex).toBe('FF0D0D'); // red
    expect(elementFor('N').cpkHex).toBe('3050F8'); // blue
    expect(elementFor('S').cpkHex).toBe('FFFF30'); // yellow
    expect(elementFor('P').cpkHex).toBe('FF8000'); // orange
    expect(elementFor('H').cpkHex).toBe('FFFFFF'); // white
  });
});
