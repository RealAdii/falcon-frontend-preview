import {readFile, writeFile} from 'node:fs/promises';

const resultsUrl = process.env.FALCON_RESULTS_URL || 'https://falcon.provably.fast/api/participation/falcon/results';
const botToken = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;
const stateFile = process.env.TELEGRAM_STATE_FILE || '.telegram-watcher-state.json';
const intervalMs = Number(process.env.TELEGRAM_POLL_INTERVAL_MS || 60000);
const announceCurrent = process.env.TELEGRAM_ANNOUNCE_CURRENT === 'true';

if (!botToken || !chatId) {
  console.error('Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID before starting the watcher.');
  process.exit(1);
}

const escapeHtml = (value) => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;');

const formatGas = (value) => Number(value).toLocaleString('en-US');

async function loadState() {
  try {
    return JSON.parse(await readFile(stateFile, 'utf8'));
  } catch {
    return {recordGas: null, jobId: null};
  }
}

async function saveState(record) {
  await writeFile(stateFile, JSON.stringify({recordGas: record.score_l2_gas, jobId: record.job_id, updatedAt: new Date().toISOString()}, null, 2) + '\n');
}

async function fetchBoard() {
  const response = await fetch(resultsUrl, {signal: AbortSignal.timeout(10000), cache: 'no-store'});
  if (!response.ok) throw new Error(`Falcon results returned ${response.status}`);
  const board = await response.json();
  const record = board.record;
  const baseline = Number(board.baseline?.score_l2_gas);
  if (board.schema_version !== 1 || board.lane !== 'FALCON_512_GAS' || !record || !Number.isFinite(Number(record.score_l2_gas)) || !Number.isFinite(baseline)) {
    throw new Error('Falcon results did not match the expected schema');
  }
  return {record: {...record, score_l2_gas: Number(record.score_l2_gas)}, baseline};
}

function formatMessage(record, baseline) {
  const saved = Math.max(0, baseline - record.score_l2_gas);
  const percent = baseline > 0 ? ((saved / baseline) * 100).toFixed(1) : '0.0';
  const contributor = record.github_login || 'Open contributor';
  const model = record.model || record.model_name || 'Evaluator run';
  const jobLink = record.job_id ? `https://falcon.provably.fast/code?job=${encodeURIComponent(record.job_id)}` : 'https://falcon.provably.fast/record';
  return [
    '🏆 <b>NEW FALCON RECORD</b>',
    `${escapeHtml(contributor)} · ${escapeHtml(model)}`,
    `<b>${formatGas(record.score_l2_gas)} gas</b>`,
    `<b>${percent}% less gas</b> · ${formatGas(saved)} gas saved`,
    '',
    `<a href="${jobLink}">Open record ↗</a>`
  ].join('\n');
}

async function sendTelegram(text) {
  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: {'content-type': 'application/json'},
    body: JSON.stringify({chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true})
  });
  if (!response.ok) throw new Error(`Telegram returned ${response.status}: ${await response.text()}`);
}

async function checkOnce() {
  const {record, baseline} = await fetchBoard();
  const state = await loadState();
  const isNewRecord = Number.isFinite(state.recordGas) && record.score_l2_gas < state.recordGas;
  const shouldAnnounce = isNewRecord || (state.recordGas === null && announceCurrent);
  if (shouldAnnounce) {
    await sendTelegram(formatMessage(record, baseline));
    console.log(`Announced record: ${record.score_l2_gas}`);
  } else {
    console.log(`Checked record: ${record.score_l2_gas}`);
  }
  if (state.recordGas === null || record.score_l2_gas < state.recordGas || record.job_id !== state.jobId) await saveState(record);
}

async function run() {
  await checkOnce();
  if (process.env.TELEGRAM_ONCE === 'true') return;
  setInterval(() => checkOnce().catch((error) => console.error(`[watcher] ${error.message}`)), intervalMs);
  console.log(`Watching Falcon every ${Math.round(intervalMs / 1000)} seconds.`);
}

run().catch((error) => {
  console.error(`[watcher] ${error.message}`);
  process.exit(1);
});
