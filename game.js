(() => {
'use strict';
const $ = id => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const N = 420, ROAD_W = 9, WALL = ROAD_W + 2.2;
const tg = window.Telegram && Telegram.WebApp;
if (tg) { tg.ready(); tg.expand(); }

// ================= сохранение (localStorage — только на этом устройстве) =================
const defSave = () => ({ v: 1, name: 'Гонщик', coins: 0, cur: 'rust', cars: { rust: { up: [0, 0, 0, 0, 0, 0], dmg: 0 } }, level: 1, set: { snd: 1, gfx: 'med', theme: 'dark' } });
let save;
try { save = Object.assign(defSave(), JSON.parse(localStorage.getItem('tr_save') || '{}')); } catch (e) { save = defSave(); }
save.set = Object.assign({ snd: 1, gfx: 'med', theme: 'dark' }, save.set);
if (!save.cars[save.cur]) save.cur = 'rust';
if (tg && tg.initDataUnsafe && tg.initDataUnsafe.user && save.name === 'Гонщик') save.name = tg.initDataUnsafe.user.first_name.slice(0, 14);
const store = () => { try { localStorage.setItem('tr_save', JSON.stringify(save)); } catch (e) {} };

// ================= машины и физика =================
const carDef = id => CARS.find(c => c.id === id);
const carIdx = id => CARS.findIndex(c => c.id === id);
function eff(id) {
  const d = carDef(id), o = save.cars[id] || { up: [0, 0, 0, 0, 0, 0] }, e = {};
  STATS.forEach(([k], i) => e[k] = d.s[i] + o.up[i] * 0.6);
  return e;
}
function physFor(id) {
  const e = eff(id), o = save.cars[id] || { dmg: 0 }, d = o.dmg / 100;
  return { max: (40 + e.speed * 2.4) * (1 - d * 0.3), acc: (14 + e.accel * 2.2) * (1 - d * 0.25), brk: 30 + e.brake * 5,
           hnd: 1.6 + e.handle * 0.1, grip: 2 + e.grip * 0.8, nCap: 60 + e.nitro * 8, nPow: 1.2 + e.nitro * 0.03 };
}
let phys = physFor(save.cur);

// ================= темы / уровни =================
const THEMES = [
  { name: 'Бедные улицы', sky: [0x151c2b, 0x6b6a66], fog: 0x4a4c50, ground: 0x2e3033, bh: [8, 26], bcol: [0x5a524a, 0x66584c, 0x4b4e54, 0x5e4a44], lit: 0.35, lamp: 0xffc070, hemi: [0x8090b0, 0x302820, 0.75], sun: [0xaabbdd, 0.7] },
  { name: 'Нью-Йорк', sky: [0x070b1c, 0x4a4260], fog: 0x2a2a40, ground: 0x1c1d22, bh: [35, 130], bcol: [0x2c3340, 0x39414f, 0x262a33, 0x3d3a46], lit: 0.6, lamp: 0xffe3a0, hemi: [0x7080c0, 0x202030, 0.7], sun: [0x99aaff, 0.6] },
  { name: 'Побережье', sky: [0x2a4a7a, 0xff9a5a], fog: 0xd88a60, ground: 0xc2a070, bh: [6, 16], bcol: [0xe8d8c0, 0xd8b090, 0xf0e8d8, 0xc89878], lit: 0.1, lamp: 0xfff0c0, hemi: [0xffd0a0, 0x806040, 0.95], sun: [0xffb070, 1.0] }
];
const themeFor = L => L <= 10 ? 0 : L <= 20 ? 1 : L <= 30 ? 2 : Math.floor((L - 1) / 10) % 3;
const SHAPES_PTS = [
  [[0,0],[130,-30],[210,60],[170,180],[50,215],[-80,160],[-150,50],[-90,-50]],
  [[0,0],[160,0],[240,100],[160,200],[60,160],[-20,240],[-120,160],[-100,40]],
  [[0,0],[100,-60],[220,-20],[260,90],[180,160],[90,120],[20,200],[-90,230],[-170,120],[-100,20]],
  [[0,0],[200,0],[260,120],[120,180],[40,100],[-60,170],[-160,100],[-120,-30]]
];
const BOSSES = ['Рыжий Кабан', 'Ржавый Лис', 'Тень Бронкса', 'Железный Макс', 'Мистер Нитро', 'Король Трассы'];
const isBoss = L => L % 20 === 0, isMini = L => L % 10 === 0 && L % 20 !== 0;
const lapsFor = L => isBoss(L) ? 5 : isMini(L) ? 4 : 3;
const bossName = L => BOSSES[(Math.floor(L / 10) - 1) % BOSSES.length];

// ================= сцена =================
const renderer = new THREE.WebGLRenderer({ canvas: $('c'), antialias: true });
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
const cam = new THREE.PerspectiveCamera(70, 1, 0.1, 700);
const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 0.8); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, 0.8);
sun.shadow.camera.left = -50; sun.shadow.camera.right = 50; sun.shadow.camera.top = 50; sun.shadow.camera.bottom = -50;
sun.shadow.camera.near = 1; sun.shadow.camera.far = 300; sun.shadow.bias = -0.0005;
scene.add(sun, sun.target);
const spot = new THREE.SpotLight(0xfff2d0, 1.6, 80, 0.5, 0.55); scene.add(spot, spot.target);

