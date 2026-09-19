// Temporary smoke probe for the done plugin. Usage: node smoke.mjs <project-dir>
import { readFileSync, mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const line = (k, v) => console.log(`${k}: ${v}`);
const attempt = (k, fn) => { try { line(k, fn()); } catch (e) { line(k, `ERROR ${e.code ?? ''} ${e.message}`); } };

line('node-script-dir', here);
line('node-argv', JSON.stringify(process.argv.slice(1)));
line('node-cwd', process.cwd());
line('node-platform', process.platform);
attempt('node-read-plugin-json', () => JSON.parse(readFileSync(join(here, '..', '.claude-plugin', 'plugin.json'), 'utf8')).version);
const target = process.argv[2];
if (!target) { line('node-write', 'SKIPPED no project-dir arg'); process.exit(0); }
const dir = join(target, '.done-smoke-node');
attempt('node-write', () => { mkdirSync(dir, { recursive: true }); writeFileSync(join(dir, 'probe.txt'), 'ok'); return readFileSync(join(dir, 'probe.txt'), 'utf8'); });
attempt('node-delete', () => { rmSync(dir, { recursive: true }); return existsSync(dir) ? 'still exists' : 'ok'; });
