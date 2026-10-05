/* =====================================================================
   Haltech-style custom speedometer untuk FiveM (JG Garage)
   ---------------------------------------------------------------------
   Data diterima lewat window.postMessage (cara standar NUI FiveM).
   Sesuaikan CONFIG di bawah kalau format data dari script speedometer
   server kamu beda. Tes tanpa game: buka index.html?demo=1
   ===================================================================== */

const CONFIG = {
  maxRpm: 9,              // skala tachometer (x1000 RPM)
  redlineFrom: 6,         // mulai zona merah (x1000 RPM)
  speedMultiplier: 1,     // kalau speed dikirim dalam m/s, ganti ke 3.6 (KPH) atau 2.236936 (MPH)
  speedUnit: 'KPH',       // label di kotak speed
  hideWhenNoVehicle: true,
  startAngle: 165,        // sudut 0 RPM (derajat, 0 = atas, searah jarum jam)
  sweep: 300,             // total sapuan jarum

  // Gauge samping: key = nama field di data yang masuk
  left: [
    { key: 'boost',        label: 'Manifold Pressure', unit: 'PSI', max: 30  },
    { key: 'fuel',         label: 'Fuel Level',        unit: '%',   max: 100 },
    { key: 'throttle',     label: 'Throttle Position', unit: '%',   max: 100, scale01: true },
    { key: 'engineHealth', label: 'Engine Health',     unit: '%',   max: 100, health: true, alertBelow: 30 }
  ],
  right: [
    { key: 'coolant',      label: 'Coolant Temp',      unit: '°C',  max: 130, alertAbove: 110 },
    { key: 'oil',          label: 'Oil Temp',          unit: '°C',  max: 150, alertAbove: 130 },
    { key: 'bodyHealth',   label: 'Body Health',       unit: '%',   max: 100, health: true, alertBelow: 30 },
    { key: 'brake',        label: 'Brake',             unit: '%',   max: 100, scale01: true }
  ]
};

/* ---------- Parameter URL: ?scale=0.7&pos=bl&demo=1&unit=mph ---------- */
const params = new URLSearchParams(location.search);
const dash = document.getElementById('dash');
if (params.get('scale')) document.documentElement.style.setProperty('--s', params.get('scale'));
if (params.get('pos') === 'bl') dash.classList.add('pos-bl');
if (params.get('pos') === 'center') dash.classList.add('pos-center');
if (params.get('unit')) {
  CONFIG.speedUnit = params.get('unit').toUpperCase();
  if (CONFIG.speedUnit === 'MPH') CONFIG.speedMultiplier = 2.236936;
}
document.getElementById('speed-unit').textContent = 'SPEED ' + CONFIG.speedUnit;

/* ---------- Helper geometri SVG ---------- */
const NS = 'http://www.w3.org/2000/svg';
const CX = 150, CY = 150;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const angleFor = (k) => CONFIG.startAngle + (k / CONFIG.maxRpm) * CONFIG.sweep;
const pt = (deg, r) => {
  const a = deg * Math.PI / 180;
  return [CX + r * Math.sin(a), CY - r * Math.cos(a)];
};

