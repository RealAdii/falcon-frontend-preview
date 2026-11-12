import test, {afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {submissionObjects} from '../src/submissions-stream.js';
import {paretoPoint, paretoFrontier, checkEcdsaPareto, validateProjection, PARETO_FEED_URL} from '../src/ecdsa-pareto.js';
import {buildProjection} from '../../scripts/update-ecdsa-pareto.mjs';
import {ECDSA_BENCHMARK_ID} from '../src/ecdsa.js';
import {WATCHES} from '../src/index.js';

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });
const watch = WATCHES.find((item) => item.name === 'ECDSA_PARETO');
const json = (value, status = 200, headers = {}) => new Response(JSON.stringify(value), {status, headers});
function row(n, qubits, toffoli, extra = {}) {
  return {id: `${String(n).padStart(8, '0')}-1111-4111-8111-111111111111`,
    benchmarkId: ECDSA_BENCHMARK_ID, status: 'rejected',
    rejectionReason: 'score did not improve current best', officialScore: qubits * toffoli,
    officialMetrics: {qubits, toffoli}, solverUsername: 'researcher',
    scorePublishedAt: `2026-11-12T12:00:${String(n % 60).padStart(2, '0')}Z`, ...extra};
}
function environment() {
  const data = new Map();
  return {data, TELEGRAM_BOT_TOKEN: 'test-token',
    STATE: {async get(key, type) {const raw = data.get(key) ?? null; return type === 'json' && raw ? JSON.parse(raw) : raw;},
      async put(key, value) {data.set(key, value);}}};
}
function network(rows, {etag = 'tag-1', unchanged = false, send = () => json({ok: true})} = {}) {
  globalThis.fetch = async (url, options) => {
    if (url === PARETO_FEED_URL) return unchanged ? new Response(null, {status: 304})
      : json(await buildProjection(json({submissions: rows}).body,
        {sourceCommit: '1'.repeat(40), sourceEtag: etag}), 200, {etag});
    if (url.includes('/benchmarks/')) return json({benchmark: {id: ECDSA_BENCHMARK_ID,
      mode: 'scalar', direction: '-', promotionMode: 'automatic', currentBestScore: 100,
      sourceUrl: 'https://github.com/Layr-Labs/ecdsafail-challenge'}});
    if (url === watch.mediaUrl) return new Response('video');
    if (url.includes('api.telegram.org')) return send(options);
    assert.fail(`Unexpected request ${url}`);
  };
}
async function state(env) {return env.STATE.get(watch.stateKey, 'json');}
async function collect(body) {const result = []; for await (const value of submissionObjects(body)) result.push(value); return result;}
function chunks(text, size) {
  const bytes = new TextEncoder().encode(text);
  return new ReadableStream({start(controller) {
    for (let i = 0; i < bytes.length; i += size) controller.enqueue(bytes.slice(i, i + size));
    controller.close();
  }});
}

test('stream parser handles UTF-8, escaped quotes, braces and nested values across arbitrary chunks', async () => {
  const rows = [row(1, 10, 20, {note: 'Model: café 🧪 "} ] \\ more', nested: [{x: [1, 2]}]}), row(2, 5, 30)];
  const source = JSON.stringify({submissions: rows});
  for (const size of [1, 2, 7, 53, 1000]) assert.deepEqual(await collect(chunks(source, size)), rows);
});

test('stream parser rejects truncated or malformed envelopes instead of accepting partial evidence', async () => {
  for (const source of ['{"submissions":[{"id":"x"}', '{"wrong":[]}', '{"submissions":[{},]}',
    '{"submissions":[{}]}garbage', '{"submissions":[null]}', '{"submissions":[]} , {}']) {
    await assert.rejects(collect(chunks(source, 5)));
  }
  assert.deepEqual(await collect(chunks('{"submissions":[]}', 3)), []);
});

test('only score-only rejected rows with consistent official metrics qualify', () => {
  assert.ok(paretoPoint(row(1, 10, 20)));
  for (const change of [{rejectionReason: 'benchmark failed'}, {rejectionReason: null},
    {officialScore: null, claimedScore: 200}, {officialScore: 201}, {status: 'queued'},
    {benchmarkId: 'another-benchmark'}, {officialMetrics: {qubits: 0, toffoli: 20}},
    {officialMetrics: {qubits: 10, toffoli: Infinity}}, {id: 'not-an-id'}]) {
    assert.equal(paretoPoint(row(1, 10, 20, change)), null);
  }
});

