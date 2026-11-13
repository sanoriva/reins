import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const version = (process.argv[2] ?? '').replace(/^v/, '');
if (!/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(version)) {
  console.error(`Not a version: ${process.argv[2] ?? '(none)'} (example: v0.1.3)`);
  process.exit(1);
}

const files = [
  ...readdirSync('packages').map((name) => join('packages', name, 'package.json')),
  join('apps', 'demo', 'package.json'),
];

for (const file of files) {
  const pkg = JSON.parse(readFileSync(file, 'utf8'));
  if (file.startsWith('packages')) pkg.version = version;
  for (const field of ['dependencies', 'peerDependencies', 'devDependencies']) {
    for (const name of Object.keys(pkg[field] ?? {})) {
      if (name.startsWith('@reins-ai/')) pkg[field][name] = version;
    }
  }
  writeFileSync(file, `${JSON.stringify(pkg, null, 2)}\n`);
  console.log(`${file} → ${version}`);
}