function applyGfx() {
  const g = save.set.gfx;
  renderer.setPixelRatio(g === 'high' ? Math.min(devicePixelRatio, 2) : g === 'med' ? Math.min(devicePixelRatio, 1.5) : 1);
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = g !== 'low'; sun.castShadow = g !== 'low';
  const sz = g === 'high' ? 2048 : 1024;
  if (sun.shadow.mapSize.x !== sz) { sun.shadow.mapSize.set(sz, sz); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } }
  spot.visible = g !== 'low';
  scene.traverse(o => { if (o.material) [].concat(o.material).forEach(m => m.needsUpdate = true); });
}
function resize() { renderer.setSize(innerWidth, innerHeight); cam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix(); }
addEventListener('resize', resize);

// ---- текстуры ----
function canvasTex(w, h, draw, srgb = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  if (srgb) t.encoding = THREE.sRGBEncoding; return t;
}
const roadT = canvasTex(128, 256, (x, w, h) => {
  x.fillStyle = '#2b2d31'; x.fillRect(0, 0, w, h);
  for (let i = 0; i < 3000; i++) { const v = 28 + Math.random() * 34 | 0; x.fillStyle = `rgb(${v},${v},${v + 3})`; x.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
  x.fillStyle = '#d9d4c0'; x.fillRect(3, 0, 3, h); x.fillRect(122, 0, 3, h);
  x.fillStyle = '#f5c542'; for (let y = 0; y < h; y += 64) x.fillRect(62, y, 4, 32);
});
roadT.wrapS = THREE.ClampToEdgeWrapping;
const curbT = canvasTex(16, 32, (x) => { x.fillStyle = '#c92a2a'; x.fillRect(0, 0, 16, 16); x.fillStyle = '#eee'; x.fillRect(0, 16, 16, 16); });
const winT = canvasTex(64, 64, (x, w, h) => {
  x.fillStyle = '#000'; x.fillRect(0, 0, w, h);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) if (Math.random() < 0.55) { x.fillStyle = Math.random() < 0.7 ? '#ffd27a' : '#9fd0ff'; x.fillRect(i * 16 + 4, j * 16 + 4, 8, 8); }
});
const glowT = canvasTex(64, 64, (x) => {
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
});
function setSky(th) {
  scene.background = canvasTex(8, 256, (x, w, h) => {
    const g = x.createLinearGradient(0, 0, 0, h), c = n => '#' + n.toString(16).padStart(6, '0');
    g.addColorStop(0, c(th.sky[0])); g.addColorStop(1, c(th.sky[1])); x.fillStyle = g; x.fillRect(0, 0, w, h);
  });
  scene.fog = new THREE.Fog(th.fog, 60, 300);
  hemi.color.setHex(th.hemi[0]); hemi.groundColor.setHex(th.hemi[1]); hemi.intensity = th.hemi[2];
  sun.color.setHex(th.sun[0]); sun.intensity = th.sun[1];
}

// ================= трасса =================
let trackG = null, pos = [], tan = [], SP = 1, items = [], builtL = -1;
function modN(v) { return ((v % N) + N) % N; }
function sdiff(a, b) { return ((a - b + N / 2) % N + N) % N - N / 2; }
function sampleAt(p, lat) {
  const i = modN(p), i0 = Math.floor(i), f = i - i0, i1 = (i0 + 1) % N, a = pos[i0], b = pos[i1], t = tan[i0];
  return { x: a.x + (b.x - a.x) * f + t.z * lat, z: a.z + (b.z - a.z) * f - t.x * lat, h: Math.atan2(t.x, t.z) };
}
function nearest(p, last) {
  let best = 1e12, bi = last;
  for (let k = -30; k <= 30; k++) { const i = (last + k + N) % N, dx = p.x - pos[i].x, dz = p.z - pos[i].z, d = dx * dx + dz * dz; if (d < best) { best = d; bi = i; } }
  return [bi, Math.sqrt(best)];
}

function itemMesh(type, h) {
  const g = new THREE.Group(); let m;
  const std = (c, e) => new THREE.MeshStandardMaterial({ color: c, emissive: e || 0, roughness: 0.4 });
  if (type === 'coin') { m = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.15, 18), std(0xf5c542, 0x7a5a00)); m.rotation.x = Math.PI / 2; m.position.y = 1.2; }
  else if (type === 'nitro') { m = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 1.2, 12), std(0x2fb7ff, 0x0a4a80)); m.position.y = 1.1; }
  else if (type === 'repair') { m = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 0.9), std(0x3ad06a, 0x0a5a22)); m.position.y = 1.1; }
  else if (type === 'oil') { m = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 0.04, 20), new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.1, metalness: 0.8 })); m.position.y = 0.07; }
  else if (type === 'cone') {
    m = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.9, 0.5), std(0xd23030)); m.position.y = 0.45;
    const s = new THREE.Mesh(new THREE.BoxGeometry(2.62, 0.2, 0.52), std(0xf2f2f2)); s.position.y = 0.55; g.add(s);
  } else { // ramp
    m = new THREE.Mesh(new THREE.BoxGeometry(7, 0.5, 7), std(0xf5c542, 0x403000)); m.rotation.x = -0.2; m.position.y = 0.45;
    g.rotation.y = h;
  }
  g.add(m); g.userData.spin = (type === 'coin' || type === 'nitro' || type === 'repair'); g.userData.body = m;
  return g;
}

