import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const run = (title, command) => {
  console.log(`\n▶ ${title}`);
  const { status } = spawnSync(command, { stdio: 'inherit', shell: true });
  if (status !== 0) {
    console.error(`\n✗ Failed: ${title}. Fix it and run npm run setup again.`);
    process.exit(status ?? 1);
  }
};

const major = Number(process.versions.node.split('.')[0]);
if (major < 22) {
  console.error(`✗ Node 22 or later is required (you have ${process.versions.node}): https://nodejs.org`);
  process.exit(1);
}
console.log(`✓ Node ${process.versions.node}`);

if (!existsSync('node_modules')) run('Installing dependencies', 'npm install');
run('Building the libraries', 'npm run build:libs');
run('Preparing the voice (microphone, speaker and models)', 'node packages/agent-voice/dist/cli.js --setup --language es');

console.log(`
✓ All set. To try it:
  1. npm run start:all            (the bridge, the backend and the demo, together)
  2. Open Claude Code in this folder: .mcp.json already includes the bridge (with its key) and the voice.
  3. Open http://localhost:4200 and tell Claude the code on screen, or say "habla conmigo" (the demo speaks Spanish).`);
