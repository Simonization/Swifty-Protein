#!/usr/bin/env node
// Regenerates src/data/ligandIds.ts from assets/ligands.txt.
// Run manually after ligands.txt changes: `node scripts/gen-ligand-ids.js`.
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'assets', 'ligands.txt');
const OUT = path.join(__dirname, '..', 'src', 'data', 'ligandIds.ts');

const ids = fs
  .readFileSync(SRC, 'utf8')
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter(Boolean);

const body = `// Generated from assets/ligands.txt by scripts/gen-ligand-ids.js — do not hand-edit.
// Regenerate with: node scripts/gen-ligand-ids.js
export const LIGAND_IDS: string[] = ${JSON.stringify(ids, null, 2)};
`;

fs.writeFileSync(OUT, body);
console.log(`Wrote ${ids.length} ligand ids to ${path.relative(process.cwd(), OUT)}`);
