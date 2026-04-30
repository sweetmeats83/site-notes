#!/usr/bin/env node
// Starts backend on 3001 and frontend Vite on 5173 concurrently
const { spawn } = require('child_process');
const path = require('path');

const ROOT = path.join(__dirname, '..');

function run(cmd, args, cwd, color) {
  const p = spawn(cmd, args, {
    cwd,
    stdio: 'pipe',
    shell: process.platform === 'win32',
    env: {
      ...process.env,
      PORT: '3001',
      DATA_DIR: path.join(ROOT, 'data'),
      NODE_ENV: 'development',
    },
  });
  const prefix = `\x1b[${color}m[${args.includes('dev') ? 'frontend' : 'backend'}]\x1b[0m `;
  p.stdout.on('data', d => process.stdout.write(prefix + d));
  p.stderr.on('data', d => process.stderr.write(prefix + d));
  p.on('exit', (code) => { if (code) process.exit(code); });
  return p;
}

const backend  = run('node', ['src/index.js'], path.join(ROOT, 'backend'), 34);
const frontend = run('npm',  ['run', 'dev'],   path.join(ROOT, 'frontend'), 36);

process.on('SIGINT',  () => { backend.kill(); frontend.kill(); process.exit(0); });
process.on('SIGTERM', () => { backend.kill(); frontend.kill(); process.exit(0); });