/* ---------- Gambar tachometer ---------- */
(function buildTach() {
  // zona merah
  const [x1, y1] = pt(angleFor(CONFIG.redlineFrom), 140);
  const [x2, y2] = pt(angleFor(CONFIG.maxRpm), 140);
  const large = (angleFor(CONFIG.maxRpm) - angleFor(CONFIG.redlineFrom)) > 180 ? 1 : 0;
  document.getElementById('redzone').setAttribute(
    'd', `M${CX} ${CY} L${x1} ${y1} A140 140 0 ${large} 1 ${x2} ${y2} Z`);

  const ticks = document.getElementById('ticks');
  const nums = document.getElementById('numbers');

  for (let i = 0; i <= CONFIG.maxRpm * 2; i++) {
    const k = i / 2;
    const major = Number.isInteger(k);
    const [ax, ay] = pt(angleFor(k), major ? 124 : 130);
    const [bx, by] = pt(angleFor(k), 138);
    const l = document.createElementNS(NS, 'line');
    l.setAttribute('x1', ax); l.setAttribute('y1', ay);
    l.setAttribute('x2', bx); l.setAttribute('y2', by);
    l.setAttribute('stroke', '#101010');
    l.setAttribute('stroke-width', major ? 3 : 1.5);
    ticks.appendChild(l);

    if (major) {
      const [tx, ty] = pt(angleFor(k), 102);
      const t = document.createElementNS(NS, 'text');
      t.setAttribute('x', tx); t.setAttribute('y', ty);
      t.textContent = k;
      nums.appendChild(t);
    }
  }
})();

/* ---------- Bangun gauge samping ---------- */
function buildPanel(el, list) {
  list.forEach((g) => {
    const row = document.createElement('div');
    row.className = 'gauge';
    row.innerHTML =
      '<div class="bar"><div class="fill"></div></div>' +
      '<div class="info"><div class="value"><span class="v">0</span><small>' + g.unit + '</small></div>' +
      '<div class="label">' + g.label + '</div></div>';
    el.appendChild(row);
    g.el = row;
    g.vEl = row.querySelector('.v');
    g.fillEl = row.querySelector('.fill');
  });
}
buildPanel(document.getElementById('panel-left'), CONFIG.left);
buildPanel(document.getElementById('panel-right'), CONFIG.right);

/* ---------- LED shift bar ---------- */
const shiftbar = document.getElementById('shiftbar');
const LED_COUNT = 16;
const leds = [];
for (let i = 0; i < LED_COUNT; i++) {
  const d = document.createElement('div');
  d.className = 'led';
  const f = i / (LED_COUNT - 1);
  d.style.color = f < 0.4 ? '#2ecc40' : f < 0.7 ? '#ffd21f' : '#ff3b30';
  shiftbar.appendChild(d);
  leds.push(d);
}

/* ---------- State & normalisasi data ---------- */
const state = {
  rpm: 0, speed: 0, gear: 0, lights: false, visible: true,
  values: {}                // key gauge -> nilai terbaru
};
const disp = { rpm: 0, speed: 0, values: {} };   // nilai yang ditampilkan (smoothing)

function num(v) { v = Number(v); return Number.isFinite(v) ? v : undefined; }

function applyData(raw) {
  if (!raw || typeof raw !== 'object') return;
  // dukung format { type:'x', data:{...} } maupun datar
  const d = Object.assign({}, raw, (raw.data && typeof raw.data === 'object') ? raw.data : {});

  // visibilitas
  const vis = d.show ?? d.visible ?? d.inVehicle ?? d.display;
  if (vis !== undefined) state.visible = !!vis;

  // RPM: 0..1 (native GetVehicleCurrentRpm) atau sudah dalam RPM penuh
  let rpm = num(d.rpm ?? d.RPM);
  if (rpm !== undefined) {
    if (rpm <= 1.5) rpm = rpm * CONFIG.maxRpm;          // normalisasi 0..1
    else if (rpm > 20) rpm = rpm / 1000;                // 6500 -> 6.5
    state.rpm = clamp(rpm, 0, CONFIG.maxRpm);
  }

  // Speed
  let sp = num(d.kmh ?? d.kph ?? d.mph ?? d.speed ?? d.Speed);
  if (sp !== undefined) {
    const direct = (d.kmh ?? d.kph ?? d.mph) !== undefined;
    state.speed = Math.max(0, sp * (direct ? 1 : CONFIG.speedMultiplier));
  }

  // Gear
  if (d.gear !== undefined) {
    state.gear = (d.gear === 'R' || d.gear === 'N') ? d.gear : num(d.gear) ?? state.gear;
  }

  if (d.lights !== undefined || d.headlights !== undefined) {
    state.lights = !!(d.lights ?? d.headlights);
  }

  // Gauge samping
  [...CONFIG.left, ...CONFIG.right].forEach((g) => {
    let v = num(d[g.key]);
    if (v === undefined) return;
    if (g.scale01 && v <= 1) v *= 100;
    if (g.health && v > 100) v /= 10;       // health FiveM 0..1000
    state.values[g.key] = v;
  });
}

