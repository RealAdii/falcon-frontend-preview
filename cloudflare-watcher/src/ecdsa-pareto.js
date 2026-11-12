import {ECDSA_BENCHMARK_ID, getEcdsaBenchmark} from './ecdsa.js';
import {captionText, sendTelegram} from './telegram.js';

const API = 'https://api.ecdsa.fail/api';
const UUID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;
const integer = (value) => Number.isSafeInteger(value) && value > 0;
const SCORE_ONLY = 'score did not improve current best';
export const PARETO_FEED_URL = 'https://raw.githubusercontent.com/RealAdii/falcon-frontend-preview/ecdsa-pareto-feed/ecdsa-pareto.json';
export const PARETO_SOURCE_URL = `${API}/benchmarks/${ECDSA_BENCHMARK_ID}/submissions`;

export function validateProjection(feed, allowStale = false) {
  const age = Date.now() - Date.parse(feed?.generated_at);
  if (feed?.schema !== 'ecdsa-pareto/v1' || feed.benchmark_id !== ECDSA_BENCHMARK_ID
      || feed.policy !== 'official-score-only-rejection/v1' || feed.source_url !== PARETO_SOURCE_URL
      || !/^[0-9a-f]{64}$/.test(feed.source_sha256) || !/^[0-9a-f]{40}$/.test(feed.source_commit)
      || !(feed.source_etag === null || typeof feed.source_etag === 'string' && feed.source_etag.length <= 256)
      || !Number.isFinite(age) || age < -300000 || !allowStale && age > 30 * 60 * 1000
      || !Array.isArray(feed.eligible_ids) || !feed.eligible_ids.length
      || feed.eligible_ids.some((id) => !UUID.test(id))
      || new Set(feed.eligible_ids).size !== feed.eligible_ids.length
      || !Array.isArray(feed.frontier) || !feed.frontier.length) throw new Error('Invalid or stale ECDSA Pareto projection');
  const ids = new Set(feed.eligible_ids), groupedIds = new Set();
  for (const point of feed.frontier) {
    if (!ids.has(point.id) || !integer(point.qubits) || !integer(point.toffoli)
        || !integer(point.score) || point.score !== point.qubits * point.toffoli
        || !Number.isFinite(point.when) || !['accepted', 'rejected'].includes(point.status)
        || typeof point.who !== 'string' || point.who.length > 100
        || !(point.model === null || typeof point.model === 'string' && point.model.length <= 100)
        || !Array.isArray(point.equivalent_ids) || !point.equivalent_ids.includes(point.id)
        || new Set(point.equivalent_ids).size !== point.equivalent_ids.length
        || point.equivalent_ids.some((id) => !ids.has(id) || groupedIds.has(id))) {
      throw new Error('Invalid ECDSA Pareto frontier point');
    }
    for (const id of point.equivalent_ids) groupedIds.add(id);
  }
  if (paretoFrontier(feed.frontier).length !== feed.frontier.length) throw new Error('Dominated or repeated ECDSA Pareto projection points');
  return feed;
}

export function paretoPoint(row) {
  const q = row?.officialMetrics?.qubits, t = row?.officialMetrics?.toffoli;
  if (row?.benchmarkId !== ECDSA_BENCHMARK_ID || !UUID.test(row.id)
      || !integer(q) || !integer(t) || !integer(row.officialScore) || q * t !== row.officialScore
      || !(row.status === 'accepted' || row.status === 'rejected' && row.rejectionReason === SCORE_ONLY)) return null;
  const when = Date.parse(row.scorePublishedAt || row.createdAt);
  if (!Number.isFinite(when)) return null;
  return {id: row.id, qubits: q, toffoli: t, score: row.officialScore, when,
    status: row.status, who: String(row.solverUsername || 'Open contributor').slice(0, 100),
    model: /^Model:\s*(.+)$/im.exec(row.note || '')?.[1]?.slice(0, 100) || null};
}

export function paretoFrontier(points) {
  const sorted = [...points].sort((a, b) => a.qubits - b.qubits || a.toffoli - b.toffoli
    || a.when - b.when || a.id.localeCompare(b.id));
  const frontier = [];
  let bestToffoli = Infinity;
  for (const point of sorted) {
    // Equality is a reproduction, not a new frontier point.
    if (point.toffoli < bestToffoli) {
      frontier.push(point);
      bestToffoli = point.toffoli;
    }
  }
  return frontier;
}