function buildTrack(L) {
  if (trackG) { scene.remove(trackG); trackG.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
  const th = THEMES[themeFor(L)]; setSky(th);
  trackG = new THREE.Group(); scene.add(trackG);
  let seed = L * 977 + 13; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const curve = new THREE.CatmullRomCurve3(SHAPES_PTS[(L - 1) % 4].map(([x, z]) => new THREE.Vector3(x, 0, z)), true, 'catmullrom', 0.5);
  pos = []; tan = [];
  for (let i = 0; i < N; i++) { pos.push(curve.getPointAt(i / N)); tan.push(curve.getTangentAt(i / N).setY(0).normalize()); }
  SP = curve.getLength() / N;

  const gr = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000), new THREE.MeshStandardMaterial({ color: th.ground, roughness: 1 }));
  gr.rotation.x = -Math.PI / 2; gr.position.y = -0.05; gr.receiveShadow = true; trackG.add(gr);

  function ribbon(w, y, mat, vs) {
    const v = [], uv = [], idx = [];
    for (let i = 0; i <= N; i++) { const p = pos[i % N], t = tan[i % N]; v.push(p.x + t.z * w, y, p.z - t.x * w, p.x - t.z * w, y, p.z + t.x * w); uv.push(0, i * SP / vs, 1, i * SP / vs); }
    for (let i = 0; i < N; i++) { const a = 2 * i; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx); g.computeVertexNormals();
    const m = new THREE.Mesh(g, mat); m.receiveShadow = true; trackG.add(m);
  }
  ribbon(ROAD_W + 1.3, 0.01, new THREE.MeshStandardMaterial({ map: curbT, roughness: 0.8, side: THREE.DoubleSide }), 4);
  ribbon(ROAD_W, 0.03, new THREE.MeshStandardMaterial({ map: roadT, roughness: 0.85, side: THREE.DoubleSide }), 16);

  // старт/финиш и арка
  const s0 = sampleAt(0, 0);
  const sl = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_W * 2, 1.4), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  sl.rotation.x = -Math.PI / 2; sl.rotation.z = -s0.h; sl.position.set(s0.x, 0.07, s0.z); trackG.add(sl);
  const arch = new THREE.Group(), am = new THREE.MeshStandardMaterial({ color: 0xcc2222, emissive: 0x330000 });
  [-1, 1].forEach(s => { const p = new THREE.Mesh(new THREE.BoxGeometry(0.6, 8, 0.6), am); p.position.set(s * (ROAD_W + 2), 4, 0); arch.add(p); });
  const bm = new THREE.Mesh(new THREE.BoxGeometry(ROAD_W * 2 + 4.6, 1.2, 0.8), am); bm.position.y = 8; arch.add(bm);
  arch.position.set(s0.x, 0, s0.z); arch.rotation.y = s0.h; trackG.add(arch);

  // отбойники и фонари
  const dum = new THREE.Object3D();
  const rails = new THREE.InstancedMesh(new THREE.BoxGeometry(0.25, 0.8, SP * 3.3), new THREE.MeshStandardMaterial({ color: 0x8a8d92, roughness: 0.6 }), 2 * Math.ceil(N / 3));
  let k = 0;
  for (let i = 0; i < N; i += 3) for (const s of [-1, 1]) {
    dum.position.set(pos[i].x + tan[i].z * (ROAD_W + 2) * s, 0.4, pos[i].z - tan[i].x * (ROAD_W + 2) * s);
    dum.rotation.set(0, Math.atan2(tan[i].x, tan[i].z), 0); dum.updateMatrix(); rails.setMatrixAt(k++, dum.matrix);
  }
  trackG.add(rails);
  const lampN = 2 * Math.ceil(N / 10);
  const poles = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.1, 0.13, 6.5, 6), new THREE.MeshStandardMaterial({ color: 0x555a60 }), lampN);
  const glowM = new THREE.SpriteMaterial({ map: glowT, color: th.lamp, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0.85 });
  k = 0;
  for (let i = 0; i < N; i += 10) for (const s of [-1, 1]) {
    const x = pos[i].x + tan[i].z * (ROAD_W + 3.6) * s, z = pos[i].z - tan[i].x * (ROAD_W + 3.6) * s;
    dum.position.set(x, 3.25, z); dum.rotation.set(0, 0, 0); dum.updateMatrix(); poles.setMatrixAt(k++, dum.matrix);
    const sp = new THREE.Sprite(glowM); sp.position.set(x - tan[i].z * s * 0.9, 6.5, z + tan[i].x * s * 0.9); sp.scale.set(9, 9, 1); trackG.add(sp);
  }
  trackG.add(poles);

  // здания
  const bmats = th.bcol.map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9, emissive: 0xffffff, emissiveMap: winT, emissiveIntensity: th.lit }));
  const maxB = save.set.gfx === 'low' ? 60 : 110;
  for (let tries = 0, placed = 0; tries < 1200 && placed < maxB; tries++) {
    const x = -380 + rnd() * 760, z = -300 + rnd() * 700;
    let ok = true;
    for (let i = 0; i < N; i += 4) { const dx = x - pos[i].x, dz = z - pos[i].z; if (dx * dx + dz * dz < 28 * 28) { ok = false; break; } }
    if (!ok) continue;
    const w = 12 + rnd() * 16, h = th.bh[0] + rnd() * (th.bh[1] - th.bh[0]), d = 12 + rnd() * 16;
    const geo = new THREE.BoxGeometry(w, h, d), uv = geo.attributes.uv;
    for (let q = 0; q < uv.count; q++) uv.setXY(q, uv.getX(q) * (w + d) / 16, uv.getY(q) * h / 8);
    const b = new THREE.Mesh(geo, bmats[Math.floor(rnd() * bmats.length)]);
    b.position.set(x, h / 2, z); b.rotation.y = rnd() * 3; trackG.add(b); placed++;
    if (themeFor(L) === 1 && h > 90) { // шпиль
      const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.9, 14, 6), new THREE.MeshStandardMaterial({ color: 0x888 })); sp.position.set(x, h + 7, z); trackG.add(sp);
      const tip = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowT, color: 0xff3030, blending: THREE.AdditiveBlending, transparent: true })); tip.scale.set(8, 8, 1); tip.position.set(x, h + 14, z); trackG.add(tip);
    }
  }

  // предметы: монеты, бонусы, ловушки, трамплины
  items = [];
  const put = (type, idx, lat) => {
    const s = sampleAt(idx, lat), mesh = itemMesh(type, s.h); mesh.position.set(s.x, 0, s.z);
    trackG.add(mesh); items.push({ type, idx, lat, x: s.x, z: s.z, mesh, on: true });
  };
  for (let i = 0; i < 3; i++) put('ramp', 70 + i * 130 + rnd() * 30, (rnd() - 0.5) * 4);
  for (let idx = 30; idx < N - 40; idx += 8 + rnd() * 9) {
    if (items.some(it => it.type === 'ramp' && Math.abs(it.idx - idx) < 10)) continue;
    const r = rnd(), lat = (rnd() - 0.5) * 11;
    put(r < 0.38 ? 'coin' : r < 0.5 ? 'nitro' : r < 0.56 ? 'repair' : r < 0.74 ? 'oil' : 'cone', idx, lat);
  }
}
function resetItems() { items.forEach(it => { it.on = true; it.mesh.visible = true; }); }

