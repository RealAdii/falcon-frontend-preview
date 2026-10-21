const RESULTS_URL = 'https://falcon.provably.fast/api/participation/falcon/results';
const STATE_KEY = 'latest-record';

const escapeHtml = (value) => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;');

const formatGas = (value) => Number(value).toLocaleString('en-US');

function formatMessage(record, baseline) {
  const saved = Math.max(0, baseline - record.score_l2_gas);
  const percent = baseline > 0 ? ((saved / baseline) * 100).toFixed(1) : '0.0';
  const contributor = record.github_login ? `@${record.github_login}` : 'Open contributor';
  const model = record.model || record.model_name || 'Evaluator run';
  const jobLink = record.job_id
    ? `https://falcon.provably.fast/code?job=${encodeURIComponent(record.job_id)}`
    : 'https://falcon.provably.fast/record';

  return [
    '🏆 <b>NEW FALCON RECORD</b>',
    '',
    `${escapeHtml(contributor)} · ${escapeHtml(model)}`,
    '',
    `<b>${formatGas(record.score_l2_gas)} gas</b>`,
    `<b>${percent}% less gas</b> · ${formatGas(saved)} gas saved`,
    '',
    `<a href="${jobLink}">Open record ↗</a>`
  ].join('\n');
}

async function getBoard() {
  const response = await fetch(RESULTS_URL, {signal: AbortSignal.timeout(10000)});
  if (!response.ok) throw new Error(`Falcon results returned ${response.status}`);
  const board = await response.json();
  const record = board.record;
  const baseline = Number(board.baseline?.score_l2_gas);
  if (board.schema_version !== 1 || board.lane !== 'FALCON_512_GAS' || !record || !Number.isFinite(Number(record.score_l2_gas)) || !Number.isFinite(baseline)) {
    throw new Error('Unexpected Falcon results schema');
  }
  return {record: {...record, score_l2_gas: Number(record.score_l2_gas)}, baseline};
}

async function sendTelegram(text, env) {
  const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: {'content-type': 'application/json'},
    body: JSON.stringify({chat_id: env.TELEGRAM_CHAT_ID, text, parse_mode: 'HTML', disable_web_page_preview: true})
  });
  if (!response.ok) throw new Error(`Telegram returned ${response.status}`);
}

export default {
  async scheduled(controller, env, ctx) {
    ctx.waitUntil(checkForRecord(env));
  },

  async fetch() {
    return new Response('Falcon Telegram watcher is running.');
  }
};

async function checkForRecord(env) {
  const {record, baseline} = await getBoard();
  const previous = await env.STATE.get(STATE_KEY, 'json');
  const shouldAnnounce = previous && record.score_l2_gas < Number(previous.score_l2_gas);

  if (shouldAnnounce) await sendTelegram(formatMessage(record, baseline), env);
  if (!previous || record.score_l2_gas < Number(previous.score_l2_gas)) {
    await env.STATE.put(STATE_KEY, JSON.stringify({score_l2_gas: record.score_l2_gas, job_id: record.job_id, updated_at: new Date().toISOString()}));
  }
}
