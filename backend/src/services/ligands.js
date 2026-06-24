// Ligand data source: fetch a ligand's CIF from RCSB, parse it, and cache it.
import { parseLigandCif } from './cifParser.js';
import { httpError } from '../lib/errors.js';
import { config } from '../config.js';

// Curated browse list. TODO (Week 3): load real codes from the provided ligands.txt.
const SAMPLE_CODES = ['ATP', 'HEM', 'GLC', 'NAD', 'CFF', 'BNZ', 'CO2', 'HOH'];

// In-memory parsed-ligand cache. TODO: persist to disk/Postgres so it survives
// restarts and we stay gentle on RCSB.
const cache = new Map();

const rcsbUrl = (code) => `https://files.rcsb.org/ligands/download/${code}.cif`;

export function listLigands(search = '') {
  const q = search.trim().toUpperCase();
  const ligands = SAMPLE_CODES.filter((code) => !q || code.includes(q)).map((id) => ({ id }));
  return { ligands, count: ligands.length };
}

// `fetchImpl` and `timeoutMs` are injectable so tests run offline/deterministic.
export async function getLigand(id, { fetchImpl = fetch, timeoutMs = config.upstreamTimeoutMs } = {}) {
  const code = id.trim().toUpperCase();
  if (cache.has(code)) return cache.get(code);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let res;
  try {
    res = await fetchImpl(rcsbUrl(code), { signal: controller.signal });
  } catch (err) {
    if (err?.name === 'AbortError') {
      throw httpError(504, 'upstream_timeout', `Timed out fetching ligand '${code}' from RCSB`);
    }
    throw httpError(502, 'upstream_error', `Could not reach RCSB for ligand '${code}'`);
  } finally {
    clearTimeout(timer);
  }

  if (res.status === 404) return null; // unknown ligand -> route answers 404
  if (!res.ok) {
    throw httpError(502, 'upstream_error', `RCSB returned ${res.status} for ligand '${code}'`);
  }

  const ligand = parseLigandCif(await res.text(), code);
  if (ligand.atoms.length === 0) {
    throw httpError(502, 'upstream_error', `Could not parse ligand '${code}' from RCSB`);
  }

  cache.set(code, ligand);
  return ligand;
}
