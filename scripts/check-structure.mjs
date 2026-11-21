/** Lightweight import/boundary check; Node.js only, no additional dependencies. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const allFiles = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(file);
    else if (/\.(?:ts|tsx|mts)$/.test(file)) allFiles.push(file);
  }
}
for (const dir of ['src', 'tests', 'prisma']) walk(path.join(root, dir));
function resolves(base) {
  return [base, `${base}.ts`, `${base}.tsx`, `${base}.mts`,
    path.join(base, 'index.ts'), path.join(base, 'index.tsx')].some(p => fs.existsSync(p) && fs.statSync(p).isFile());
}
const errors = [];
for (const file of allFiles) {
  const rel = path.relative(root, file).replaceAll('\\', '/');
  const data = fs.readFileSync(file, 'utf8');
  const imports = [...data.matchAll(/\b(?:from\s*|import\s*\(\s*|vi\.mock\s*\(\s*)["']([^"']+)["']/g)];
  for (const [, spec] of imports) {
    if (rel.startsWith('src/frontend/') && spec.startsWith('@/backend/')) errors.push(`${rel}: frontend must not import ${spec}`);
    if (rel.startsWith('src/backend/') && spec.startsWith('@/frontend/')) errors.push(`${rel}: backend must not import ${spec}`);
    if (spec.startsWith('@/') && !resolves(path.join(root, 'src', spec.slice(2)))) errors.push(`${rel}: missing ${spec}`);
    if (spec.startsWith('.') && !resolves(path.resolve(path.dirname(file), spec))) errors.push(`${rel}: missing ${spec}`);
  }
}
if (errors.length) {
  for (const error of errors) console.error(`ERROR ${error}`);
  process.exitCode = 1;
} else console.log(`OK: ${allFiles.length} TypeScript files checked; imports and frontend/backend boundaries valid.`);
