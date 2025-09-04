// Lightweight front-end: load CSV, filter by season, draw SVG scatter, implement KNN regression

const CSV_PATH = 'lacrosse_stats.csv';

let data = [];

// DOM refs
const seasonSelect = document.getElementById('seasonSelect');
const inputGP = document.getElementById('inputGP');
const inputSH = document.getElementById('inputSH');
const kSelect = document.getElementById('kSelect');
const plotArea = document.getElementById('plotArea');
const tooltip = document.getElementById('tooltip');

function csvParse(text) {
  const lines = text.trim().split('\n');
  const headers = lines[0].split(',');
  return lines.slice(1).map(line => {
    const cols = line.split(',');
    const obj = {};
    headers.forEach((h,i)=> obj[h.trim()] = cols[i].trim());
    // cast numeric columns
    obj.GP = +obj.GP; obj.SH = +obj.SH; obj.PTS = +obj.PTS; obj.Year = obj.Year;
    return obj;
  });
}

function loadCSV(){
  return fetch(CSV_PATH).then(r=>r.text()).then(csvParse).then(arr=>{ data = arr; initUI(); render(); });
}

function uniqueYears(){
  const s = new Set(data.map(d=>d.Year));
  return Array.from(s).sort();
}

function initUI(){
  const years = uniqueYears();
  seasonSelect.innerHTML = '';
  years.forEach(y=>{
    const opt = document.createElement('option'); opt.value = y; opt.textContent = y; seasonSelect.appendChild(opt);
  });

  seasonSelect.addEventListener('change', render);
  inputGP.addEventListener('input', render);
  inputSH.addEventListener('input', render);
  kSelect.addEventListener('change', render);
}

function scale(v, domainMin, domainMax, rangeMin, rangeMax){
  if(domainMax === domainMin) return (rangeMin+rangeMax)/2;
  return rangeMin + (v-domainMin)/(domainMax-domainMin)*(rangeMax-rangeMin);
}

function knnPredict(points, query, k){
  // points: [{GP,SH,PTS,Name}] query: {GP,SH}
  const withDist = points.map(p=>{
    const dx = p.GP - query.GP;
    const dy = p.SH - query.SH;
    return {...p, dist: Math.hypot(dx,dy)};
  }).sort((a,b)=>a.dist-b.dist);

  const kNearest = withDist.slice(0,k);
  const weightedSum = kNearest.reduce((s,p)=>s + p.PTS,0);
  const pred = weightedSum / kNearest.length;
  return {pred, kNearest};
}

function clearChildren(node){ while(node.firstChild) node.removeChild(node.firstChild); }