export async function checkEcdsaPareto(watch, env) {
  await getEcdsaBenchmark();
  const previous = await env.STATE.get(watch.stateKey, 'json');
  if (previous && (previous.version !== 1 || previous.benchmark_id !== ECDSA_BENCHMARK_ID
      || !Array.isArray(previous.seen_ids) || previous.seen_ids.some((id) => !UUID.test(id))
      || !Array.isArray(previous.pending) || !Number.isFinite(Date.parse(previous.generated_at)))) throw new Error('Invalid ECDSA.fail Pareto watcher state');
  const headers = {'user-agent': 'provably-fast-telegram-watcher/1.0'};
  if (typeof previous?.etag === 'string') headers['if-none-match'] = previous.etag;
  const response = await fetch(PARETO_FEED_URL, {
    headers, signal: AbortSignal.timeout(15000)
  });
  let seen = new Set(previous?.seen_ids || []), pending = previous?.pending || [];
  let frontier = previous?.frontier || [], etag = previous?.etag || null;
  if (response.status === 304) {
    if (!previous) throw new Error('ECDSA.fail returned unchanged feed without a saved snapshot');
    if (Date.now() - Date.parse(previous.generated_at) > 30 * 60 * 1000) throw new Error('Stale ECDSA Pareto projection');
  } else {
    if (!response.ok) throw new Error(`ECDSA.fail Pareto feed returned ${response.status}`);
    const feed = validateProjection(await response.json());
    frontier = feed.frontier;
    const feedIds = new Set(feed.eligible_ids);
    etag = response.headers.get('etag');
    if (!previous) {
      await env.STATE.put(watch.stateKey, JSON.stringify({version: 1, benchmark_id: ECDSA_BENCHMARK_ID,
        seen_ids: [...feedIds], frontier, pending: [], etag, generated_at: feed.generated_at, updated_at: new Date().toISOString()}));
      console.log(JSON.stringify({watch: watch.name, action: 'seeded', scored: feedIds.size, frontier: frontier.length}));
      return;
    }
    // Product winners are announced by the existing watcher. Include them in the
    // dominance calculation, but only score-only rejections need this extra notice.
    pending = frontier.filter((point) => point.status === 'rejected' && !seen.has(point.id)
      && !point.equivalent_ids.some((id) => seen.has(id)))
      .sort((a, b) => a.when - b.when || a.id.localeCompare(b.id));
    const pendingIds = new Set(pending.flatMap((point) => point.equivalent_ids));
    for (const id of feedIds) if (!pendingIds.has(id)) seen.add(id);
    previous.generated_at = feed.generated_at;
  }
  const point = pending[0];
  if (point) {
    const number = (value) => value.toLocaleString('en-US');
    const caption = [
      '📈 <b>NEW ECDSA.FAIL PARETO POINT</b>', '',
      captionText(point.who, 100), point.model ? `Model: ${captionText(point.model, 100)}` : '', '',
      `<b>${number(point.qubits)} qubits · ${number(point.toffoli)} Toffoli</b>`,
      `Q × T: <b>${number(point.score)}</b>`, '',
      'A new point on the qubit/Toffoli frontier.',
      'Evaluator-scored. Product record unchanged.',
      'The API labels this <code>rejected</code> only because its product did not beat the record.', '',
      `<a href="${API}/submissions/${point.id}">Submission receipt ↗</a>`
    ].join('\n');
    await sendTelegram(caption, watch.mediaUrl, watch.threadId, {...env, TELEGRAM_CHAT_ID: watch.chatId}, true);
    seen.add(point.id);
    pending = pending.slice(1);
    console.log(JSON.stringify({watch: watch.name, action: 'announced', id: point.id, qubits: point.qubits, toffoli: point.toffoli}));
  }
  if (point || response.status !== 304) {
    await env.STATE.put(watch.stateKey, JSON.stringify({version: 1, benchmark_id: ECDSA_BENCHMARK_ID,
      seen_ids: [...seen], frontier, pending, etag, generated_at: previous.generated_at, updated_at: new Date().toISOString()}));
  }
}
