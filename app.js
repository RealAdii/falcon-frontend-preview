if (location.pathname !== '/' && location.pathname !== '/index.html') { await import('./pages.js'); } else {
const $ = (selector) => document.querySelector(selector);
const motion = matchMedia('(prefers-reduced-motion: reduce)');
const canvas = $('#flight'), ctx = canvas.getContext('2d');
let width = 0, height = 0, frame = 0, elapsed = 0, last = 0;
let paused = motion.matches, inView = true, pending = false;
const snapshot = { baseline: 48398466, record: 27915721 };
let baselineGas = snapshot.baseline, recordGas = snapshot.record;
let costs = [baselineGas, recordGas];
const clamp = (n) => Math.max(0, Math.min(1, n));
const smooth = (n) => { n = clamp(n); return n * n * (3 - 2 * n); };
const millions = (n) => (n / 1e6).toFixed(1) + 'M';
let seed=512;function rand(){seed=(seed*16807)%2147483647;return(seed-1)/2147483646;}
const points=[];
function triangle(a,b,c,count){for(let i=0;i<count;i++){let u=rand(),v=rand();if(u+v>1){u=1-u;v=1-v;}points.push({x:a[0]+u*(b[0]-a[0])+v*(c[0]-a[0]),y:a[1]+u*(b[1]-a[1])+v*(c[1]-a[1]),z:(rand()-.5)*.13,s:rand()});}}
triangle([0,-.03],[-.88,-.42],[-.42,.19],900);triangle([-.42,.19],[-.88,-.42],[-.78,-.06],300);triangle([.02,-.03],[.9,-.48],[.46,.16],900);triangle([.46,.16],[.9,-.48],[.78,-.02],300);triangle([-.12,-.1],[.12,-.1],[0,.45],500);triangle([-.05,.31],[-.2,.64],[.18,.59],250);triangle([-.09,-.06],[0,-.29],[.16,-.12],220);triangle([.08,-.22],[.22,-.15],[.1,-.13],100);
function updateControls() {
  const reduced = motion.matches;
  $('#pause').disabled = reduced; $('#replay').disabled = reduced;
  $('#pause').textContent = reduced ? 'Reduced motion' : paused ? 'Resume ▷' : 'Pause Ⅱ';
  $('#pause').setAttribute('aria-pressed', String(paused || reduced));
  document.body.classList.toggle('motion-paused', paused || reduced);
}
function trajectory(progress) {
  const index = progress * (costs.length - 1), i = Math.min(costs.length - 2, Math.floor(index)), f = index - i;
  const value = costs[i] + (costs[i + 1] - costs[i]) * f;
  // Cost determines altitude. Lower gas and lower flight are the same quantity.
  const drop = baselineGas > recordGas ? clamp((baselineGas - value) / (baselineGas - recordGas)) : 0;
  return { x: width * (.20 + progress * .54), y: height * (.54 + drop * .20), value, drop };
}
function strokePath(progress, offset, color, thickness) {
  ctx.beginPath();
  for (let i = 0; i <= 100; i++) { const p = trajectory(progress * i / 100); if (i) ctx.lineTo(p.x, p.y + offset); else ctx.moveTo(p.x, p.y + offset); }
  ctx.strokeStyle = color; ctx.lineWidth = thickness; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke();
}
function drawBird(x, y, t, progress) {
  const mascot = $('#mascot');
  const w = Math.min(width * .24, 166);
  const left = x - w * .5, top = y - w * .53;
  const bank = progress > 0 && progress < 1 ? 1.5 : Math.sin(t * .55) * 1.5;
  mascot.style.width = w + 'px'; mascot.style.transform = 'perspective(700px) translate3d(' + left + 'px,' + top + 'px,0) rotateX(' + (Math.sin(t * .8) * 2) + 'deg) rotateY(' + (Math.sin(t * .65) * 4) + 'deg) rotateZ(' + bank + 'deg) scale(' + (1 + Math.sin(t * 1.8) * .012) + ')';
  mascot.style.setProperty('--wing-beat', (1 + Math.sin(t * 4.2)) / 2);
}

function draw(now) {
  cancelAnimationFrame(frame);
  if (!paused && !document.hidden && inView) elapsed += Math.min((now - last) || 0, 40) / 1000;
  last = now;
  const progress = motion.matches ? 1 : smooth((elapsed - 1.4) / 6.4);
  const bird = trajectory(progress), start = trajectory(0), end = trajectory(1);
  ctx.clearRect(0, 0, width, height); ctx.lineWidth = .7;
  for (let i = 0; i < 4; i++) {
    const y = height * (.43 + i * .095);
    ctx.strokeStyle = i === 0 ? '#b18cff55' : '#ffffff09'; ctx.setLineDash(i === 0 ? [3, 6] : []);
    ctx.beginPath(); ctx.moveTo(width * .08, y); ctx.lineTo(width * .91, y); ctx.stroke();
  }
  ctx.setLineDash([]); strokePath(1, 11, '#b18cff08', 15); strokePath(1, 0, '#b18cff20', 1);
  if (progress > 0) { strokePath(progress, 8, '#b18cff12', 12); strokePath(progress, 2, '#3ddc8a20', 6); strokePath(progress, 0, '#3ddc8a', 1.8); }
  for (let i = 0; i < costs.length; i++) {
    const at = i / (costs.length - 1), node = trajectory(at);
    ctx.beginPath(); ctx.arc(node.x, node.y, at <= progress ? 3 : 2, 0, Math.PI * 2); ctx.fillStyle = at <= progress ? '#3ddc8a' : '#665b78'; ctx.fill();
  }
  if (progress > .96) {
    ctx.globalAlpha = clamp((progress - .96) / .04); ctx.strokeStyle = '#3ddc8a88'; ctx.lineWidth = 1;
    const x = width * .91;
    ctx.beginPath(); ctx.moveTo(x, start.y); ctx.lineTo(x, end.y); ctx.moveTo(x - 4, start.y); ctx.lineTo(x + 4, start.y); ctx.moveTo(x - 4, end.y); ctx.lineTo(x + 4, end.y); ctx.stroke(); ctx.fillStyle = '#3ddc8a'; ctx.font = '11px ' + getComputedStyle(document.documentElement).fontFamily; ctx.textAlign = 'right'; ctx.fillText(((1 - recordGas / baselineGas) * 100).toFixed(1) + '% less gas', x, start.y - 12); ctx.textAlign = 'left';
    ctx.globalAlpha = 1;
  }
  // The needle ties the bird to the cost curve directly below it.
  ctx.strokeStyle = '#b18cff60'; ctx.lineWidth = .7; ctx.beginPath(); ctx.moveTo(bird.x, bird.y - 16); ctx.lineTo(bird.x, bird.y); ctx.stroke();
  drawBird(bird.x, bird.y - 29, motion.matches ? 0 : elapsed, progress);
  $('#flight-gas').textContent = millions(bird.value);
  if (!paused && !document.hidden && inView) frame = requestAnimationFrame(draw);
}
function resize() {
  const bounds = canvas.getBoundingClientRect(); width = bounds.width; height = bounds.height;
  const dpr = Math.min(devicePixelRatio, 2); canvas.width = width * dpr; canvas.height = height * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); draw(performance.now());
}
$('#pause').addEventListener('click', () => { paused = !paused; last = performance.now(); updateControls(); draw(last); });
$('#replay').addEventListener('click', () => { elapsed = 0; paused = false; last = performance.now(); updateControls(); draw(last); });
motion.addEventListener('change', () => { paused = motion.matches; last = performance.now(); updateControls(); draw(last); });
document.addEventListener('visibilitychange', () => { last = performance.now(); if (document.hidden) cancelAnimationFrame(frame); else draw(last); });
new ResizeObserver(resize).observe(canvas);
new IntersectionObserver(([entry]) => { inView = entry.isIntersecting; last = performance.now(); if (inView) draw(last); else cancelAnimationFrame(frame); }).observe(canvas);
new IntersectionObserver(([entry]) => $('.closing').classList.toggle('is-visible', entry.isIntersecting)).observe($('.closing'));
updateControls();
for (let i = 0; i < 25; i++) $('.keccak-grid').append(document.createElement('i'));
$('#copy').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText($('#prompt').textContent); $('#copy-status').textContent = 'Prompt copied. Paste it into your coding agent.'; }
  catch { const range = document.createRange(); range.selectNodeContents($('#prompt')); const selection = getSelection(); selection.removeAllRanges(); selection.addRange(range); $('#copy-status').textContent = 'Prompt selected. Use your device’s copy command.'; }
});
function showFigures() {
  $('#baseline').innerHTML = millions(baselineGas) + ' <small>gas</small>';
  $('#gas').innerHTML = millions(recordGas) + ' <small>gas</small>';
  $('#saving').innerHTML = ((1 - recordGas / baselineGas) * 100).toFixed(1) + '<small>%</small>';
  draw(performance.now());
}
async function loadRecord() {
  if (pending) return; pending = true; $('#retry').hidden = true; $('#data-status').textContent = 'Loading live record…';
  try {
    const response = await fetch('/api/participation/falcon/results', { signal: AbortSignal.timeout(8000), cache: 'no-store' });
    if (!response.ok) throw Error('Record unavailable');
    const board = await response.json(), gas = board.record?.score_l2_gas, base = board.baseline?.score_l2_gas;
    if (board.schema_version !== 1 || board.lane !== 'FALCON_512_GAS' || !Number.isFinite(gas) || gas <= 0 || !Number.isFinite(base) || base < gas) throw Error('Invalid record');
    baselineGas = base; recordGas = gas;
    // Nodes are real records. Between nodes the cost is interpolated for the flight.
    const records = (Array.isArray(board.records) ? board.records : []).filter(r => Number.isFinite(r.score_l2_gas) && r.score_l2_gas > gas && r.score_l2_gas < base).sort((a,b) => b.score_l2_gas - a.score_l2_gas);
    costs = [base];
    if (records.length) for (let i = 0; i < Math.min(5, records.length); i++) { const score = records[Math.floor(i * records.length / Math.min(5, records.length))].score_l2_gas; if (score < costs[costs.length - 1]) costs.push(score); }
    costs.push(gas);
    $('#data-status').textContent = 'Live record / updated ' + new Date().toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
  } catch {
    baselineGas = snapshot.baseline; recordGas = snapshot.record; costs = [baselineGas, recordGas];
    $('#data-status').textContent = 'Live record unavailable. Showing Oct 19 snapshot.'; $('#retry').hidden = false;
  } finally { pending = false; showFigures(); }
}
$('#retry').addEventListener('click', loadRecord); loadRecord();

