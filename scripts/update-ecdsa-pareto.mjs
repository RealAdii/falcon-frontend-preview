import {createHash} from 'node:crypto';
import {writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {getEcdsaBenchmark, ECDSA_BENCHMARK_ID} from '../cloudflare-watcher/src/ecdsa.js';
import {paretoPoint, paretoFrontier, validateProjection, PARETO_FEED_URL, PARETO_SOURCE_URL} from '../cloudflare-watcher/src/ecdsa-pareto.js';
import {submissionObjects} from '../cloudflare-watcher/src/submissions-stream.js';

export async function buildProjection(body, {sourceCommit, sourceEtag, generatedAt = new Date().toISOString()}) {
  const hash = createHash('sha256');
  const hashed = body.pipeThrough(new TransformStream({transform(chunk, controller) {hash.update(chunk); controller.enqueue(chunk);}}));
  const points = [], ids = new Set();
  let rows = 0;
  for await (const row of submissionObjects(hashed)) {
    rows++;
    const point = paretoPoint(row);
    if (!point) continue;
    if (ids.has(point.id)) throw new Error('Duplicate ECDSA.fail submission identity');
    ids.add(point.id); points.push(point);
  }
  if (!points.length) throw new Error('ECDSA.fail feed contains no scored submissions');
  const groups = new Map();
  for (const point of points) {
    const key = `${point.qubits}:${point.toffoli}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(point.id);
  }
  return validateProjection({schema: 'ecdsa-pareto/v1', benchmark_id: ECDSA_BENCHMARK_ID,
    policy: 'official-score-only-rejection/v1', generated_at: generatedAt,
    source_url: PARETO_SOURCE_URL, source_commit: sourceCommit, source_sha256: hash.digest('hex'),
    source_etag: sourceEtag, submission_count: rows, eligible_ids: [...ids],
    frontier: paretoFrontier(points).map((point) => ({...point, equivalent_ids: groups.get(`${point.qubits}:${point.toffoli}`)}))});
}

async function main() {
  const out = process.argv[2];
  const sourceCommit = process.env.GITHUB_SHA;
  if (!out || !/^[0-9a-f]{40}$/.test(sourceCommit || '')) throw new Error('Provide output path and GITHUB_SHA');
  await getEcdsaBenchmark();
  const headers = {'user-agent': 'provably-fast-pareto-publisher/1.0'};
  let previous;
  const cached = await fetch(PARETO_FEED_URL, {headers, signal: AbortSignal.timeout(15000)});
  if (cached.ok) {
    previous = validateProjection(await cached.json(), true);
    if (previous.source_commit !== sourceCommit) previous = null;
  } else if (cached.status !== 404) throw new Error(`Previous Pareto projection returned ${cached.status}`);
  if (previous?.source_etag) headers['if-none-match'] = previous.source_etag;
  const response = await fetch(PARETO_SOURCE_URL, {headers, signal: AbortSignal.timeout(90000)});
  let projection;
  if (response.status === 304 && previous) projection = validateProjection({...previous, generated_at: new Date().toISOString()});
  else {
    if (!response.ok) throw new Error(`ECDSA submissions returned ${response.status}`);
    projection = await buildProjection(response.body, {sourceCommit, sourceEtag: response.headers.get('etag')});
  }
  await writeFile(out, JSON.stringify(projection) + '\n');
  console.log(JSON.stringify({submissions: projection.submission_count, eligible: projection.eligible_ids.length,
    frontier: projection.frontier.length, reused: response.status === 304}));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {console.error(error.message); process.exitCode = 1;});
}
