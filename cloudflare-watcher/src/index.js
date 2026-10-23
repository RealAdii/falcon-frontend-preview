const BASE_URL = 'https://falcon.provably.fast';
const REPO_RAW_URL = 'https://raw.githubusercontent.com/RealAdii/falcon-frontend-preview/main/assets';
const WATCHES = [
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
    mediaUrl: `${REPO_RAW_URL}/swapped.mp4`,
    threadId: 438
  },
  {
    name: 'MLDSA87',
    title: 'NEW ML-DSA-87 RECORD',
    resultsUrl: `${BASE_URL}/api/participation/mldsa87/results`,
    lane: 'ML_DSA_87_GAS',
    stateKey: 'latest-mldsa87-record',
    mediaUrl: `${REPO_RAW_URL}/mldsa44.mp4`,
    threadId: 441
  }
];

const escapeHtml = (value) => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;');

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

async function sendTelegram(text, mediaUrl, threadId, env) {
  const media = await fetch(mediaUrl);
  if (!media.ok) throw new Error(`Announcement media returned ${media.status}`);

  const form = new FormData();
  form.append('chat_id', env.TELEGRAM_CHAT_ID);
  form.append('video', await media.blob(), 'swapped.mp4');
  form.append('caption', text);
  form.append('parse_mode', 'HTML');
  if (threadId !== null) form.append('message_thread_id', String(threadId));

  const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendVideo`, {
    method: 'POST',
    body: form
  });
  if (!response.ok) throw new Error(`Telegram returned ${response.status}`);
}

export default {
  async scheduled(controller, env, ctx) {
    for (const watch of WATCHES) {
      try {
        await checkForRecord(watch, env);
      } catch (error) {
        console.error(`${watch.name} watcher failed`, error instanceof Error ? error.stack : error);
      }
    }
  },

  async fetch(request, env) {
    return new Response('Falcon Telegram watcher is running.');
  }
};

async function checkForRecord(watch, env) {
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
