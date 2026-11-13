import { spawn, spawnSync } from 'node:child_process';

const services = [
  { name: 'puente', script: 'bridge' },
  { name: 'api', script: 'demo:api' },
  { name: 'demo', script: 'demo' },
];

const children = services.map(({ name, script }) => {
  const child = spawn(`npm run ${script}`, { shell: true, stdio: ['ignore', 'pipe', 'pipe'] });
  const prefix = (stream, out) =>
    stream.on('data', (chunk) => {
      for (const line of String(chunk).split(/\r?\n/)) if (line.trim()) out.write(`[${name}] ${line}\n`);
    });
  prefix(child.stdout, process.stdout);
  prefix(child.stderr, process.stderr);
  child.on('exit', (code) => console.log(`[${name}] exited (${code ?? 'stopped'})`));
  return child;
});

/** On Windows, killing the shell does not kill what it started, so the whole tree is stopped. */
const stopAll = () => {
  for (const child of children) {
    if (child.exitCode !== null) continue;
    if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
    else child.kill('SIGINT');
  }
  process.exit(0);
};
process.on('SIGINT', stopAll);
process.on('SIGTERM', stopAll);

console.log('Starting the bridge, the backend (http://localhost:3000) and the demo (http://localhost:4200). Press Ctrl+C to stop.');