function render(){
  if(!data.length) return;
  const season = seasonSelect.value || data[0].Year;
  const filtered = data.filter(d=>d.Year === season);

  const gpVals = filtered.map(d=>d.GP);
  const shVals = filtered.map(d=>d.SH);
  const ptsVals = filtered.map(d=>d.PTS);

  const padding = 40;
  const w = plotArea.clientWidth || 800;
  const h = plotArea.clientHeight || 560;

  const minGP = Math.min(...gpVals, 0);
  const maxGP = Math.max(...gpVals, 20);
  const minSH = Math.min(...shVals, 0);
  const maxSH = Math.max(...shVals, 130);

  clearChildren(plotArea);

  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS,'svg');
  svg.setAttribute('width', '100%');
  svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  svg.style.display='block';

  // axes
  const plotW = w - padding*2;
  const plotH = h - padding*2;

  // background rectangle
  const bg = document.createElementNS(svgNS,'rect');
  bg.setAttribute('x', padding); bg.setAttribute('y', padding);
  bg.setAttribute('width', plotW); bg.setAttribute('height', plotH);
  bg.setAttribute('fill', '#fff'); bg.setAttribute('stroke', '#e6edf3');
  svg.appendChild(bg);

  // grid lines and labels
  const xTicks = 6; const yTicks = 6;
  for(let i=0;i<=xTicks;i++){
    const gp = minGP + (maxGP-minGP)*(i/xTicks);
    const x = padding + scale(gp,minGP,maxGP,0,plotW);
    const line = document.createElementNS(svgNS,'line');
    line.setAttribute('x1', x); line.setAttribute('y1', padding);
    line.setAttribute('x2', x); line.setAttribute('y2', padding+plotH);
    line.setAttribute('stroke','#f1f5f9'); svg.appendChild(line);
    const t = document.createElementNS(svgNS,'text');
    t.setAttribute('x', x); t.setAttribute('y', padding+plotH+14);
    t.setAttribute('text-anchor','middle'); t.setAttribute('font-size','11'); t.setAttribute('fill','#475569');
    t.textContent = Math.round(gp);
    svg.appendChild(t);
  }

  for(let i=0;i<=yTicks;i++){
    const sh = minSH + (maxSH-minSH)*(i/yTicks);
    const y = padding + plotH - scale(sh,minSH,maxSH,0,plotH);
    const line = document.createElementNS(svgNS,'line');
    line.setAttribute('x1', padding); line.setAttribute('y1', y);
    line.setAttribute('x2', padding+plotW); line.setAttribute('y2', y);
    line.setAttribute('stroke','#f1f5f9'); svg.appendChild(line);
    const t = document.createElementNS(svgNS,'text');
    t.setAttribute('x', 8); t.setAttribute('y', y+4);
    t.setAttribute('font-size','11'); t.setAttribute('fill','#475569');
    t.textContent = Math.round(sh);
    svg.appendChild(t);
  }

  // axes labels
  const xlabel = document.createElementNS(svgNS,'text');
  xlabel.setAttribute('x', padding+plotW/2); xlabel.setAttribute('y', h-6); xlabel.setAttribute('text-anchor','middle');
  xlabel.setAttribute('font-size','12'); xlabel.setAttribute('fill','#0f172a'); xlabel.textContent='Games Played (GP)'; svg.appendChild(xlabel);

  const ylabel = document.createElementNS(svgNS,'text');
  ylabel.setAttribute('x', 12); ylabel.setAttribute('y', padding+plotH/2); ylabel.setAttribute('text-anchor','middle');
  ylabel.setAttribute('transform', `rotate(-90 12 ${padding+plotH/2})`);
  ylabel.setAttribute('font-size','12'); ylabel.setAttribute('fill','#0f172a'); ylabel.textContent='Shots (SH)'; svg.appendChild(ylabel);

  // plot points
  filtered.forEach(p=>{
    const cx = padding + scale(p.GP,minGP,maxGP,0,plotW);
    const cy = padding + plotH - scale(p.SH,minSH,maxSH,0,plotH);

    const g = document.createElementNS(svgNS,'g');

    const circle = document.createElementNS(svgNS,'circle');
    circle.setAttribute('cx', cx); circle.setAttribute('cy', cy); circle.setAttribute('r', 16);
    circle.setAttribute('fill', '#1e293b'); circle.setAttribute('opacity', '0.9');
    g.appendChild(circle);

    const txt = document.createElementNS(svgNS,'text');
    txt.setAttribute('x', cx); txt.setAttribute('y', cy+5); txt.setAttribute('text-anchor','middle');
    txt.setAttribute('font-size','11'); txt.setAttribute('fill','#fff'); txt.textContent = p.PTS;
    g.appendChild(txt);

    // hover
    g.addEventListener('mousemove', ev=>{
      showTooltip(`${p.Name}<br>GP: ${p.GP}<br>SH: ${p.SH}<br>PTS: ${p.PTS}`, ev.clientX, ev.clientY);
    });
    g.addEventListener('mouseleave', hideTooltip);

    svg.appendChild(g);
  });

  // query point from user
  const q = {GP: +inputGP.value || 0, SH: +inputSH.value || 0};
  const k = Math.min(+kSelect.value || 3, filtered.length);
  const {pred, kNearest} = knnPredict(filtered, q, k);

  // highlight k nearest with orange outline
  kNearest.forEach(n=>{
    const cx = padding + scale(n.GP,minGP,maxGP,0,plotW);
    const cy = padding + plotH - scale(n.SH,minSH,maxSH,0,plotH);
    const ring = document.createElementNS(svgNS,'circle');
    ring.setAttribute('cx', cx); ring.setAttribute('cy', cy); ring.setAttribute('r', 20);
    ring.setAttribute('fill', 'none'); ring.setAttribute('stroke', '#f97316'); ring.setAttribute('stroke-width','3');
    ring.setAttribute('opacity','0.9');
    // hover still shows player info
    ring.addEventListener('mousemove', ev=> showTooltip(`${n.Name}<br>GP: ${n.GP}<br>SH: ${n.SH}<br>PTS: ${n.PTS}`, ev.clientX, ev.clientY));
    ring.addEventListener('mouseleave', hideTooltip);
    svg.appendChild(ring);
  });

  // predicted point (red) with predicted PTS displayed inside
  const qx = padding + scale(q.GP,minGP,maxGP,0,plotW);
  const qy = padding + plotH - scale(q.SH,minSH,maxSH,0,plotH);
  const predCircle = document.createElementNS(svgNS,'circle');
  predCircle.setAttribute('cx', qx); predCircle.setAttribute('cy', qy); predCircle.setAttribute('r', 14);
  predCircle.setAttribute('fill', '#ef4444'); predCircle.setAttribute('opacity','0.95');
  svg.appendChild(predCircle);

  // predicted value inside the red circle
  const predInner = document.createElementNS(svgNS,'text');
  predInner.setAttribute('x', qx); predInner.setAttribute('y', qy+5);
  predInner.setAttribute('text-anchor','middle'); predInner.setAttribute('font-size','12');
  predInner.setAttribute('fill','#fff'); predInner.textContent = `${pred.toFixed(1)}`;
  svg.appendChild(predInner);

  predCircle.addEventListener('mousemove', ev=>{
    // show SH and 'goals' (we'll display predicted PTS as goals per request)
    showTooltip(`Predicted<br>GP: ${q.GP}<br>SH: ${q.SH}<br>Goals: ${pred.toFixed(1)}`, ev.clientX, ev.clientY);
  });
  predCircle.addEventListener('mouseleave', hideTooltip);

  plotArea.appendChild(svg);
}

function showTooltip(html,x,y){ tooltip.style.display='block'; tooltip.innerHTML = html; const pad=12; const tw=tooltip.offsetWidth; const th=tooltip.offsetHeight; tooltip.style.left = (x+12) + 'px'; tooltip.style.top = (y+12) + 'px'; }
function hideTooltip(){ tooltip.style.display='none'; }

// start
loadCSV().catch(err=>{
  plotArea.textContent = 'Failed to load CSV: '+err.message;
});
