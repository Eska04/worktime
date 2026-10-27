import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
  readdirSync,
  statSync,
} from 'node:fs';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';
mkdirSync('.cache', { recursive: true });
const target = mkdtempSync(resolve('.cache/clean-'));
const files = [
  'package.json',
  'package-lock.json',
  '.npmrc',
  '.gitignore',
  '.prettierignore',
  '.prettierrc.json',
  'tsconfig.json',
  'tsconfig.server.json',
  'vite.config.ts',
  'vitest.config.ts',
  'playwright.config.ts',
  'eslint.config.js',
  'client',
  'server/src',
  'shared',
  'tests',
  'scripts',
];
function copy(source, destination) {
  if (statSync(source).isDirectory()) {
    mkdirSync(destination, { recursive: true });
    for (const name of readdirSync(source)) copy(join(source, name), join(destination, name));
  } else {
    mkdirSync(resolve(destination, '..'), { recursive: true });
    writeFileSync(destination, readFileSync(source));
  }
}
for (const file of files) copy(file, join(target, file));
console.log(`Чистая установка: ${target}`);
const npm = process.env.npm_execpath;
if (!npm) throw new Error('Запустите через npm run check:clean');
for (const args of [
  ['ci', '--cache', resolve('.cache/npm')],
  ['run', 'lint'],
  ['run', 'typecheck'],
  ['test'],
  ['run', 'build'],
]) {
  const result = spawnSync(process.execPath, [npm, ...args], {
    cwd: target,
    stdio: 'inherit',
    env: process.env,
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
console.log('PASS: npm ci, lint, typecheck, test, build в отдельной чистой папке.');
