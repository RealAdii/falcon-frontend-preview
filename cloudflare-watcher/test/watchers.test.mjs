import test, {afterEach} from 'node:test';
import assert from 'node:assert/strict';
import worker, {checkStarks, WATCHES} from '../src/index.js';
import {checkEcdsa, ECDSA_BENCHMARK_ID} from '../src/ecdsa.js';
import {sendTelegram, TelegramRateLimitError} from '../src/telegram.js';

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });
const json = (value, status = 200) => new Response(JSON.stringify(value), {status});
function environment(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    TELEGRAM_BOT_TOKEN: 'test-token', TELEGRAM_CHAT_ID: '-1004497882136',
    data,
    STATE: {
      async get(key, type) {
        const value = data.get(key) ?? null;
        return type === 'json' && value !== null ? JSON.parse(value) : value;
      },
      async put(key, value) { data.set(key, value); }
    }
  };
}
const starks = WATCHES.find((watch) => watch.name === 'STARKS');
const ecdsa = WATCHES.find((watch) => watch.name === 'ECDSA');
const contribution = (id) => ({
  id: `M-${String(id).padStart(4, '0')}`, status: 'accepted', target: 'T3',
  who: ['researcher'], title: `Result ${id}`, kind: 'lemma',
  url: 'https://starks.provably.fast/record'
});
function starksBoard(rows) {
  return {schema: 'proven-mathematics/0', contributions: rows, targets: []};
}
function starksNetwork(board, deliver = () => json({ok: true, result: {message_id: 1}})) {
  globalThis.fetch = async (url, options) => {
    if (url === starks.resultsUrl) return json(board);
    if (url === starks.mediaUrl) return new Response('video');
    if (url.includes('api.telegram.org')) return deliver(options);
    throw new Error(`Unexpected mock request: ${url}`);
  };
}

test('STARKS retains more than 200 accepted IDs and does not repeat them', async () => {
  const rows = Array.from({length: 539}, (_, index) => contribution(index + 1));
  const env = environment();
  let sends = 0;
  starksNetwork(starksBoard(rows), () => { sends++; return json({ok: true}); });
  await checkStarks(starks, env);
  await checkStarks(starks, env);
  const saved = await env.STATE.get(starks.stateKey, 'json');
  assert.equal(saved.version, 2);
  assert.equal(saved.ids.length, 539);
  assert.equal(sends, 0);
});

test('legacy STARKS state migrates without flooding the topic with historical entries', async () => {
  const env = environment({[starks.stateKey]: JSON.stringify({ids: ['M-0001']})});
  starksNetwork(starksBoard([contribution(2), contribution(1)]), () => assert.fail('historical send'));
  await checkStarks(starks, env);
  assert.deepEqual((await env.STATE.get(starks.stateKey, 'json')).ids, ['M-0002', 'M-0001']);
});

test('a failed second send does not replay the successfully checkpointed first send', async () => {
  const env = environment({[starks.stateKey]: JSON.stringify({version: 2, ids: ['M-0001']})});
  const captions = [];
  let calls = 0;
  starksNetwork(starksBoard([contribution(3), contribution(2), contribution(1)]), (options) => {
    captions.push(options.body.get('caption'));
    calls++;
    return calls === 2 ? json({ok: false, error_code: 429, parameters: {retry_after: 37}}, 429)
      : json({ok: true, result: {message_id: calls}});
  });
  await assert.rejects(checkStarks(starks, env), TelegramRateLimitError);
  assert.deepEqual((await env.STATE.get(starks.stateKey, 'json')).ids, ['M-0001', 'M-0002']);
  await checkStarks(starks, env);
  assert.equal(captions.filter((caption) => caption.includes('Result 2')).length, 1);
  assert.equal(captions.filter((caption) => caption.includes('Result 3')).length, 2);
});