window.addEventListener('message', (e) => applyData(e.data));

/* ---------- Mode demo (?demo=1, tekan D untuk toggle) ---------- */
let demo = params.get('demo') === '1';
window.addEventListener('keydown', (e) => { if (e.key.toLowerCase() === 'd') demo = !demo; });

function runDemo(t) {
  const s = t / 1000;
  const cycle = (s % 12) / 12;                      // 0..1
  const gear = Math.min(6, 1 + Math.floor(cycle * 6));
  const within = (cycle * 6) % 1;
  const rpm = 0.22 + within * 0.72;                 // naik tiap gear
  applyData({
    show: true,
    rpm: rpm,
    gear: gear,
    speed: (gear - 1) * 45 + within * 45 + 5,
    lights: true,
    boost: 4 + within * 22,
    fuel: 72 - cycle * 10,
    throttle: 0.5 + within * 0.5,
    engineHealth: 100,
    coolant: 88 + Math.sin(s) * 4,
    oil: 100 + Math.sin(s / 2) * 6,
    bodyHealth: 92,
    brake: 0
  });
}

/* ---------- Render loop ---------- */
const el = {
  needle: document.getElementById('needle'),
  gear: document.getElementById('gear'),
  speed: document.getElementById('speed'),
  rpm: document.getElementById('rpm'),
  wEng: document.getElementById('w-eng'),
  wFuel: document.getElementById('w-fuel'),
  wLgt: document.getElementById('w-lgt')
};
const lerp = (a, b, t) => a + (b - a) * t;

function frame(t) {
  if (demo) runDemo(t);

  dash.classList.toggle('hidden', !(state.visible || demo));

  disp.rpm = lerp(disp.rpm, state.rpm, 0.25);
  disp.speed = lerp(disp.speed, state.speed, 0.2);

  // jarum
  el.needle.style.transform = 'rotate(' + angleFor(disp.rpm) + 'deg)';

  // teks
  el.speed.textContent = Math.round(disp.speed);
  el.rpm.textContent = Math.round(disp.rpm * 1000 / 50) * 50;
  el.gear.textContent = state.gear === 0 ? 'N' : state.gear;

  // shift LED
  const frac = disp.rpm / CONFIG.maxRpm;
  const lit = frac < 0.55 ? 0 : Math.round(((frac - 0.55) / 0.45) * LED_COUNT);
  leds.forEach((l, i) => l.classList.toggle('on', i < lit));
  shiftbar.classList.toggle('flash', frac > 0.93);

  // gauge samping
  [...CONFIG.left, ...CONFIG.right].forEach((g) => {
    const target = state.values[g.key] ?? 0;
    const cur = disp.values[g.key] = lerp(disp.values[g.key] ?? 0, target, 0.2);
    g.vEl.textContent = Math.round(cur);
    g.fillEl.style.height = clamp(cur / g.max * 100, 0, 100) + '%';
    const alert = (g.alertBelow !== undefined && state.values[g.key] !== undefined && cur < g.alertBelow) ||
                  (g.alertAbove !== undefined && cur > g.alertAbove);
    g.el.classList.toggle('alert', !!alert);
  });

  // lampu peringatan
  const eh = state.values.engineHealth;
  const fu = state.values.fuel;
  el.wEng.classList.toggle('on', eh !== undefined && eh < 35);
  el.wFuel.classList.toggle('on', fu !== undefined && fu < 15);
  el.wLgt.classList.toggle('on', state.lights);

  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
