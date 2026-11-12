import {captionText, sendTelegram} from './telegram.js';

export const ECDSA_BENCHMARK_ID = '1ffb695a-309b-46b6-a728-2f97d8c7be74';
const API = 'https://api.ecdsa.fail/api';
const REQUEST_OPTIONS = {headers: {'user-agent': 'provably-fast-telegram-watcher/1.0', 'cache-control': 'no-cache'}};
const integer = (value) => Number.isSafeInteger(value) && value > 0;

async function get(path) {
  const response = await fetch(`${API}${path}`, {...REQUEST_OPTIONS, signal: AbortSignal.timeout(15000)});
  if (!response.ok) throw new Error(`ECDSA.fail API returned ${response.status}`);
  return response.json();
}

export async function getEcdsaBenchmark() {
  const {benchmark} = await get(`/benchmarks/${ECDSA_BENCHMARK_ID}`);
  if (benchmark?.id !== ECDSA_BENCHMARK_ID || benchmark.mode !== 'scalar'
      || benchmark.direction !== '-' || benchmark.promotionMode !== 'automatic'
      || benchmark.sourceUrl !== 'https://github.com/Layr-Labs/ecdsafail-challenge'
      || !integer(benchmark.currentBestScore)) throw new Error('Unexpected ECDSA.fail benchmark identity or score');
  return benchmark;
}

export async function checkEcdsa(watch, env) {
  const benchmark = await getEcdsaBenchmark();
  const previous = await env.STATE.get(watch.stateKey, 'json');
  if (previous && (previous.benchmark_id !== ECDSA_BENCHMARK_ID || !integer(previous.score))) {
    throw new Error('Unexpected ECDSA.fail watcher state');
  }
  if (previous && benchmark.currentBestScore >= previous.score) return;
  // The all-submissions response exceeds 30 MB. Resolve the pinned promotion
  // commit to one submission, then validate that receipt against the benchmark.
  if (!/^[0-9a-f]{40}$/.test(benchmark.sourceRef)) throw new Error('Invalid ECDSA.fail source commit');
  const commitResponse = await fetch(`https://api.github.com/repos/Layr-Labs/ecdsafail-challenge/git/commits/${benchmark.sourceRef}`, {
    headers: {'user-agent': 'provably-fast-telegram-watcher/1.0', accept: 'application/vnd.github+json'},
    signal: AbortSignal.timeout(15000)
  });
  if (!commitResponse.ok) throw new Error(`ECDSA.fail promotion commit returned ${commitResponse.status}`);
  const commit = await commitResponse.json();
  const submissionId = /^Validate submission ([0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12})(?:\n|$)/.exec(commit.message || '')?.[1];
  if (commit.sha !== benchmark.sourceRef || !submissionId) throw new Error('ECDSA.fail promotion commit has no submission identity');
  const {submission: record} = await get(`/submissions/${submissionId}`);
  if (!record || record.id !== submissionId || record.benchmarkId !== ECDSA_BENCHMARK_ID
    || record.status !== 'accepted' || record.promotionStatus !== 'promoted'
    || record.promotedSourceRef !== benchmark.sourceRef
    || record.officialScore !== benchmark.currentBestScore
    || !integer(record.officialMetrics?.qubits) || !integer(record.officialMetrics?.toffoli)
    || record.officialMetrics.qubits * record.officialMetrics.toffoli !== record.officialScore) {
    throw new Error('ECDSA.fail best score has no matching promoted submission');
  }
  if (previous) {
    const number = (value) => value.toLocaleString('en-US');
    const percent = ((previous.score - record.officialScore) / previous.score * 100).toFixed(2);
    const model = /^Model:\s*(.+)$/im.exec(record.note || '')?.[1];
    const caption = [
      '🏆 <b>NEW ECDSA.FAIL RECORD</b>',
      '',
      captionText(record.solverUsername || 'Open contributor', 100),
      model ? captionText(model, 100) : '',
      '',
      `<b>${number(record.officialMetrics.qubits)} qubits · ${number(record.officialMetrics.toffoli)} Toffoli</b>`,
      `Q × T: <b>${number(record.officialScore)}</b>`,
      `${percent}% lower product than the previous record`,
      '',
      'Evaluator-promoted circuit result.',
      '<a href="https://ecdsa.fail/">Open ECDSA.fail ↗</a>',
      `<a href="${API}/submissions/${record.id}">Submission receipt ↗</a>`
    ].filter((line) => line !== null).join('\n');
    await sendTelegram(caption, watch.mediaUrl, watch.threadId, {...env, TELEGRAM_CHAT_ID: watch.chatId}, true);
  }
  await env.STATE.put(watch.stateKey, JSON.stringify({
    benchmark_id: ECDSA_BENCHMARK_ID, score: record.officialScore,
    submission_id: record.id, updated_at: new Date().toISOString()
  }));
  console.log(JSON.stringify({watch: watch.name, action: previous ? 'announced' : 'seeded', score: record.officialScore}));
}