test('frontier agrees with independent pairwise dominance and deduplicates equal coordinates', () => {
  const points = Array.from({length: 200}, (_, n) => paretoPoint(row(n + 1, (n * 17) % 31 + 1, (n * 13) % 37 + 1)));
  const expected = points.filter((point) => !points.some((other) => other.qubits <= point.qubits
    && other.toffoli <= point.toffoli && (other.qubits < point.qubits || other.toffoli < point.toffoli)));
  const coordinates = (list) => [...new Set(list.map((point) => `${point.qubits}:${point.toffoli}`))].sort();
  assert.deepEqual(coordinates(paretoFrontier(points)), coordinates(expected));
  assert.equal(paretoFrontier([points[0], {...points[0], id: 'another-id'}]).length, 1);
});

test('seed historical Pareto submissions silently and use conditional requests thereafter', async () => {
  const env = environment();
  network([row(1, 10, 20), row(2, 5, 50)], {send: () => assert.fail('historical send')});
  await checkEcdsaPareto(watch, env);
  assert.equal((await state(env)).frontier.length, 2);
  const snapshot = env.data.get(watch.stateKey);
  const request = globalThis.fetch;
  globalThis.fetch = (url, options) => {
    if (url === PARETO_FEED_URL) {
      assert.equal(options.headers['if-none-match'], 'tag-1');
      return new Response(null, {status: 304});
    }
    return request(url, options);
  };
  await checkEcdsaPareto(watch, env);
  assert.equal(env.data.get(watch.stateKey), snapshot);
});

test('a worse-product rejected submission can announce a real Pareto improvement', async () => {
  const env = environment();
  const old = row(1, 10, 20, {status: 'accepted', promotionStatus: 'promoted'});
  network([old]); await checkEcdsaPareto(watch, env);
  let sends = 0;
  network([old, row(2, 5, 50)], {etag: 'tag-2', send: (options) => {
    sends++;
    assert.equal(options.body.get('message_thread_id'), '142092');
    assert.equal(options.body.get('chat_id'), '-1004497882136');
    assert.ok(options.body.has('animation'));
    const caption = options.body.get('caption');
    assert.ok(caption.includes('PARETO POINT'));
    assert.ok(caption.includes('5 qubits · 50 Toffoli'));
    assert.ok(caption.includes('Product record unchanged'));
    assert.ok(caption.includes('<code>rejected</code>'));
    assert.ok(!caption.includes('% lower product'));
    assert.ok(caption.length <= 1024);
    return json({ok: true});
  }});
  await checkEcdsaPareto(watch, env);
  await checkEcdsaPareto(watch, env);
  assert.equal(sends, 1);
});

test('dominated rows, genuine failures, duplicate coordinates and promoted product records do not announce', async () => {
  const env = environment();
  const old = row(1, 10, 20);
  network([old]); await checkEcdsaPareto(watch, env);
  network([old, row(2, 20, 30), row(3, 5, 50, {rejectionReason: 'benchmark failed'}),
    row(4, 10, 20, {scorePublishedAt: '2026-11-11T00:00:00Z'}),
    row(5, 9, 19, {status: 'accepted', promotionStatus: 'promoted'})],
    {send: () => assert.fail('non-Pareto notice')});
  await checkEcdsaPareto(watch, env);
});

test('one notice per poll checkpoints remaining points and drains them on a 304', async () => {
  const env = environment();
  const old = row(1, 10, 20);
  network([old]); await checkEcdsaPareto(watch, env);
  let sends = 0;
  network([old, row(2, 5, 50), row(3, 7, 30)], {etag: 'tag-2', send: () => {sends++; return json({ok: true});}});
  await checkEcdsaPareto(watch, env);
  assert.equal(sends, 1); assert.equal((await state(env)).pending.length, 1);
  network([], {unchanged: true, send: () => {sends++; return json({ok: true});}});
  await checkEcdsaPareto(watch, env);
  assert.equal(sends, 2); assert.equal((await state(env)).pending.length, 0);
});

