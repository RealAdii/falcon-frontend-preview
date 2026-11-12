import {captionText, escapeHtml, sendTelegram, TelegramRateLimitError} from './telegram.js';
import {checkEcdsa} from './ecdsa.js';

const BASE_URL = 'https://falcon.provably.fast';
const REPO_RAW_URL = 'https://raw.githubusercontent.com/RealAdii/falcon-frontend-preview/main/assets';
const STARKS_RECORD_URL = 'https://starks.provably.fast/data/mathematics.json';
const STARKS_MEDIA_URL = `${REPO_RAW_URL}/starks-send-it.gif.mp4`;
export const WATCHES = [
  {
    name: 'ECDSA',
    stateKey: 'latest-ecdsa-record',
    mediaUrl: `${REPO_RAW_URL}/ecdsa-record.mp4`,
    chatId: '-1004497882136',
    threadId: 142092,
    type: 'ecdsa'
  },
  {
    name: 'STARKS',
    title: 'NEW STARKS CONTRIBUTION',
    resultsUrl: STARKS_RECORD_URL,
    stateKey: 'latest-starks-contribution',
    mediaUrl: STARKS_MEDIA_URL,
    threadId: 632,
    type: 'mathematics'
  },
  {
    name: 'FALCON',
    title: 'NEW FALCON RECORD',
    resultsUrl: `${BASE_URL}/api/participation/falcon/results`,
    lane: 'FALCON_512_GAS',
    stateKey: 'latest-record',
    mediaUrl: `${REPO_RAW_URL}/swapped.mp4`,
    threadId: 437
  },
  {
    name: 'MLDSA44',
    title: 'NEW ML-DSA-44 RECORD',
    resultsUrl: `${BASE_URL}/api/participation/mldsa/results`,
    lane: 'ML_DSA_44_GAS',
    stateKey: 'latest-mldsa44-record',
    mediaUrl: `${REPO_RAW_URL}/mldsa44.mp4`,
    threadId: 440
  },
  {
    name: 'FALCON1024',
    title: 'NEW FALCON-1024 RECORD',
    resultsUrl: `${BASE_URL}/api/participation/falcon1024/results`,
    lane: 'FALCON_1024_GAS',
    stateKey: 'latest-falcon1024-record',
    mediaUrl: `${REPO_RAW_URL}/falcon1024.mp4`,
    threadId: 438
  },
  {
    name: 'MLDSA87',
    title: 'NEW ML-DSA-87 RECORD',
    resultsUrl: `${BASE_URL}/api/participation/mldsa87/results`,
    lane: 'ML_DSA_87_GAS',
    stateKey: 'latest-mldsa87-record',
    mediaUrl: `${REPO_RAW_URL}/mldsa87.mp4`,
    threadId: 441
  },
  {
    name: 'SLHDSA128S',
    title: 'NEW SLH-DSA-128s RECORD',
    resultsUrl: 'https://postquantum.provably.fast/api/participation/slhdsa/results',
    lane: 'SLH_DSA_128S_GAS',
    stateKey: 'latest-slhdsa128s-record',
    mediaUrl: `${REPO_RAW_URL}/mldsa87.mp4`,
    threadId: 561
  }
];

const formatGas = (value) => Number(value).toLocaleString('en-US');

function formatMessage(record, comparisonGas, title) {
  const saved = Math.max(0, comparisonGas - record.score_l2_gas);
  const percent = comparisonGas > 0 ? ((saved / comparisonGas) * 100).toFixed(1) : '0.0';
  const contributor = record.github_login || 'Open contributor';
  const model = record.model || record.model_name || 'Evaluator run';
  const jobLink = record.job_id
    ? `https://falcon.provably.fast/code?job=${encodeURIComponent(record.job_id)}`
    : 'https://falcon.provably.fast/record';

  return [
    `🏆 <b>${title}</b>`,
    '',
    `${escapeHtml(contributor)} · ${escapeHtml(model)}`,
    '',
    `<b>${formatGas(record.score_l2_gas)} gas</b>`,
    `<b>${percent}% less gas</b> · ${formatGas(saved)} gas saved`,
    '',
    `<a href="${jobLink}">Open record ↗</a>`
  ].join('\n');
}

async function getBoard(watch) {
  const response = await fetch(watch.resultsUrl, {signal: AbortSignal.timeout(10000)});
  if (!response.ok) throw new Error(`${watch.name} results returned ${response.status}`);
  const board = await response.json();
  const record = board.record;
  const baseline = Number(board.baseline?.score_l2_gas);
  if (board.schema_version !== 1 || board.lane !== watch.lane || !record || !Number.isFinite(Number(record.score_l2_gas)) || !Number.isFinite(baseline)) {
    throw new Error(`Unexpected ${watch.name} results schema`);
  }
  return {record: {...record, score_l2_gas: Number(record.score_l2_gas)}, baseline};
}

