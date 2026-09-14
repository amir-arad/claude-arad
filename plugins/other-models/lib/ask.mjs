#!/usr/bin/env node
// One headless call to another model harness: prompt in, bare answer on stdout.
//
// Usage: node ask.mjs <agy|codex> [--model M] [--cwd DIR] [--timeout SEC] [--prompt-file F] [prompt...]
// Prompt source, first match: --prompt-file, positional words, stdin.
// Exit: 0 answer printed · 1 harness error or empty answer · 2 timeout (partial answer printed) · 3 CLI not found · 64 usage
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const usage = 'usage: node ask.mjs <agy|codex> [--model M] [--cwd DIR] [--timeout SEC] [--prompt-file F] [prompt...]';
const fail = (code, msg) => { if (msg) process.stderr.write(msg + '\n'); process.exit(code); };

const [harness, ...rest] = process.argv.slice(2);
if (harness !== 'agy' && harness !== 'codex') fail(64, usage);
const opt = { timeout: 300 };
const words = [];
for (let i = 0; i < rest.length; i++) {
  const m = rest[i].match(/^--(model|cwd|timeout|prompt-file)$/);
  if (!m) { words.push(rest[i]); continue; }
  if (i + 1 >= rest.length) fail(64, usage);
  opt[m[1]] = rest[++i];
}

let prompt = opt['prompt-file'] ? fs.readFileSync(opt['prompt-file'], 'utf8')
  : words.length ? words.join(' ')
  : process.stdin.isTTY ? '' : fs.readFileSync(0, 'utf8');
if (!prompt.trim()) fail(64, usage);

// Neutral cwd by default: both CLIs load AGENTS.md/CLAUDE.md-style instructions from their root.
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), `ask-${harness}-`));
const cwd = opt.cwd ? path.resolve(opt.cwd) : scratch;
const timeoutMs = Number(opt.timeout) * 1000;

function which(names) {
  for (const n of names) {
    try {
      const hit = execFileSync(process.platform === 'win32' ? 'where' : 'which', [n], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
        .split(/\r?\n/).map(s => s.trim()).find(s => s && fs.existsSync(s));
      if (hit) return hit;
    } catch {}
  }
  return null;
}

let bin, args, input;
if (harness === 'agy') {
  bin = process.env.AGY_BIN || which(['agy.exe', 'agy']);
  // stream-json over stdin: no argv length limit (Windows caps a command line at ~32K chars).
  args = ['--input-format', 'stream-json', '--output-format', 'stream-json', `--print-timeout`, `${opt.timeout}s`, '--print='];
  input = JSON.stringify({ event: 'user', message: { role: 'user', content: prompt } }) + '\n';
} else {
  bin = process.env.CODEX_BIN || which(['codex.cmd', 'codex.exe', 'codex']);
  args = ['exec', '--skip-git-repo-check', '--ephemeral', '--color', 'never', '-s', 'read-only',
    '-C', cwd, '-o', path.join(scratch, 'last-message.txt')];
  input = prompt;
}
if (opt.model) args.push(harness === 'agy' ? '--model' : '-m', opt.model);
if (harness === 'codex') args.push('-'); // read prompt from stdin
if (!bin) fail(3, `${harness} not found on PATH; set ${harness.toUpperCase()}_BIN`);

// .cmd shims need a shell on Windows; quote anything with spaces.
const viaShell = /\.(cmd|bat)$/i.test(bin);
const q = s => (/[\s"]/.test(s) ? `"${s.replace(/"/g, '\\"')}"` : s);
const child = viaShell
  ? spawn(q(bin), args.map(q), { cwd, shell: true })
  : spawn(bin, args, { cwd });

let out = '', err = '', timedOut = false;
child.stdout.on('data', d => { out += d; });
child.stderr.on('data', d => { err += d; });
child.stdin.end(input);
const killer = setTimeout(() => {
  timedOut = true;
  // child.kill() on Windows leaves grandchildren alive (and holding cwd); kill the tree.
  if (process.platform === 'win32') spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
  else child.kill();
}, timeoutMs);
const cleanup = () => { try { fs.rmSync(scratch, { recursive: true, force: true, maxRetries: 5 }); } catch {} };

function agyAnswer(stream) {
  let deltas = '', result = null;
  for (const line of stream.split(/\r?\n/)) {
    if (!line.startsWith('{')) continue;
    let ev; try { ev = JSON.parse(line); } catch { continue; }
    if (ev.event === 'step_update' && ev.step_update.step_type === 'agent_response') deltas += ev.step_update.text_delta || '';
    if (ev.event === 'result') result = ev.result;
  }
  if (result && result.status !== 'SUCCESS') return { text: deltas, error: result.error || result.status };
  return { text: result ? result.response : deltas, error: result ? null : 'no result event' };
}

function finish(code) {
  clearTimeout(killer);
  let text, error = null;
  if (harness === 'agy') ({ text, error } = agyAnswer(out));
  else { try { text = fs.readFileSync(path.join(scratch, 'last-message.txt'), 'utf8'); } catch { text = ''; } }
  cleanup();
  text = (text || '').replace(/\n{3,}/g, '\n\n').trim();
  if (text) process.stdout.write(text + '\n');
  if (timedOut) fail(2, `[TIMEOUT after ${opt.timeout}s]`);
  if (error || code || !text) fail(1, [error, err.trim(), !text && 'empty answer'].filter(Boolean).join('\n'));
  process.exit(0);
}
child.on('close', finish);
child.on('error', e => { clearTimeout(killer); cleanup(); fail(3, String(e.message || e)); });
