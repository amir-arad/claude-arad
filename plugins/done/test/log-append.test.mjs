import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatLogLine } from '../lib/log-append.mjs';

test('formats one line', () => {
  assert.equal(formatLogLine({ date: '2026-09-15', run: 'what-now', version: 7, rule: '3', card: 'M4.1', text: 'ammo packet drafted' }),
    '- 2026-09-15 what-now v7 rule:3 card:M4.1 ammo packet drafted');
  assert.equal(formatLogLine({ date: '2026-09-15', run: 'what-now', version: 8, deviation: 'user asked for QA first', card: 'M4.2', text: 'ran 2.4', manual: true }),
    '- 2026-09-15 what-now v8 manual: deviation:"user asked for QA first" card:M4.2 ran 2.4');
  assert.throws(() => formatLogLine({ date: 'd', run: 'goals', version: 1, rule: '-', card: '-', text: 'a\nb' }), /newline/);
});