export default {
  async scheduled(controller, env, ctx) {
    const retryAt = Number(await env.STATE.get('telegram-retry-after'));
    if (retryAt > Date.now()) {
      console.log('Telegram cooldown active; announcements deferred');
      return;
    }
    for (const watch of WATCHES) {
      try {
        await checkForRecord(watch, env);
      } catch (error) {
        console.error(`${watch.name} watcher failed`, error instanceof Error ? error.message : String(error));
        if (error instanceof TelegramRateLimitError) {
          await env.STATE.put('telegram-retry-after', String(Date.now() + error.retryAfter * 1000));
          break;
        }
      }
    }
  },

  async fetch(request, env) {
    return new Response('Falcon Telegram watcher is running.');
  }
};

async function checkForRecord(watch, env) {
  if (watch.type === 'ecdsa') return checkEcdsa(watch, env);
  if (watch.type === 'mathematics') return checkStarks(watch, env);
  const {record} = await getBoard(watch);
  const previous = await env.STATE.get(watch.stateKey, 'json');
  const shouldAnnounce = previous && record.score_l2_gas < Number(previous.score_l2_gas);

  console.log(JSON.stringify({
    current_score_l2_gas: record.score_l2_gas,
    previous_score_l2_gas: previous?.score_l2_gas ?? null,
    should_announce: Boolean(shouldAnnounce),
    job_id: record.job_id,
    watch: watch.name
  }));

  if (shouldAnnounce && watch.threadId === null) throw new Error(`${watch.name} topic ID is not configured`);
  if (shouldAnnounce) await sendTelegram(formatMessage(record, Number(previous.score_l2_gas), watch.title), watch.mediaUrl, watch.threadId, env);
  if (!previous || record.score_l2_gas < Number(previous.score_l2_gas)) {
    await env.STATE.put(watch.stateKey, JSON.stringify({score_l2_gas: record.score_l2_gas, job_id: record.job_id, updated_at: new Date().toISOString()}));
    console.log(`${watch.name} watcher state updated`);
  }
}

export async function checkStarks(watch, env) {
  const response = await fetch(watch.resultsUrl, {signal: AbortSignal.timeout(15000), headers: {'cache-control': 'no-cache'}});
  if (!response.ok) throw new Error(`STARKs record returned ${response.status}`);
  const board = await response.json();
  if (board.schema !== 'proven-mathematics/0' || !Array.isArray(board.contributions)) throw new Error('Unexpected STARKs mathematics record schema');
  const previous = await env.STATE.get(watch.stateKey, 'json');
  const accepted = board.contributions.filter((item) => item.status === 'accepted');
  if (accepted.some((item) => !/^M-\d{4,}$/.test(item.id))
      || new Set(accepted.map((item) => item.id)).size !== accepted.length) {
    throw new Error('Invalid or duplicate STARKS contribution identity');
  }
  const latest = accepted[0];
  // Legacy state was truncated and only saved after the whole batch. Reseed it once
  // without replaying the historical backlog into the group.
  if (!previous || previous.version !== 2) {
    await env.STATE.put(watch.stateKey, JSON.stringify({version: 2, ids: accepted.map((item) => item.id), latest_id: latest?.id || null, updated_at: new Date().toISOString()}));
    console.log(JSON.stringify({watch: watch.name, action: 'seeded', accepted: accepted.length}));
    return;
  }
  if (!Array.isArray(previous.ids) || previous.ids.some((id) => !/^M-\d{4,}$/.test(id))) {
    throw new Error('Invalid STARKS watcher state');
  }
  const ids = new Set(previous.ids);
  const fresh = accepted.filter((item) => !ids.has(item.id)).sort((a, b) => Number(a.id.slice(2)) - Number(b.id.slice(2))).slice(0, 3);
  for (const item of fresh) {
    const person = (item.who || []).join(', ') || 'Open contributor';
    const target = (board.targets || []).find((entry) => entry.id === item.target);
    let link = 'https://starks.provably.fast/record';
    try {
      const candidate = new URL(item.url);
      if (candidate.protocol === 'https:' && candidate.hostname === 'starks.provably.fast'
          && !candidate.username && !candidate.password && escapeHtml(candidate.href).length <= 180) link = candidate.href;
    } catch { /* Use the record page when the row has no public URL. */ }
    const budget = captionText;
    const caption = [
      `🏆 <b>${budget(item.target || 'STARKs', 30)} CONTRIBUTION ACCEPTED</b>`,
      '',
      `${budget(person, 100)} · ${budget(item.kind || 'contribution', 35)}`,
      '',
      `<b>${budget(item.title || 'New accepted contribution', 450)}</b>`,
      target ? `Target: ${budget(target.title, 100)}` : '',
      '',
      `<a href="${escapeHtml(link)}">Open contribution ↗</a>`
    ].filter(Boolean).join('\n');
    await sendTelegram(caption, watch.mediaUrl, watch.threadId, env);
    ids.add(item.id);
    // Retain successful delivery before attempting another message.
    await env.STATE.put(watch.stateKey, JSON.stringify({version: 2, ids: [...ids], latest_id: item.id, updated_at: new Date().toISOString()}));
    console.log(JSON.stringify({watch: watch.name, action: 'announced', id: item.id}));
    // KV permits one write per second to a key. Also space Telegram group sends.
    if (item !== fresh[fresh.length - 1]) await new Promise((resolve) => setTimeout(resolve, 1100));
  }
}
