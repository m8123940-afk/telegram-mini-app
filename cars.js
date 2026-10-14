// Данные машин и процедурные 3D-модели (оригинальные, без чужих брендов).
// Чтобы добавить машину — допишите объект в CARS. Порядок статов: speed, accel, brake, handle, grip, nitro.
const STATS = [['speed', 'Скорость'], ['accel', 'Ускорение'], ['brake', 'Торможение'], ['handle', 'Управление'], ['grip', 'Сцепление'], ['nitro', 'Нитро']];

const SHAPES = {
  retro:  { l: 4.7, w: 2.0,  h: 0.70, cl: 2.3, cz: -0.2,  ch: 0.62, sp: 0 },
  muscle: { l: 4.7, w: 2.05, h: 0.62, cl: 1.9, cz: -0.5,  ch: 0.55, sp: 1 },
  sedan:  { l: 4.5, w: 1.95, h: 0.65, cl: 2.2, cz: -0.3,  ch: 0.55, sp: 0 },
  coupe:  { l: 4.3, w: 1.95, h: 0.58, cl: 1.8, cz: -0.45, ch: 0.50, sp: 0 },
  wedge:  { l: 4.4, w: 2.0,  h: 0.50, cl: 1.7, cz: -0.25, ch: 0.44, sp: 1 },
  super:  { l: 4.5, w: 2.06, h: 0.46, cl: 1.55, cz: -0.1, ch: 0.42, sp: 2 },
  hyper:  { l: 4.7, w: 2.18, h: 0.40, cl: 1.5, cz: 0,     ch: 0.40, sp: 2 }
};

const CARS = [
  { id: 'rust',    name: 'Ржавый Волк 72', price: 0,      col: 0xc9a227, shape: 'retro',  s: [3, 3, 3, 3, 3, 3] },
  { id: 'bulldog', name: 'Бульдог 74',     price: 700,    col: 0x8a3b2b, shape: 'muscle', s: [4, 5, 3, 3, 3, 4] },
  { id: 'topol',   name: 'Тополь Т4',      price: 1600,   col: 0x3b6ea5, shape: 'sedan',  s: [5, 4, 4, 4, 4, 4] },
  { id: 'kolibri', name: 'Колибри GT',     price: 3200,   col: 0x3aa56a, shape: 'coupe',  s: [5, 5, 5, 6, 5, 4] },
  { id: 'skat',    name: 'Скат Р1',        price: 5600,   col: 0xd8d8d0, shape: 'wedge',  s: [6, 6, 5, 6, 5, 5] },
  { id: 'yastreb', name: 'Ястреб ЛС',      price: 9000,   col: 0xe0562a, shape: 'coupe',  s: [7, 6, 6, 7, 6, 5] },
  { id: 'mamba',   name: 'Мамба V8',       price: 14000,  col: 0x1d1d22, shape: 'muscle', s: [8, 7, 6, 6, 6, 6] },
  { id: 'phantom', name: 'Фантом Z',       price: 21000,  col: 0x6a3fd0, shape: 'wedge',  s: [8, 8, 7, 7, 7, 7] },
  { id: 'corsar',  name: 'Корсар S',       price: 30000,  col: 0xd6b13a, shape: 'super',  s: [9, 8, 8, 8, 7, 7] },
  { id: 'eclipse', name: 'Эклипс 900',     price: 42000,  col: 0x2fb7c9, shape: 'super',  s: [9, 9, 8, 9, 8, 8] },
  { id: 'viper',   name: 'Вайпер Эво',     price: 58000,  col: 0xc42b2b, shape: 'super',  s: [10, 9, 9, 9, 9, 8] },
  { id: 'nova',    name: 'Нова Хайпер',    price: 80000,  col: 0xf2f2f2, shape: 'hyper',  s: [10, 10, 9, 9, 9, 9] },
  { id: 'titan',   name: 'Титан X',        price: 110000, col: 0xff8a1a, shape: 'hyper',  s: [11, 10, 10, 10, 9, 10] },
  { id: 'aurora',  name: 'Аврора ∞',       price: 150000, col: 0xe030a0, shape: 'hyper',  s: [12, 11, 10, 11, 10, 11] }
];