async function loadLeaderboard() {
  const rows = $('#leaderboard-rows');
  const status = $('#leaderboard-status');
  try {
    const response = await fetch('/api/participation/falcon/results', { signal: AbortSignal.timeout(8000), cache: 'no-store' });
    if (!response.ok) throw Error('Leaderboard unavailable');
    const board = await response.json();
    const results = [board.record, ...(Array.isArray(board.records) ? board.records : [])]
      .filter(result => result && Number.isFinite(result.score_l2_gas))
      .slice(0, 6);
    if (!results.length) throw Error('No results');
    const baseline = Number(board.baseline?.score_l2_gas);
    const formatGas = value => Number(value).toLocaleString();
    $('#leaderboard-record').textContent = formatGas(results[0].score_l2_gas);
    $('#leaderboard-summary').textContent = `${results.length} of ${Array.isArray(board.records) ? board.records.length + 1 : results.length} verified results`;
    rows.innerHTML = results.map((result, index) => {
      const name = result.github_login || 'Open contributor';
      const saved = Number.isFinite(baseline) ? Math.max(0, baseline - result.score_l2_gas) : 0;
      const percent = Number.isFinite(baseline) && baseline > 0 ? ((saved / baseline) * 100).toFixed(1) : '0.0';
      const model = result.model || 'Independent';
      const initials = name.split(/[^a-z0-9]+/i).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase() || 'FC';
      const avatar = result.github_login ? `<img class="solver-avatar" src="https://github.com/${encodeURIComponent(result.github_login)}.png?size=64" alt="">` : `<span class="solver-avatar solver-avatar-fallback">${escapeHtml(initials)}</span>`;
      const modelFamily = model.toLowerCase().includes('claude') ? 'claude' : model.toLowerCase().includes('gpt') ? 'gpt' : 'independent';
      const modelLogo = modelFamily === 'claude'
        ? '<img src="https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/claude.svg" alt="" aria-hidden="true">'
        : modelFamily === 'gpt'
          ? '<img src="https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/openai.svg" alt="" aria-hidden="true">'
          : '<span class="fallback-mark" aria-hidden="true">•</span>';
      const rankNumber = String(index + 1).padStart(2, '0');
      const podium = `<span class="rank">${rankNumber}</span>${index < 3 ? `<span class="rank-emoji" role="img" aria-label="${['First', 'Second', 'Third'][index]} place">${['🥇', '🥈', '🥉'][index]}</span>` : ''}`;
      return `<tr class="${index === 0 ? 'is-record' : ''}"><td>${podium}</td><td><div class="contributor-cell">${avatar}<div><strong>${escapeHtml(name)}</strong><small>${escapeHtml((result.title || 'Verified Falcon-512 result').slice(0, 72))}${(result.title || '').length > 72 ? '…' : ''}</small></div></div></td><td class="mono">${formatGas(result.score_l2_gas)} gas</td><td class="improvement"><strong>${percent}% less gas</strong><small>${formatGas(saved)} gas saved</small></td><td><span class="model-badge model-${modelFamily}"><span class="model-mark">${modelLogo}</span>${escapeHtml(model)}</span></td></tr>`;
    }).join('');
    status.textContent = `Updated ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  } catch {
    status.textContent = 'Live results unavailable';
    rows.innerHTML = '<tr><td>01</td><td><strong>Live results unavailable</strong><small>Open the full record to try again</small></td><td class="mono">n/a</td><td>n/a</td><td>n/a</td></tr>';
  }
}
function escapeHtml(value) { return String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character])); }
loadLeaderboard();

}