// ================= игроки =================
const player = { mesh: null, h: 0, speed: 0, vx: 0, vz: 0, y: 0, vy: 0, air: false, idx: 0, lap: -1, p: 0, lat: 0, steerS: 0, slip: 0, spin: 1, dmg: 0, nLock: false, boosting: false, finished: false };
let ais = [], state = 'menu', nitro = 100, finishOrder = [], camH = 0, bumpT = 0, menuT = 0, raceId = 0, raceCoins = 0, curLaps = 3, wallT = 0;
const all = () => [player, ...ais];

function showCar(id) {
  if (player.mesh) scene.remove(player.mesh);
  player.mesh = makeCarModel(carDef(id)); scene.add(player.mesh); player.mid = id;
}
function previewPos() {
  const s = sampleAt(12, 0); player.mesh.position.set(s.x, 0, s.z); player.mesh.rotation.set(0, s.h, 0);
  player.mesh.userData.flame.visible = false;
}
function buildAIs(L) {
  ais.forEach(a => scene.remove(a.mesh)); ais = [];
  const boss = isBoss(L) || isMini(L);
  for (let i = 0; i < 5; i++) {
    const isB = boss && i === 0;
    const def = CARS[clamp(Math.floor(L / 3) + Math.floor(Math.random() * 3), 0, CARS.length - 1)];
    const mesh = makeCarModel(isB ? CARS[CARS.length - 1] : def, isB ? (isBoss(L) ? 0x7a0f9a : 0x9a0f0f) : (Math.random() < 0.6 ? undefined : 0x000000 + Math.floor(Math.random() * 0xffffff)));
    scene.add(mesh);
    ais.push({ mesh, p: 0, speed: 0, lat: 0, base: 0, skill: isB ? (isBoss(L) ? 1.1 : 1.06) : 0.93 + Math.random() * 0.1, boss: isB, finished: false, y: 0, airT: 0, rampCool: 0, nT: 3 + Math.random() * 6, nOn: 0 });
  }
}
function placeGrid() {
  finishOrder = []; curLaps = lapsFor(save.level);
  const order = [...ais, player];
  order.forEach((c, k) => {
    const row = Math.floor(k / 2), lat = (k % 2 ? 4 : -4);
    c.p = -4 - row * 7; c.finished = false; c.speed = 0;
    const s = sampleAt(c.p, lat);
    c.mesh.position.set(s.x, 0, s.z); c.mesh.rotation.set(0, s.h, 0);
    if (c === player) {
      Object.assign(player, { h: s.h, idx: modN(c.p) | 0, lap: -1, steerS: 0, vx: 0, vz: 0, y: 0, vy: 0, air: false, slip: 0, nLock: false, boosting: false, lat: lat });
      camH = s.h;
    } else { c.lat = lat; c.base = lat; }
  });
}

// ================= ввод =================
const held = new Set();
const KEYMAP = { ArrowUp: 'gas', KeyW: 'gas', ArrowDown: 'brake', KeyS: 'brake', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', Space: 'nitro', ShiftLeft: 'nitro' };
addEventListener('keydown', e => { if (e.target.tagName === 'INPUT') return; const k = KEYMAP[e.code]; if (k) { held.add(k); e.preventDefault(); } });
addEventListener('keyup', e => { const k = KEYMAP[e.code]; if (k) held.delete(k); });
document.querySelectorAll('.tb').forEach(b => {
  const k = b.dataset.k;
  b.addEventListener('pointerdown', e => { held.add(k); b.classList.add('on'); e.preventDefault(); });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => b.addEventListener(ev, e => { held.delete(k); b.classList.remove('on'); e.preventDefault(); }));
});
const isTouch = matchMedia('(hover:none)').matches || navigator.maxTouchPoints > 0;

// ================= звук =================
let actx, master, eng, engFilter, engGain;
function initAudio() {
  if (actx) { if (actx.state === 'suspended') actx.resume(); return; }
  try {
    actx = new (window.AudioContext || window.webkitAudioContext)();
    master = actx.createGain(); master.gain.value = save.set.snd ? 1 : 0; master.connect(actx.destination);
    eng = actx.createOscillator(); eng.type = 'sawtooth';
    engFilter = actx.createBiquadFilter(); engFilter.type = 'lowpass'; engFilter.frequency.value = 500;
    engGain = actx.createGain(); engGain.gain.value = 0;
    eng.connect(engFilter); engFilter.connect(engGain); engGain.connect(master); eng.start();
  } catch (e) { actx = null; }
}
function beep(f, d, type = 'square', v = 0.08) {
  if (!actx) return;
  const o = actx.createOscillator(), g = actx.createGain(); o.frequency.value = f; o.type = type; g.gain.value = v;
  g.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + d); o.connect(g); g.connect(master); o.start(); o.stop(actx.currentTime + d);
}
function bump(v = 0.25) {
  if (!actx) return;
  const len = actx.sampleRate * 0.18, buf = actx.createBuffer(1, len, actx.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const s = actx.createBufferSource(), g = actx.createGain(); g.gain.value = v; s.buffer = buf; s.connect(g); g.connect(master); s.start();
}
function toast(t) { const e = $('toast'); e.textContent = t; e.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => e.hidden = true, 1100); }