test('STARKS bounds a batch and leaves unsent IDs eligible for the next poll', async () => {
  const env = environment({[starks.stateKey]: JSON.stringify({version: 2, ids: []})});
  let sends = 0;
  starksNetwork(starksBoard(Array.from({length: 8}, (_, i) => contribution(i + 1))), () => {
    sends++; return json({ok: true, result: {message_id: sends}});
  });
  await checkStarks(starks, env);
  assert.equal(sends, 3);
  assert.equal((await env.STATE.get(starks.stateKey, 'json')).ids.length, 3);
  await checkStarks(starks, env);
  assert.equal(sends, 6);
});

test('long untrusted STARKS text stays escaped within the Telegram caption limit', async () => {
  const env = environment({[starks.stateKey]: JSON.stringify({version: 2, ids: []})});
  const row = {...contribution(1), title: '<b>&'.repeat(600), who: ['<evil>'.repeat(100)], url: 'javascript:alert(1)'};
  let caption;
  starksNetwork(starksBoard([row]), (options) => {
    caption = options.body.get('caption');
    assert.equal(options.body.get('message_thread_id'), '632');
    return json({ok: true});
  });
  await checkStarks(starks, env);
  assert.ok(caption.length <= 1024);
  assert.ok(!caption.includes('<evil>'));
  assert.ok(!caption.includes('javascript:'));
  assert.ok(!/&[^;<>\s]*(?:<|$)/.test(caption));
});

test('duplicate contribution IDs and malformed state fail before delivery', async () => {
  const env = environment({[starks.stateKey]: JSON.stringify({version: 2, ids: []})});
  starksNetwork(starksBoard([contribution(1), contribution(1)]));
  await assert.rejects(checkStarks(starks, env), /duplicate/);
  env.data.set(starks.stateKey, JSON.stringify({version: 2, ids: 'M-0001'}));
  starksNetwork(starksBoard([contribution(1)]));
  await assert.rejects(checkStarks(starks, env), /Invalid STARKS watcher state/);
});

test('the complete STARKS caption budget includes every field and escaped link', async () => {
  const env = environment({[starks.stateKey]: JSON.stringify({version: 2, ids: []})});
  const row = {...contribution(1), target: 'T'.repeat(1000), title: '&'.repeat(1000),
    who: ['W'.repeat(1000)], kind: 'K'.repeat(1000), url: 'https://starks.provably.fast/?' + '&'.repeat(120)};
  const board = {...starksBoard([row]), targets: [{id: row.target, title: 'N'.repeat(1000)}]};
  starksNetwork(board, (options) => {
    assert.ok(options.body.get('caption').length <= 1024);
    return json({ok: true});
  });
  await checkStarks(starks, env);
});

test('Telegram HTTP success without an affirmative acknowledgement is not delivery', async () => {
  const env = environment();
  globalThis.fetch = async (url) => url.includes('api.telegram.org')
    ? json({ok: false, error_code: 400, description: 'Bad Request'}) : new Response('video');
  await assert.rejects(sendTelegram('record', starks.mediaUrl, 632, env), /delivery failed/);
});

test('Telegram rate limits retain the provided cooldown', async () => {
  const env = environment();
  globalThis.fetch = async (url) => url.includes('api.telegram.org')
    ? json({ok: false, error_code: 429, parameters: {retry_after: 42}}, 429) : new Response('video');
  await assert.rejects(sendTelegram('record', starks.mediaUrl, 632, env), (error) => error.retryAfter === 42);
});

test('a shared cooldown prevents every watcher from making additional requests', async () => {
  const env = environment({'telegram-retry-after': String(Date.now() + 60000)});
  globalThis.fetch = () => assert.fail('request during cooldown');
  await worker.scheduled({}, env, {});
});

const sourceRef = '1'.repeat(40);
const benchmark = (score) => ({id: ECDSA_BENCHMARK_ID, mode: 'scalar', direction: '-', sourceRef,
  promotionMode: 'automatic', sourceUrl: 'https://github.com/Layr-Labs/ecdsafail-challenge', currentBestScore: score});
