const $ = (s) => document.querySelector(s);
const motion = matchMedia('(prefers-reduced-motion: reduce)');
let paused = motion.matches;
const pause = $('#pause');
function updatePause(){ pause.disabled=motion.matches; if(motion.matches){pause.textContent='Reduced motion';pause.setAttribute('aria-pressed','true');document.body.classList.add('motion-paused');return;} pause.textContent = paused ? 'Resume motion ▷' : 'Pause motion Ⅱ'; pause.setAttribute('aria-pressed',String(paused));document.body.classList.toggle('motion-paused',paused); }
pause.addEventListener('click',()=>{paused=!paused;updatePause();draw(performance.now());});
motion.addEventListener('change',()=>{paused=motion.matches;updatePause();draw(performance.now());});updatePause();
for(let i=0;i<60;i++) $('.check-grid').append(document.createElement('i'));
for(let i=0;i<25;i++) $('.keccak-grid').append(document.createElement('i'));
new IntersectionObserver(es=>es.forEach(e=>e.target.classList.toggle('is-visible',e.isIntersecting))).observe($('.finale'));
$('#copy').addEventListener('click',async()=>{try{await navigator.clipboard.writeText($('#prompt').textContent);$('#copy-status').textContent='Prompt copied. Paste it into your coding agent.';}catch{const range=document.createRange();range.selectNodeContents($('#prompt'));const sel=getSelection();sel.removeAllRanges();sel.addRange(range);$('#copy-status').textContent='Prompt selected. Use your device’s copy command.';}});
const canvas=$('#flight'),ctx=canvas.getContext('2d');
let width=0,height=0,frame=0,clock=0,last=0;
let recordGas=27915721,baselineGas=48398466;
let seed=512;function rand(){seed=(seed*16807)%2147483647;return(seed-1)/2147483646;}
const points=[];
function triangle(a,b,c,count){for(let i=0;i<count;i++){let u=rand(),v=rand();if(u+v>1){u=1-u;v=1-v;}points.push({x:a[0]+u*(b[0]-a[0])+v*(c[0]-a[0]),y:a[1]+u*(b[1]-a[1])+v*(c[1]-a[1]),z:(rand()-.5)*.13,s:rand()});}}
triangle([0,-.03],[-.88,-.42],[-.42,.19],900);triangle([-.42,.19],[-.88,-.42],[-.78,-.06],300);triangle([.02,-.03],[.9,-.48],[.46,.16],900);triangle([.46,.16],[.9,-.48],[.78,-.02],300);triangle([-.12,-.1],[.12,-.1],[0,.45],500);triangle([-.05,.31],[-.2,.64],[.18,.59],250);triangle([-.09,-.06],[0,-.29],[.16,-.12],220);triangle([.08,-.22],[.22,-.15],[.1,-.13],100);
const blocks=[];for(let y=0;y<5;y++)for(let z=0;z<3;z++)for(let x=0;x<4;x++)blocks.push({x:(x-1.5)*.29,y:y*.235,z:(z-1)*.29,seed:rand(),spin:rand()*6.28});
const dust=Array.from({length:110},()=>({x:rand(),y:rand(),z:rand(),v:rand()}));
const clamp=v=>Math.max(0,Math.min(1,v));const ease=v=>{v=clamp(v);return v*v*(3-2*v);};
function project(x,y,z){const angle=-.35;const rx=x*Math.cos(angle)+z*Math.sin(angle),rz=-x*Math.sin(angle)+z*Math.cos(angle);const scale=Math.min(width/4.5,height/5.8);const perspective=5.7/(5.7+rz);return{x:width*.5+rx*scale*perspective,y:height*.80-(y+rz*.34)*scale*perspective,k:scale*perspective,depth:rz};}
function line3(a,b,color,dashed=false){const p=project(...a),q=project(...b);ctx.strokeStyle=color;ctx.lineWidth=.65;ctx.setLineDash(dashed?[3,4]:[]);ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(q.x,q.y);ctx.stroke();ctx.setLineDash([]);}
function cube(x,y,z,size,alpha,removed,spin=0,heightFraction=1){const vertices=[[-1,0,-1],[1,0,-1],[1,0,1],[-1,0,1],[-1,2,-1],[1,2,-1],[1,2,1],[-1,2,1]].map(([a,b,c])=>{const xx=a*Math.cos(spin)-b*heightFraction*Math.sin(spin),yy=a*Math.sin(spin)+b*heightFraction*Math.cos(spin);return project(x+xx*size/2,y+yy*size/2,z+c*size/2);});const faces=[[0,1,5,4],[1,2,6,5],[4,5,6,7]];ctx.globalAlpha=alpha;for(let i=0;i<faces.length;i++){ctx.beginPath();faces[i].forEach((v,j)=>{const p=vertices[v];j?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y);});ctx.closePath();ctx.fillStyle=removed?['#392b50','#56416f','#8c6ab0'][i]:['#123728','#18543b','#2e8960'][i];ctx.strokeStyle=removed?'#b18cff':'#58e6a0';ctx.lineWidth=.6;ctx.fill();ctx.stroke();}ctx.globalAlpha=1;}
function resize(){const b=canvas.getBoundingClientRect();width=b.width;height=b.height;const d=Math.min(devicePixelRatio,2);canvas.width=width*d;canvas.height=height*d;ctx.setTransform(d,0,0,d,0,0);draw(performance.now());}
function draw(now){cancelAnimationFrame(frame);if(!paused&&!document.hidden)clock+=Math.min((now-last)||0,40)/1000;last=now;
const t=motion.matches?10:clock%15;
// Impact removes only the saved fraction. The remaining volume matches the record ratio.
const progress=ease((t-4.3)/3.1),reset=ease((t-13.3)/1.7),reduction=progress*(1-reset),ratio=Math.min(1,recordGas/baselineGas),retained=ratio*blocks.length;
ctx.clearRect(0,0,width,height);
for(let i=-5;i<=5;i++){line3([i*.35,-.06,-1.6],[i*.35,-.06,1.6],'#ffffff0e');line3([-1.8,-.06,i*.32],[1.8,-.06,i*.32],'#ffffff0e');}
// A faint baseline cage stays visible after the saved gas breaks away.
for(const x of [-.65,.65])for(const z of [-.5,.5])line3([x,0,z],[x,1.25,z],'#b18cff35',true);
for(const y of [0,1.25]){line3([-.65,y,-.5],[.65,y,-.5],'#b18cff35',true);line3([-.65,y,.5],[.65,y,.5],'#b18cff35',true);line3([-.65,y,-.5],[-.65,y,.5],'#b18cff35',true);line3([.65,y,-.5],[.65,y,.5],'#b18cff35',true);}
const ordered=blocks.map((b,i)=>({...b,i,depth:project(b.x,b.y,b.z).depth})).sort((a,b)=>b.depth-a.depth||a.y-b.y);
for(const b of ordered){const keep=clamp(retained-b.i);if(keep>0)cube(b.x,b.y,b.z,.235,1,false,0,keep);if(keep<1){const burst=ease((reduction-(1-b.i/60)*.18)/.82),fade=1-ease((burst-.35)/.65);if(fade>.001){const direction=b.x>=0?1:-1;cube(b.x+direction*burst*(.9+b.seed),b.y+Math.sin(burst*Math.PI)*.65-burst*.5,b.z+burst*(b.seed-.5)*2,.235*(1-burst*.65),fade*(1-keep),true,b.spin*burst);}}}
// The bird banks into the gas tower and climbs out. Wings fold during the dive.
const dive=ease((t-2.2)/2.1)*(1-ease((t-4.6)/2.4));const bank=Math.sin(t*.6)*.07+dive*.8;const bx=-.55*dive,by=2.48-dive*1.1+Math.sin(t*.8)*.06;const spread=1-dive*.43;
const birdPoints=points.map(p=>{let x=p.x*1.95*spread,y=-p.y*1.35,z=p.z+Math.sin(t*1.5+Math.abs(p.x)*2)*Math.abs(p.x)*.32;const xx=x*Math.cos(bank)-y*Math.sin(bank),yy=x*Math.sin(bank)+y*Math.cos(bank);const q=project(xx+bx,yy+by,z);return{...q,s:p.s};}).sort((a,b)=>b.depth-a.depth);
for(const p of birdPoints){ctx.fillStyle=p.s>.93?'#3ddc8a':p.s>.68?'#b18cff':`rgba(242,239,230,${.25+p.s*.65})`;const size=p.s>.93?1.8:1.1;ctx.fillRect(p.x,p.y,size,size);}
for(const p of dust){const a=reduction;if(a<=0||a>=1)continue;const q=project((p.x-.5)*(1+a*6),1.1+(p.y-.5)*a*2+(1-a)*.3,(p.z-.5)*(1+a*4));ctx.globalAlpha=Math.sin(a*Math.PI)*.8;ctx.fillStyle=p.v>.5?'#b18cff':'#3ddc8a';ctx.fillRect(q.x,q.y,1.5,1.5);}ctx.globalAlpha=1;
const displayed=baselineGas-(baselineGas-recordGas)*reduction;$('#flight-gas').textContent=(displayed/1e6).toFixed(1)+'M';$('#flight-phase').textContent=t<2.2||t>=13.3?'01 / The baseline':t<4.6?'02 / Cut the overhead':t<8?'03 / Less gas to verify':'04 / Same signature. Lower cost.';$('#flight-saved').textContent=reduction>.95?((1-ratio)*100).toFixed(1)+'% less gas':(baselineGas/1e6).toFixed(1)+'M → '+(recordGas/1e6).toFixed(1)+'M';
if(!paused&&!document.hidden)frame=requestAnimationFrame(draw);}
new ResizeObserver(resize).observe(canvas);document.addEventListener('visibilitychange',()=>{last=performance.now();if(!document.hidden)draw(last);else cancelAnimationFrame(frame);});
let pending=false;
async function loadRecord(){if(pending)return;pending=true;$('#retry').hidden=true;$('#data-status').textContent='Loading live record…';try{const r=await fetch('/api/participation/falcon/results',{signal:AbortSignal.timeout(8000),cache:'no-store'});if(!r.ok)throw Error('Record unavailable');const b=await r.json();const gas=b.record?.score_l2_gas,base=b.baseline?.score_l2_gas;if(b.schema_version!==1||b.lane!=='FALCON_512_GAS'||!Number.isFinite(gas)||gas<=0||!Number.isFinite(base)||base<=0)throw Error('Invalid record');recordGas=gas;baselineGas=base;if(paused)draw(performance.now());const label=(gas/1e6).toFixed(1)+'M';$('#gas').textContent=label;$('#ratio').textContent=(base/gas).toFixed(2)+'× cheaper';$('.comparison b').textContent=(base/1e6).toFixed(1)+'M';$('#current-bar').style.width=Math.min(100,gas/base*100)+'%';$('#chart-end').textContent=label+' / current record';$('#data-status').textContent='Live record / updated '+new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});}catch{$('#data-status').textContent='Live record unavailable. Showing Oct 19 snapshot.';$('#retry').hidden=false;}finally{pending=false;}}
$('#retry').addEventListener('click',loadRecord);loadRecord();