// ================= экраны =================
const SCREENS = ['menu', 'garage', 'settings', 'result'];
function show(id) { SCREENS.forEach(s => $(s).hidden = s !== id); }
function refreshMenu() {
  const L = save.level, th = THEMES[themeFor(L)];
  $('who').textContent = 'Гонщик: ' + save.name;
  $('lvlInfo').textContent = `Уровень ${L} · ${th.name} · ${lapsFor(L)} кр.` + (isBoss(L) ? ' · БОСС: ' + bossName(L) : isMini(L) ? ' · МИНИ-БОСС' : '');
  $('coins').textContent = save.coins;
}
function toMenu() {
  raceId++; state = 'menu'; held.clear();
  ['hud', 'count', 'result'].forEach(i => $(i).hidden = true); $('touch').hidden = true; $('fx').style.opacity = 0;
  ais.forEach(a => scene.remove(a.mesh)); ais = [];
  if (builtL !== save.level) { buildTrack(save.level); builtL = save.level; }
  showCar(save.cur); previewPos(); refreshMenu(); show('menu');
}

// ---- гараж ----
let gSel = carIdx(save.cur);
const upCost = (id, i) => Math.round(((save.cars[id].up[i]) + 1) * (150 + carIdx(id) * 120));
const repCost = id => Math.ceil(save.cars[id].dmg * (4 + carIdx(id) * 4));
function renderGarage() {
  const d = CARS[gSel], own = save.cars[d.id], e = eff(d.id);
  if (player.mid !== d.id) { showCar(d.id); previewPos(); }
  $('gName').textContent = d.name; $('gCoins').textContent = save.coins;
  $('gInfo').textContent = own ? (save.cur === d.id ? 'Выбрана' : 'В гараже') + ' · износ ' + Math.round(own.dmg) + '%' : 'Цена: ' + d.price + ' монет';
  $('gStats').innerHTML = STATS.map(([k, name], i) => {
    const up = own ? own.up[i] : 0, base = d.s[i];
    let btn = '';
    if (own) btn = up >= 5 ? '<button class="btn" disabled>МАКС</button>' : `<button class="btn" data-i="${i}" ${save.coins < upCost(d.id, i) ? 'disabled' : ''}>+ ${upCost(d.id, i)}</button>`;
    return `<div class="srow"><span>${name}</span><div class="bar"><i style="width:${base / 15 * 100}%"></i><i style="width:${up * 0.6 / 15 * 100}%"></i></div>${btn}</div>`;
  }).join('');
  const main = $('gMain');
  if (!own) { main.textContent = 'Купить'; main.disabled = save.coins < d.price; }
  else if (save.cur !== d.id) { main.textContent = 'Выбрать'; main.disabled = false; }
  else { main.textContent = 'Выбрана'; main.disabled = true; }
  const rp = $('gRepair');
  rp.hidden = !(own && own.dmg > 0.5);
  if (!rp.hidden) { rp.textContent = 'Починить · ' + repCost(d.id); rp.disabled = save.coins < repCost(d.id); }
}
$('gStats').onclick = e => {
  const b = e.target.closest('button[data-i]'); if (!b) return;
  const id = CARS[gSel].id, i = +b.dataset.i, c = upCost(id, i);
  if (save.coins >= c && save.cars[id].up[i] < 5) { save.coins -= c; save.cars[id].up[i]++; store(); beep(900, 0.1); renderGarage(); }
};
$('gMain').onclick = () => {
  const d = CARS[gSel];
  if (!save.cars[d.id]) { if (save.coins < d.price) return; save.coins -= d.price; save.cars[d.id] = { up: [0, 0, 0, 0, 0, 0], dmg: 0 }; save.cur = d.id; beep(1000, 0.2); }
  else save.cur = d.id;
  store(); renderGarage();
};
$('gRepair').onclick = () => { const id = CARS[gSel].id, c = repCost(id); if (save.coins >= c) { save.coins -= c; save.cars[id].dmg = 0; store(); beep(700, 0.15); renderGarage(); } };
$('gPrev').onclick = () => { gSel = (gSel + CARS.length - 1) % CARS.length; renderGarage(); };
$('gNext').onclick = () => { gSel = (gSel + 1) % CARS.length; renderGarage(); };
$('garageBtn').onclick = () => { initAudio(); gSel = carIdx(save.cur); state = 'garage'; show('garage'); renderGarage(); };
$('gBack').onclick = () => { state = 'menu'; toMenu(); };