const submission = (score = 900) => ({
  id: '11111111-1111-4111-8111-111111111111', benchmarkId: ECDSA_BENCHMARK_ID,
  status: 'accepted', promotionStatus: 'promoted', promotedSourceRef: sourceRef,
  officialScore: score, officialMetrics: {qubits: 10, toffoli: score / 10}, solverUsername: 'solver', note: 'Model: test model'
});
function ecdsaNetwork(record, deliver = () => json({ok: true})) {
  globalThis.fetch = async (url, options) => {
    if (url.includes('api.github.com')) return json({sha: sourceRef, message: `Validate submission ${record.id}\n`});
    if (url.includes('/submissions/')) return json({submission: record});
    if (url.includes('/benchmarks/')) return json({benchmark: benchmark(record.officialScore)});
    if (url === ecdsa.mediaUrl) return new Response('animation');
    if (url.includes('api.telegram.org')) return deliver(url, options);
    throw new Error(`Unexpected mock request: ${url}`);
  };
}
test('ECDSA seeds the current promoted record silently, then announces only an improvement', async () => {
  const env = environment();
  let sends = 0;
  ecdsaNetwork(submission(), () => { sends++; return json({ok: true}); });
  await checkEcdsa(ecdsa, env);
  await checkEcdsa(ecdsa, env);
  assert.equal(sends, 0);
  ecdsaNetwork(submission(800), (url, options) => {
    sends++;
    assert.ok(url.endsWith('/sendAnimation'));
    assert.equal(options.body.get('message_thread_id'), '142092');
    assert.equal(options.body.get('chat_id'), '-1004497882136');
    assert.ok(options.body.has('animation'));
    const caption = options.body.get('caption');
    assert.ok(caption.includes('10 qubits · 80 Toffoli'));
    assert.ok(caption.includes('11.11% lower product'));
    return json({ok: true, result: {message_id: 2}});
  });
  await checkEcdsa(ecdsa, env);
  await checkEcdsa(ecdsa, env);
  assert.equal(sends, 1);
  assert.equal((await env.STATE.get(ecdsa.stateKey, 'json')).score, 800);
});

test('an unpromoted ECDSA submission cannot establish a record or advance state', async () => {
  const env = environment();
  ecdsaNetwork({...submission(), promotionStatus: 'pending'});
  await assert.rejects(checkEcdsa(ecdsa, env), /no matching promoted submission/);
  assert.equal(await env.STATE.get(ecdsa.stateKey), null);
});

test('inconsistent ECDSA metrics cannot establish a record', async () => {
  const env = environment();
  ecdsaNetwork({...submission(), officialMetrics: {qubits: 10, toffoli: 91}});
  await assert.rejects(checkEcdsa(ecdsa, env), /no matching promoted submission/);
});

test('a promoted receipt from a different commit is refused', async () => {
  const env = environment();
  ecdsaNetwork({...submission(), promotedSourceRef: '2'.repeat(40)});
  await assert.rejects(checkEcdsa(ecdsa, env), /no matching promoted submission/);
});

test('a different benchmark identity is refused even with a better score', async () => {
  const env = environment();
  globalThis.fetch = async () => json({benchmark: {...benchmark(800), id: 'different-benchmark'}});
  await assert.rejects(checkEcdsa(ecdsa, env), /benchmark identity/);
});

test('failed ECDSA delivery does not consume the new record', async () => {
  const env = environment({[ecdsa.stateKey]: JSON.stringify({benchmark_id: ECDSA_BENCHMARK_ID, score: 1000})});
  ecdsaNetwork(submission(), () => json({ok: false, error_code: 400}, 400));
  await assert.rejects(checkEcdsa(ecdsa, env), /delivery failed/);
  assert.equal((await env.STATE.get(ecdsa.stateKey, 'json')).score, 1000);
});