test('a pending point that is dominated before delivery is removed rather than announced', async () => {
  const env = environment(); const old = row(1, 10, 20);
  network([old]); await checkEcdsaPareto(watch, env);
  network([old, row(2, 5, 50), row(3, 7, 30)]); await checkEcdsaPareto(watch, env);
  network([old, row(2, 5, 50), row(3, 7, 30), row(4, 6, 25, {status: 'accepted'})],
    {send: () => assert.fail('dominated pending send')});
  await checkEcdsaPareto(watch, env);
  assert.equal((await state(env)).pending.length, 0);
});

test('a duplicate of an unsent frontier point cannot cause that point to be dropped on refresh', async () => {
  const env = environment(); const old = row(1, 10, 20);
  network([old]); await checkEcdsaPareto(watch, env);
  let sends = 0;
  const rows = [old, row(2, 5, 50), row(3, 7, 30), row(4, 7, 30)];
  network(rows, {send: () => {sends++; return json({ok: true});}});
  await checkEcdsaPareto(watch, env);
  assert.equal((await state(env)).pending.length, 1);
  await checkEcdsaPareto(watch, env);
  assert.equal(sends, 2);
  assert.equal((await state(env)).pending.length, 0);
});

test('delivery failure or truncated input preserves the previous checkpoint', async () => {
  const env = environment(); const old = row(1, 10, 20);
  network([old]); await checkEcdsaPareto(watch, env);
  const checkpoint = env.data.get(watch.stateKey);
  network([old, row(2, 5, 50)], {send: () => json({ok: false, error_code: 429, parameters: {retry_after: 30}}, 429)});
  await assert.rejects(checkEcdsaPareto(watch, env), /rate limit/);
  assert.equal(env.data.get(watch.stateKey), checkpoint);
  const request = globalThis.fetch;
  globalThis.fetch = (url, options) => url === PARETO_FEED_URL
    ? new Response('{"schema":"ecdsa-pareto/v1"') : request(url, options);
  await assert.rejects(checkEcdsaPareto(watch, env));
  assert.equal(env.data.get(watch.stateKey), checkpoint);
});

test('duplicate source IDs and an empty scored feed cannot overwrite saved evidence', async () => {
  const env = environment(); const old = row(1, 10, 20);
  network([old]); await checkEcdsaPareto(watch, env);
  const checkpoint = env.data.get(watch.stateKey);
  network([old, old]); await assert.rejects(checkEcdsaPareto(watch, env), /Duplicate/);
  network([]); await assert.rejects(checkEcdsaPareto(watch, env), /no scored submissions/);
  assert.equal(env.data.get(watch.stateKey), checkpoint);
});

test('projection validator rejects stale snapshots, wrong identity and inconsistent frontier data', async () => {
  const feed = await buildProjection(json({submissions: [row(1, 10, 20)]}).body,
    {sourceCommit: '1'.repeat(40), sourceEtag: 'test'});
  assert.equal(validateProjection(feed), feed);
  for (const change of [{generated_at: '2020-01-01T00:00:00Z'}, {benchmark_id: 'wrong'},
    {policy: 'unreviewed-rules'}, {source_url: 'https://example.org'}, {source_sha256: 'bad'},
    {eligible_ids: []}, {source_commit: 'bad'}]) {
    assert.throws(() => validateProjection({...feed, ...change}));
  }
  assert.throws(() => validateProjection({...feed, frontier: [{...feed.frontier[0], score: 201}]}));
  assert.throws(() => validateProjection({...feed, frontier: [{...feed.frontier[0], equivalent_ids: []}]}));
  assert.throws(() => validateProjection({...feed, frontier: [feed.frontier[0], feed.frontier[0]]}));
});

test('a cached projection stops producing notifications once its freshness window expires', async () => {
  const env = environment();
  network([row(1, 10, 20)]); await checkEcdsaPareto(watch, env);
  const saved = await state(env); saved.generated_at = '2020-01-01T00:00:00Z';
  env.data.set(watch.stateKey, JSON.stringify(saved));
  network([], {unchanged: true, send: () => assert.fail('stale notice')});
  await assert.rejects(checkEcdsaPareto(watch, env), /Stale/);
});