// ---- настройки ----
const GFX = { low: 'Низкая', med: 'Средняя', high: 'Высокая' };
function refreshSettings() {
  $('nameIn').value = save.name; $('sndBtn').textContent = save.set.snd ? 'Вкл' : 'Выкл';
  $('gfxBtn').textContent = GFX[save.set.gfx]; $('themeBtn').textContent = save.set.theme === 'light' ? 'Светлая' : 'Тёмная';
  document.body.classList.toggle('light', save.set.theme === 'light');
  if (master) master.gain.value = save.set.snd ? 1 : 0;
}
$('setBtn').onclick = () => { state = 'settings'; show('settings'); refreshSettings(); };
$('setBack').onclick = () => { save.name = ($('nameIn').value.trim() || 'Гонщик').slice(0, 14); store(); state = 'menu'; toMenu(); };
$('sndBtn').onclick = () => { save.set.snd = save.set.snd ? 0 : 1; store(); refreshSettings(); };
$('gfxBtn').onclick = () => { const k = ['low', 'med', 'high']; save.set.gfx = k[(k.indexOf(save.set.gfx) + 1) % 3]; store(); refreshSettings(); applyGfx(); builtL = -1; };
$('themeBtn').onclick = () => { save.set.theme = save.set.theme === 'light' ? 'dark' : 'light'; store(); refreshSettings(); };
$('resetBtn').onclick = () => { if (confirm('Удалить весь прогресс?')) { const s = save.set, n = save.name; save = defSave(); save.set = s; save.name = n; store(); gSel = 0; builtL = -1; state = 'menu'; toMenu(); } };

// ================= гонка =================
function startRace() {
  initAudio();
  const L = save.level;
  if (builtL !== L) { buildTrack(L); builtL = L; }
  showCar(save.cur); phys = physFor(save.cur); player.dmg = save.cars[save.cur].dmg;
  buildAIs(L); placeGrid(); resetItems();
  nitro = phys.nCap; raceCoins = 0; player.finished = false; state = 'count'; held.clear();
  show('none'); $('hud').hidden = false; $('touch').hidden = !isTouch;
  $('bossTag').hidden = !(isBoss(L) || isMini(L));
  $('bossTag').textContent = (isBoss(L) ? 'БОСС: ' : 'МИНИ-БОСС: ') + bossName(L);
  const id = ++raceId, c = $('count'); c.hidden = false;
  [['3', 0], ['2', 1000], ['1', 2000], ['GO!', 3000]].forEach(([t, ms]) => setTimeout(() => {
    if (id !== raceId) return;
    c.textContent = t; beep(t === 'GO!' ? 880 : 440, t === 'GO!' ? 0.5 : 0.2);
    if (t === 'GO!') { state = 'race'; setTimeout(() => { if (id === raceId) c.hidden = true; }, 700); }
  }, ms));
}
$('startBtn').onclick = startRace;
$('againBtn').onclick = startRace;
$('toMenu').onclick = toMenu;
$('quitBtn').onclick = toMenu;

