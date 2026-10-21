const RESULTS_URL = 'https://falcon.provably.fast/api/participation/falcon/results';
const STATE_KEY = 'latest-record';
const MEDIA_URL = 'https://raw.githubusercontent.com/RealAdii/falcon-frontend-preview/main/assets/swapped.mp4';

const escapeHtml = (value) => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;');

const formatGas = (value) => Number(value).toLocaleString('en-US');

function formatMessage(record, baseline) {
  const saved = Math.max(0, baseline - record.score_l2_gas);
  const percent = baseline > 0 ? ((saved / baseline) * 100).toFixed(1) : '0.0';
  const contributor = record.github_login || 'Open contributor';
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
  const media = await fetch(MEDIA_URL);
  if (!media.ok) throw new Error(`Announcement media returned ${media.status}`);

  const form = new FormData();
  form.append('chat_id', env.TELEGRAM_CHAT_ID);
  form.append('video', await media.blob(), 'swapped.mp4');
  form.append('caption', text);
  form.append('parse_mode', 'HTML');

  const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendVideo`, {
    method: 'POST',
    body: form
  });
  if (!response.ok) throw new Error(`Telegram returned ${response.status}`);
}

export default {
  async scheduled(controller, env, ctx) {
    try {
      await checkForRecord(env);
    } catch (error) {
      console.error('Falcon watcher failed', error instanceof Error ? error.stack : error);
      throw error;
    }
  },

  async fetch(request, env) {
    return new Response('Falcon Telegram watcher is running.');
  }
};

async function checkForRecord(env) {
  const {record, baseline} = await getBoard();
  const previous = await env.STATE.get(STATE_KEY, 'json');
  const shouldAnnounce = previous && record.score_l2_gas < Number(previous.score_l2_gas);

  console.log(JSON.stringify({
    current_score_l2_gas: record.score_l2_gas,
    previous_score_l2_gas: previous?.score_l2_gas ?? null,
    should_announce: Boolean(shouldAnnounce),
    job_id: record.job_id
  }));

  if (shouldAnnounce) await sendTelegram(formatMessage(record, baseline), env);
  if (!previous || record.score_l2_gas < Number(previous.score_l2_gas)) {
    await env.STATE.put(STATE_KEY, JSON.stringify({score_l2_gas: record.score_l2_gas, job_id: record.job_id, updated_at: new Date().toISOString()}));
    console.log('Falcon watcher state updated');
  }
}
