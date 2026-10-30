import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createPollRunner, postInbound, readInboundMessages, saveState } from '../scripts/openclaw-inbound-forwarder.js';

test('slow inbound scans cannot overlap and failure releases the next poll', async () => {
  let release; let calls = 0; let failures = 0;
  const poll = createPollRunner(async () => { calls++; await new Promise(resolve => { release = resolve; }); throw Error('failure'); }, () => failures++);
  const first = poll();
  await Promise.all([poll(), poll()]);
  assert.equal(calls, 1);
  release(); await first;
  const second = poll(); assert.equal(calls, 2); release(); await second;
  assert.equal(failures, 2);
});

test('inbound webhook requests are bounded, reject redirects and require application acknowledgement', async () => {
  const options = { url: 'https://app.test/api/openclaw/inbound', token: 'private-token' };
  for (const [status, body] of [[200, '{"ok":true}'], [200, '{"ok":false,"error":"private-data"}'], [503, 'private-data'], [200, 'not-json']]) {
    const send = () => postInbound({ messageId: 'stable' }, { ...options, fetchImpl: async (url, init) => {
      assert.equal(url, options.url); assert.equal(init.redirect, 'error'); assert.ok(init.signal instanceof AbortSignal);
      assert.equal(init.headers.Authorization, 'Bearer private-token'); return new Response(body, { status });
    } });
    if (body === '{"ok":true}') await send();
    else await assert.rejects(send, error => !/private-data/.test(error.message));
  }
  await assert.rejects(postInbound({}, { ...options, url: 'http://remote.test', fetchImpl: () => assert.fail('No request') }), /HTTPS/);
});

test('forwarder preserves stable IDs and reply references and writes state atomically', async t => {
  const dir = await mkdtemp(path.join(tmpdir(), 'libergent-forwarder-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const entry = { type: 'message', id: 'incoming-1', timestamp: '2026-10-30T10:00:00Z',
    message: { role: 'user', sourceChannel: 'whatsapp', senderE164: '+40722123456', content: 'Hello', replyToMessageId: 'outbound-1' } };
  const file = path.join(dir, 'session.jsonl');
  await writeFile(file, [entry, { ...entry, id: null }, { ...entry, id: '', message: { ...entry.message, content: 'No ID' } }].map(row => JSON.stringify(row)).join('\n'));
  const messages = readInboundMessages({ file, key: 'session' });
  assert.equal(messages.length, 1);
  assert.equal(messages[0].messageId, 'incoming-1');
  assert.equal(messages[0].replyToMessageId, 'outbound-1');
  const stateFile = path.join(dir, 'state.json');
  saveState({ seen: new Set(['incoming-1']) }, stateFile);
  assert.deepEqual(JSON.parse(await readFile(stateFile, 'utf8')), { seen: ['incoming-1'] });
  await assert.rejects(readFile(`${stateFile}.tmp`), /ENOENT/);
});