function addDmg(v) { player.dmg = Math.min(100, player.dmg + v); }
function angDiff(a, b) { return ((a - b + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI; }

function updatePlayer(dt) {
  const racing = state === 'race', P = phys;
  const gas = racing && held.has('gas'), brk = racing && held.has('brake');
  let steer = racing ? (held.has('right') ? 1 : 0) - (held.has('left') ? 1 : 0) : 0;

  // нитро: после опустошения блокируется, пока не накопится 25%
  if (player.nLock && nitro >= P.nCap * 0.25) player.nLock = false;
  const boost = racing && held.has('nitro') && !player.nLock && nitro > 0;
  if (boost) { nitro = Math.max(0, nitro - 38 * dt); if (nitro <= 0) player.nLock = true; }
  else nitro = Math.min(P.nCap, nitro + 6 * dt);
  player.boosting = boost;

  const m = player.mesh.position;
  const [bi, dist] = nearest(m, player.idx);
  const off = dist > ROAD_W + 0.5 && !player.air;
  const max = P.max * (boost ? P.nPow : 1) * (off ? 0.55 : 1);

  if (!player.air) {
    if (gas || boost) player.speed += P.acc * (boost ? 1.9 : 1) * (1 - clamp(player.speed / max, 0, 1)) * dt;
    if (brk) player.speed -= (player.speed > 0 ? P.brk : 14) * dt;
    if (!gas && !brk && !boost) player.speed -= player.speed * 0.35 * dt;
    if (player.speed > max) player.speed -= Math.max(25, (player.speed - max) * 2) * dt;
    if (off) player.speed -= player.speed * 1.1 * dt;
  }
  player.speed = Math.max(player.speed, -14);

  if (player.slip > 0) { player.slip -= dt; player.h += player.spin * 7 * dt; player.speed -= player.speed * 0.9 * dt; steer = 0; }
  player.steerS += (steer - player.steerS) * Math.min(1, 8 * dt);
  const sp = Math.abs(player.speed);
  if (!player.air) player.h -= player.steerS * P.hnd * 1.25 * clamp(sp / 18, 0, 1) / (1 + sp / 55) * dt * (player.speed >= 0 ? 1 : -1);

  const fx = Math.sin(player.h) * player.speed, fz = Math.cos(player.h) * player.speed;
  const g = player.air ? 0.3 : player.slip > 0 ? 0.7 : P.grip * (off ? 0.6 : 1), k = Math.min(1, g * dt);
  player.vx += (fx - player.vx) * k; player.vz += (fz - player.vz) * k;
  if (!player.air) { const sl = Math.abs(player.vx * Math.cos(player.h) - player.vz * Math.sin(player.h)); player.speed -= sl * 0.35 * dt; }
  m.x += player.vx * dt; m.z += player.vz * dt;

  if (player.air) {
    player.y += player.vy * dt; player.vy -= 24 * dt;
    if (player.y <= 0) { player.y = 0; player.vy = 0; player.air = false; player.speed *= 0.95; bump(0.12); }
  }
  m.y = player.y;

  // стена
  wallT -= dt;
  if (dist > WALL) {
    const c = pos[bi], dx = m.x - c.x, dz = m.z - c.z, d = Math.hypot(dx, dz) || 1;
    m.x = c.x + dx / d * WALL; m.z = c.z + dz / d * WALL;
    player.speed *= 0.82; player.vx *= 0.5; player.vz *= 0.5;
    if (wallT <= 0 && racing) { wallT = 0.4; bump(); addDmg(2); }
  }

  player.mesh.rotation.y = player.h;
  player.mesh.rotation.z = -player.steerS * Math.min(sp / 60, 1) * 0.05;
  player.mesh.rotation.x = player.air ? -clamp(player.vy / 40, -0.4, 0.4) : 0;
  const ud = player.mesh.userData;
  ud.wheels.forEach(w => w.rotation.x += player.speed * dt / 0.42);
  ud.tailMat.color.setHex(brk ? 0xff5050 : 0xaa1010);
  ud.flame.visible = boost; if (boost) ud.flame.scale.set(1, 1, 0.7 + Math.random() * 0.6);

  if (bi < N * 0.2 && player.idx > N * 0.8) { player.lap++; resetItems(); if (player.lap > 0 && player.lap < curLaps) toast('Круг ' + (player.lap + 1)); }
  else if (bi > N * 0.8 && player.idx < N * 0.2) player.lap--;
  player.idx = bi; player.p = player.lap * N + bi;
  player.lat = (m.x - pos[bi].x) * tan[bi].z - (m.z - pos[bi].z) * tan[bi].x;
}

function updateAI(a, dt) {
  const racing = state === 'race', L = save.level, ip = modN(a.p), i = ip | 0;
  const ang = Math.acos(clamp(tan[i].x * tan[(i + 14) % N].x + tan[i].z * tan[(i + 14) % N].z, -1, 1));
  const curv = 1 - Math.min(0.4, ang * 1.2);
  const gap = a.p - player.p;
  const rubber = a.boss ? 1 : 1 - clamp(gap * 0.0006, -0.06, 0.08);
  // нитро-рывки у ИИ на высоких уровнях
  a.nT -= dt; if (a.nT <= 0) { a.nOn = L >= 4 ? 1.4 : 0; a.nT = 7 + Math.random() * 6; }
  const nit = a.nOn > 0 ? 1.12 : 1; a.nOn -= dt;
  let target = racing ? (46 + Math.min(L, 45) * 1.15) * a.skill * curv * rubber * nit : 0;

  // умное поведение: объезд ловушек и других машин
  let tl = a.base;
  for (const it of items) if (it.on && (it.type === 'oil' || it.type === 'cone')) {
    const d = sdiff(it.idx, ip);
    if (d > 2 && d < 22 && Math.abs(it.lat - a.lat) < 3.2) tl = it.lat > 0 ? it.lat - 4.4 : it.lat + 4.4;
  }
  for (const o of all()) if (o !== a) {
    const d = sdiff(o.p, a.p);
    if (d > 0 && d < 14 && Math.abs((o.lat || 0) - a.lat) < 2.8) {
      tl = a.lat > (o.lat || 0) ? (o.lat || 0) + 3.6 : (o.lat || 0) - 3.6;
      if (d < 7 && Math.abs((o.lat || 0) - a.lat) < 1.8) target = Math.min(target, o.speed + 2);
    }
  }
  tl = clamp(tl, -6.2, 6.2);
  a.lat += clamp(tl - a.lat, -5 * dt, 5 * dt);

  a.speed += (target - a.speed) * Math.min(1, 1.6 * dt);
  a.p += a.speed * dt / SP;

  // трамплин
  a.rampCool -= dt;
  if (a.airT > 0) a.airT -= dt;
  else if (a.rampCool <= 0) for (const it of items) if (it.type === 'ramp' && Math.abs(sdiff(it.idx, ip)) < 1.5 && Math.abs(it.lat - a.lat) < 4) { a.airT = 0.9; a.rampCool = 3; }
  a.y = a.airT > 0 ? Math.sin((1 - a.airT / 0.9) * Math.PI) * 2.2 : 0;

  const s = sampleAt(a.p, a.lat);
  a.mesh.position.set(s.x, a.y, s.z); a.mesh.rotation.y = s.h;
  a.mesh.userData.wheels.forEach(w => w.rotation.x += a.speed * dt / 0.42);
  a.mesh.userData.flame.visible = a.nOn > 0 && racing;
  a.mesh.userData.tailMat.color.setHex(0xaa1010);
}

function collide() {
  const pm = player.mesh.position;
  for (const a of ais) {
    const am = a.mesh.position, dx = pm.x - am.x, dz = pm.z - am.z, d = Math.hypot(dx, dz);
    if (d < 3.6 && d > 0.01 && Math.abs(pm.y - am.y) < 1.5) {
      const push = 3.6 - d;
      pm.x += dx / d * push * 0.7; pm.z += dz / d * push * 0.7;
      a.lat += (player.lat < a.lat ? 1 : -1) * 1.5 * 0.016 * 10;
      if (performance.now() - bumpT > 300) { bump(); bumpT = performance.now(); addDmg(1.5); }
      player.speed *= 0.94; a.speed *= 0.97;
    }
  }
}

function itemsUpdate() {
  const m = player.mesh.position;
  for (const it of items) {
    if (!it.on) continue;
    const dx = m.x - it.x, dz = m.z - it.z, d2 = dx * dx + dz * dz;
    switch (it.type) {
      case 'coin': if (d2 < 5) { it.on = false; it.mesh.visible = false; raceCoins += 25; beep(1300, 0.1, 'sine'); } break;
      case 'nitro': if (d2 < 5) { it.on = false; it.mesh.visible = false; nitro = Math.min(phys.nCap, nitro + phys.nCap * 0.4); beep(600, 0.2, 'sine'); toast('Нитро +'); } break;
      case 'repair': if (d2 < 5) { it.on = false; it.mesh.visible = false; player.dmg = Math.max(0, player.dmg - 15); beep(500, 0.2, 'sine'); toast('Починка'); } break;
      case 'oil': if (d2 < 6 && !player.air && player.slip <= 0) { player.slip = 1.2; player.spin = Math.random() < 0.5 ? 1 : -1; toast('Масло!'); beep(150, 0.3, 'sawtooth'); } break;
      case 'cone': if (d2 < 4 && !player.air) { it.on = false; it.mesh.visible = false; player.speed *= 0.45; addDmg(8); bump(0.3); toast('Препятствие!'); } break;
      case 'ramp': if (d2 < 12 && !player.air && player.speed > 12) { player.air = true; player.vy = 5 + player.speed * 0.1; beep(400, 0.2, 'triangle'); } break;
    }
  }
}

function finishCheck() {
  for (const c of all()) if (!c.finished && c.p >= curLaps * N) { c.finished = true; finishOrder.push(c); }
  if (player.finished || !finishOrder.includes(player)) return;
  player.finished = true; state = 'done'; $('touch').hidden = true; $('fx').style.opacity = 0;
  const place = finishOrder.indexOf(player) + 1, L = save.level;
  const base = (80 + L * 15) * (isBoss(L) ? 2 : isMini(L) ? 1.5 : 1);
  const reward = Math.round(base * [1, 0.55, 0.3, 0.15, 0.08, 0.05][place - 1]);
  const adv = place <= 3;
  save.coins += reward + raceCoins; save.cars[save.cur].dmg = Math.min(100, player.dmg);
  if (adv) save.level++;
  store();
  $('resTitle').textContent = place === 1 ? 'Победа!' : place + '-е место';
  $('resSub').textContent = adv ? `Уровень ${L} пройден · собрано монет: ${raceCoins}` : 'Чтобы пройти уровень, финишируйте в тройке';
  $('resCoins').textContent = reward + raceCoins;
  $('againBtn').textContent = adv ? 'Дальше' : 'Ещё раз';
  setTimeout(() => { if (state === 'done') { $('hud').hidden = true; show('result'); } }, 1100);
}

function updateHUD() {
  const rank = [...all()].sort((a, b) => b.p - a.p).indexOf(player) + 1;
  $('pos').textContent = rank + '/' + (ais.length + 1);
  $('lap').textContent = clamp(Math.floor(player.p / N) + 1, 1, curLaps) + '/' + curLaps;
  $('spd').textContent = Math.round(Math.abs(player.speed) * 3.6);
  $('rc').textContent = raceCoins;
  const n = $('nitro'); n.style.width = (nitro / phys.nCap * 100) + '%'; n.classList.toggle('lock', player.nLock);
  $('fx').style.opacity = player.boosting ? 1 : 0;
}

function updateCamera(dt) {
  const m = player.mesh.position;
  if (state === 'menu' || state === 'garage' || state === 'settings') {
    menuT += dt * 0.3;
    cam.position.set(m.x + Math.sin(menuT) * 8, 2.8, m.z + Math.cos(menuT) * 8);
    cam.lookAt(m.x, 0.9, m.z); cam.fov = 55; cam.updateProjectionMatrix(); return;
  }
  camH += angDiff(player.h, camH) * Math.min(1, 4 * dt);
  const sh = player.boosting ? 0.06 : 0;
  cam.position.set(m.x - Math.sin(camH) * 9 + (Math.random() - 0.5) * sh * 4, 4.6 + player.y * 0.6 + (Math.random() - 0.5) * sh * 4, m.z - Math.cos(camH) * 9);
  cam.lookAt(m.x + Math.sin(camH) * 6, 1.4 + player.y * 0.5, m.z + Math.cos(camH) * 6);
  const fov = 68 + clamp(Math.abs(player.speed) / 70, 0, 1) * 14 + (player.boosting ? 8 : 0);
  cam.fov += (fov - cam.fov) * Math.min(1, 5 * dt); cam.updateProjectionMatrix();
}

let last = performance.now(), tAcc = 0;
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min((now - last) / 1000, 0.05); last = now; tAcc += dt;
  if (state === 'race' || state === 'count' || state === 'done') {
    updatePlayer(dt);
    if (state !== 'done') ais.forEach(a => updateAI(a, dt));
    if (state === 'race') { collide(); itemsUpdate(); finishCheck(); }
    updateHUD();
  }
  for (const it of items) if (it.on && it.mesh.userData.spin) it.mesh.userData.body.rotation.y = tAcc * 2.5;
  if (eng) {
    const s = Math.abs(player.speed), inRace = state === 'race' || state === 'count' || state === 'done';
    eng.frequency.value = 45 + s * 3.2 + (player.boosting ? 30 : 0);
    engFilter.frequency.value = 350 + s * 12;
    engGain.gain.value = inRace ? (player.boosting ? 0.07 : 0.045) : 0;
  }
  const m = player.mesh.position;
  sun.position.set(m.x + 60, 100, m.z + 40); sun.target.position.copy(m);
  spot.position.set(m.x, 1.3, m.z); spot.target.position.set(m.x + Math.sin(player.h) * 25, 0, m.z + Math.cos(player.h) * 25);
  updateCamera(dt);
  renderer.render(scene, cam);
}

// ================= запуск =================
applyGfx(); resize(); refreshSettings();
buildTrack(save.level); builtL = save.level;
showCar(save.cur); previewPos(); refreshMenu(); show('menu');
requestAnimationFrame(loop);
})();