function makeCarModel(def, colOverride) {
  const S = SHAPES[def.shape], g = new THREE.Group();
  const body = new THREE.MeshStandardMaterial({ color: colOverride || def.col, roughness: 0.38, metalness: 0.35 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x14181d, roughness: 0.2, metalness: 0.5 });
  const y0 = 0.35;
  const add = (geo, mat, x, y, z, shadow) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = !!shadow; g.add(m); return m; };

  add(new THREE.BoxGeometry(S.w, S.h, S.l), body, 0, y0 + S.h / 2, 0, true);
  add(new THREE.BoxGeometry(S.w * 0.85, S.ch, S.cl), dark, 0, y0 + S.h + S.ch / 2 - 0.02, S.cz, true);
  add(new THREE.BoxGeometry(S.w * 0.96, 0.06, S.l * 0.32), body, 0, y0 + S.h + 0.01, S.l * 0.28, false); // капот
  if (S.sp) {
    const wy = y0 + S.h + 0.35 + (S.sp > 1 ? 0.12 : 0), wz = -S.l / 2 + 0.3;
    add(new THREE.BoxGeometry(S.w * 0.95, 0.07, 0.55), body, 0, wy, wz, true);
    add(new THREE.BoxGeometry(0.08, 0.4, 0.3), dark, -S.w * 0.3, wy - 0.2, wz, false);
    add(new THREE.BoxGeometry(0.08, 0.4, 0.3), dark, S.w * 0.3, wy - 0.2, wz, false);
  }

  const wheels = [];
  const wGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.36, 16), rGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.38, 10);
  const tire = new THREE.MeshStandardMaterial({ color: 0x0b0b0b, roughness: 0.9 });
  const rim = new THREE.MeshStandardMaterial({ color: 0xbfc3c8, roughness: 0.3, metalness: 0.8 });
  [[-1, 1], [1, 1], [-1, -1], [1, -1]].forEach(([sx, sz]) => {
    const piv = new THREE.Group(); piv.position.set(sx * (S.w / 2 + 0.02), 0.42, sz * (S.l / 2 - 0.85));
    const t = new THREE.Mesh(wGeo, tire); t.rotation.z = Math.PI / 2; piv.add(t);
    const r = new THREE.Mesh(rGeo, rim); r.rotation.z = Math.PI / 2; piv.add(r);
    g.add(piv); wheels.push(piv);
  });

  const tailMat = new THREE.MeshBasicMaterial({ color: 0xaa1010 });
  add(new THREE.BoxGeometry(S.w * 0.9, 0.16, 0.08), tailMat, 0, y0 + S.h * 0.6, -S.l / 2 - 0.01, false);
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff3c0 });
  add(new THREE.BoxGeometry(0.4, 0.16, 0.08), headMat, -S.w * 0.3, y0 + S.h * 0.55, S.l / 2 + 0.01, false);
  add(new THREE.BoxGeometry(0.4, 0.16, 0.08), headMat, S.w * 0.3, y0 + S.h * 0.55, S.l / 2 + 0.01, false);

  // пламя нитро
  const flame = new THREE.Group();
  const fm = new THREE.MeshBasicMaterial({ color: 0xff8a20, transparent: true, opacity: 0.85 });
  [-0.5, 0.5].forEach(x => {
    const c = new THREE.Mesh(new THREE.ConeGeometry(0.28, 2.2, 8), fm);
    c.rotation.x = -Math.PI / 2; c.position.set(x, 0.55, -S.l / 2 - 1.1); flame.add(c);
  });
  flame.visible = false; g.add(flame);

  g.userData = { wheels, tailMat, flame, len: S.l };
  return g;
}
