/* ===== 部品配置の 3D ビューア =====
 * 本体 30 × 40 × 10 mm（単位は mm のまま扱う）。前面 = +z、右側面 = +x、上面 = +y。
 * 右のリストで部品を選ぶ → その面までカメラが回り、部品だけが光ってラベルが 1 つ出る。
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const W = 30, H = 40, D = 10, FZ = D / 2;
const REDUCED = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const VIEWS = {
  angle:  { label: '斜め', dir: [0.75, 0.42, 1],  dist: 125, target: [0, 0, 0] },
  front:  { label: '前',   dir: [0.12, 0.08, 1],  dist: 112, target: [0, 0, 0] },
  side:   { label: '横',   dir: [1, 0.14, 0.32],  dist: 112, target: [0, 0, 0] },
  top:    { label: '上',   dir: [0.22, 1, 0.6],   dist: 112, target: [0, 3, 0] },
  bottom: { label: '下',   dir: [0.22, -1, 0.6],  dist: 112, target: [0, -3, 0] },
  full:   { label: '全体', dir: [0.5, 0.22, 1],  dist: 235, target: [0, 26, -8] },
};
const corners = (x0, x1, y0, y1, z0, z1) => [x0, x1].flatMap(x => [y0, y1].flatMap(y => [z0, z1].map(z => new THREE.Vector3(x, y, z))));
const BODY_BOX = corners(-W / 2, W / 2 + 0.8, -H / 2, H / 2, -FZ, FZ);
const STRAP_BOX = corners(-20, 20, -H / 2, 73, -28, FZ);
const LASER_VIEW = { dir: [-0.3, 0.25, 1], dist: 235, target: [-10, -20, 14] };

/* ---------- 形のヘルパー ---------- */
function std(color, o = {}) {
  return new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.5, metalness: 0.05 }, o));
}
function rrShape(w, h, r) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}
function mesh(geo, mat, pos, parent) {
  const m = new THREE.Mesh(geo, mat);
  if (pos) m.position.set(pos[0], pos[1], pos[2]);
  if (parent) parent.add(m);
  return m;
}
/* 前面に貼る丸い穴（マイク） */
function frontMic(x, y, parent, color = 0x3a4a5c) {
  const g = new THREE.Group();
  mesh(new THREE.TorusGeometry(1.0, 0.22, 12, 32), std(color, { roughness: 0.4 }), null, g);
  mesh(new THREE.CircleGeometry(0.34, 20), std(color), null, g);
  g.position.set(x, y, FZ + 0.03);
  parent.add(g);
  return g;
}
/* 寸法線（本線 + 両端の目盛り） */
function dimLine(a, b, tick) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), T = new THREE.Vector3(...tick).multiplyScalar(1.2);
  const pts = [A, B, A.clone().sub(T), A.clone().add(T), B.clone().sub(T), B.clone().add(T)];
  return new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts),
    new THREE.LineBasicMaterial({ color: 0x0891b2, transparent: true, opacity: 0.9 }));
}

/* ---------- ver3（現行） ---------- */
function buildVer3(root) {
  mesh(new RoundedBoxGeometry(W, H, D, 4, 1.6), std(0xdbe4de, { roughness: 0.6 }), null, root);
  const teal = 0x0891b2, green = 0x059669;

  const cam = new THREE.Group();
  mesh(new THREE.CircleGeometry(5.3, 48), std(0xe8f0ec), null, cam);
  mesh(new THREE.TorusGeometry(5.3, 0.4, 12, 64), std(teal, { roughness: 0.3 }), null, cam);
  mesh(new THREE.TorusGeometry(2.6, 0.3, 12, 48), std(teal, { roughness: 0.3 }), null, cam);
  mesh(new THREE.CircleGeometry(0.7, 24), std(teal), [0, 0, 0.02], cam);
  cam.position.set(0, 0, FZ + 0.02); root.add(cam);

  const led = mesh(new THREE.SphereGeometry(0.85, 20, 12), std(0xd97706, { emissive: 0xd97706, emissiveIntensity: 0.5 }), [10.3, 13.6, FZ], root);

  const top = new THREE.Group();
  mesh(new THREE.TorusGeometry(2.4, 0.3, 12, 48), std(green), null, top);
  mesh(new THREE.CircleGeometry(0.45, 20), std(green), null, top);
  top.rotation.x = -Math.PI / 2; top.position.set(9.6, H / 2 + 0.02, 0); root.add(top);

  const bot = new THREE.Group();
  mesh(new THREE.TorusGeometry(2.4, 0.3, 12, 48), std(green), null, bot);
  mesh(new THREE.CircleGeometry(0.45, 20), std(green), null, bot);
  bot.rotation.x = Math.PI / 2; bot.position.set(0, -H / 2 - 0.02, 0); root.add(bot);

  const btn = mesh(new RoundedBoxGeometry(1.6, 3.4, 5, 2, 0.5), std(0xe2e8e4, { roughness: 0.45 }), [W / 2, -7, 0], root);

  return {
    dims: true,
    groups: [
      { name: '前面', items: [
        { id: 'cam', label: 'カメラ', desc: '中央・前方', color: '#0891b2', objs: [cam], anchor: [0, 0, FZ + 0.5], view: 'front' },
        { id: 'led', label: 'LED', desc: '録画インジケータ', color: '#d97706', objs: [led], anchor: [10.3, 13.6, FZ + 0.8], view: 'front' },
      ] },
      { name: '側面', items: [
        { id: 'btn', label: 'ボタン', desc: 'PTT・押している間だけ録音', color: '#334155', objs: [btn], anchor: [W / 2 + 0.8, -7, 0], view: 'side', hl: '#0891b2' },
      ] },
      { name: '上面', items: [
        { id: 'mic-top', label: '上マイク（自分）', desc: '自分の声を拾う', color: '#059669', objs: [top], anchor: [9.6, H / 2 + 0.3, 0], view: 'top' },
      ] },
      { name: '底面', items: [
        { id: 'mic-bot', label: '下マイク（相手）', desc: '相手の声を拾う', color: '#059669', objs: [bot], anchor: [0, -H / 2 - 0.3, 0], view: 'bottom' },
      ] },
    ],
    views: ['angle', 'front', 'side', 'top', 'bottom'],
  };
}

/* ---------- 理想 ---------- */
function buildIdeal(root, scene) {
  mesh(new RoundedBoxGeometry(W, H, D, 4, 1.6), std(0xd5ded8, { roughness: 0.5 }), null, root);

  // 前面 = 全面ディスプレイ
  const disp = mesh(new THREE.ShapeGeometry(rrShape(W - 3.4, H - 3.4, 1.4), 8),
    new THREE.MeshPhysicalMaterial({ color: 0x0b141e, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 0.35 }),
    [0, 0, FZ + 0.01], root);

  // カメラ（前面左上）
  const cam = new THREE.Group();
  mesh(new THREE.TorusGeometry(2.45, 0.3, 12, 48), std(0x0891b2, { roughness: 0.3 }), null, cam);
  mesh(new THREE.CircleGeometry(2.2, 40), new THREE.MeshPhysicalMaterial({ color: 0x163243, roughness: 0.1, clearcoat: 1 }), null, cam);
  mesh(new THREE.CircleGeometry(0.95, 32), std(0x04090f, { roughness: 0.1 }), [0, 0, 0.01], cam);
  cam.position.set(-8.1, 15.3, FZ + 0.03); root.add(cam);

  // レーザー + ToF（前面下・左）
  const laser = new THREE.Group();
  mesh(new THREE.CircleGeometry(0.8, 24), std(0x22c55e, { emissive: 0x22c55e, emissiveIntensity: 0.9 }), [-11.4, -16, 0], laser);
  mesh(new THREE.TorusGeometry(0.8, 0.14, 8, 28), std(0x16a34a), [-11.4, -16, 0], laser);
  mesh(new THREE.CircleGeometry(0.45, 20), std(0x38bdf8, { emissive: 0x38bdf8, emissiveIntensity: 0.5 }), [-12.85, -16, 0], laser);
  laser.position.z = FZ + 0.03; root.add(laser);

  // レーザーの投影（選んだときだけ出す）: 地面の点・矢印・枠
  const beam = new THREE.Group(); beam.visible = false;
  const L0 = new THREE.Vector3(-11.4, -16, FZ + 0.05), G = new THREE.Vector3(-24, -62, 38);
  const beamLen = L0.distanceTo(G);
  const beamMesh = mesh(new THREE.CylinderGeometry(0.18, 0.18, beamLen, 8),
    new THREE.MeshBasicMaterial({ color: 0x22c55e, transparent: true, opacity: 0.75 }), null, beam);
  beamMesh.position.copy(L0).lerp(G, 0.5);
  beamMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), G.clone().sub(L0).normalize());
  const glow = mesh(new THREE.CylinderGeometry(0.7, 0.7, beamLen, 12),
    new THREE.MeshBasicMaterial({ color: 0x22c55e, transparent: true, opacity: 0.12, depthWrite: false }), null, beam);
  glow.position.copy(beamMesh.position); glow.quaternion.copy(beamMesh.quaternion);
  const ground = new THREE.Group(); ground.position.copy(G); ground.rotation.x = -Math.PI / 2; beam.add(ground);
  mesh(new THREE.ShapeGeometry(rrShape(22, 13, 1.6)), new THREE.MeshBasicMaterial({ color: 0x22c55e, transparent: true, opacity: 0.1, side: THREE.DoubleSide, depthWrite: false }), [0, 0, 0], ground);
  const frame = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(rrShape(22, 13, 1.6).getPoints(6)), new THREE.LineBasicMaterial({ color: 0x16a34a }));
  ground.add(frame);
  mesh(new THREE.CircleGeometry(0.9, 20), new THREE.MeshBasicMaterial({ color: 0x16a34a, side: THREE.DoubleSide }), [0, 0, 0.02], ground);
  const arrow = new THREE.Shape();
  arrow.moveTo(0, 0); arrow.lineTo(1.6, 3.4); arrow.lineTo(0.5, 3.1); arrow.lineTo(0.5, 6.5); arrow.lineTo(-0.5, 6.5); arrow.lineTo(-0.5, 3.1); arrow.lineTo(-1.6, 3.4); arrow.closePath();
  const arr = mesh(new THREE.ShapeGeometry(arrow), new THREE.MeshBasicMaterial({ color: 0x16a34a, side: THREE.DoubleSide }), [4.5, -4.5, 0.02], ground);
  arr.rotation.z = -Math.PI * 0.75;
  root.add(beam);

  // 下マイク ×2
  const mics = [frontMic(-8.4, -16, root), frontMic(8.4, -16, root)];

  // スピーカー（前面下中央）
  const spk = new THREE.Group();
  mesh(new THREE.ShapeGeometry(rrShape(7.3, 3.9, 1.95), 8), std(0x1b2734, { roughness: 0.6 }), null, spk);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++)
    mesh(new THREE.CircleGeometry(0.28, 12), std(0x4a5b6e), [-2.1 + i * 1.4, 0.65 - j * 1.3, 0.01], spk);
  spk.position.set(0, -16, FZ + 0.03); root.add(spk);

  // 上マイク（上面）
  const top = new THREE.Group();
  mesh(new THREE.CircleGeometry(2.4, 40), std(0xf4f7f5), null, top);
  mesh(new THREE.TorusGeometry(2.4, 0.18, 8, 40), std(0xb9c7bf), null, top);
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++)
    mesh(new THREE.CircleGeometry(0.3, 12), std(0x9aa6ad), [i * 1.1, j * 1.1, 0.01], top);
  top.rotation.x = -Math.PI / 2; top.position.set(8.6, H / 2 + 0.02, 0); root.add(top);

  // 側面ボタン ×3
  const btn = (y, h, color) => mesh(new RoundedBoxGeometry(1.6, h, 5, 2, 0.5), std(color, { roughness: 0.4 }), [W / 2, y, 0], root);
  const yes = btn(9.0, 3.6, 0xb7f0cc), no = btn(3.4, 3.6, 0xfbccd1), talk = btn(-6.6, 6.2, 0xd1dae2);

  // ---- ネックレス型ストラップ（全体表示のときだけ見せる） ----
  const strap = new THREE.Group(); strap.visible = false; root.add(strap);
  const strapMat = () => std(0xe3e8ef, { roughness: 0.55 });
  const curve = new THREE.CatmullRomCurve3([
    [-13, 21.2, 0], [-17.5, 38, -3], [-16, 60, -15], [0, 71, -26], [16, 60, -15], [17.5, 38, -3], [13, 21.2, 0],
  ].map(p => new THREE.Vector3(...p)), false, 'centripetal');
  const thin = mesh(new THREE.TubeGeometry(curve, 160, 0.9, 12), strapMat(), null, strap);
  const subPts = []; for (let i = 0; i <= 60; i++) subPts.push(curve.getPoint(0.24 + 0.52 * i / 60));
  const battery = mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(subPts), 100, 2.1, 16), strapMat(), null, strap);
  const eyelets = [-13, 13].map(x => {
    const e = mesh(new THREE.TorusGeometry(1.15, 0.4, 10, 28), std(0xcbd5e1, { roughness: 0.35, metalness: 0.4 }), [x, H / 2 + 1.0, 0], strap);
    return e;
  });
  const apex = mesh(new THREE.SphereGeometry(1, 24, 16), strapMat(), null, strap);
  apex.scale.set(4, 2.6, 2.8); apex.position.copy(curve.getPoint(0.5));

  // イヤホン: 左 = ストラップに着いた状態 / 右 = 外した状態
  const bud = (mat) => new THREE.Mesh(new THREE.CapsuleGeometry(1.7, 3.6, 6, 16), mat);
  const up = new THREE.Vector3(0, 1, 0);
  const budL = bud(strapMat());
  budL.position.copy(curve.getPoint(0.17)); budL.quaternion.setFromUnitVectors(up, curve.getTangent(0.17)); strap.add(budL);
  const dock = curve.getPoint(0.8);
  const budRPos = dock.clone().add(new THREE.Vector3(-5, -11, 4));
  const budR = bud(std(0xf8fafc, { roughness: 0.3 }));
  budR.position.copy(budRPos); budR.rotation.z = -0.35; strap.add(budR);
  const cable = mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
    dock, dock.clone().add(new THREE.Vector3(-1, -5, 2.5)), budRPos.clone().add(new THREE.Vector3(0.8, 2.6, 0)),
  ]), 40, 0.3, 8), std(0x8a96a8), null, strap);

  return {
    dims: true,
    beam, strap,
    groups: [
      { name: '前面', items: [
        { id: 'cam', label: 'カメラ', desc: '前面左上・静止画/動画', color: '#0891b2', objs: [cam], anchor: [-8.1, 15.3, FZ + 0.5], view: 'front' },
        { id: 'disp', label: 'ディスプレイ', desc: '全面・有機EL想定', color: '#334155', objs: [disp], anchor: [3, 2, FZ + 0.2], view: 'front', hl: '#0891b2' },
        { id: 'laser', label: 'レーザー＋ToF', desc: '点・矢印・枠を投影／ToFで測距', color: '#16a34a', objs: [laser], anchor: [-11.4, -16, FZ + 0.5], view: LASER_VIEW, beam: true },
        { id: 'mics', label: '下マイク×2（相手）', desc: '相手の声を拾う', color: '#475569', objs: mics, anchor: [8.4, -16, FZ + 0.5], view: 'front', hl: '#0891b2' },
        { id: 'spk', label: 'スピーカー', desc: '前面下中央', color: '#475569', objs: [spk], anchor: [0, -16, FZ + 0.5], view: 'front', hl: '#0891b2' },
      ] },
      { name: '側面', items: [
        { id: 'yes', label: 'ボタン(yes)', desc: '確定', color: '#15803d', objs: [yes], anchor: [W / 2 + 0.8, 9.0, 0], view: 'side', hl: '#22c55e' },
        { id: 'no', label: 'ボタン(no)', desc: '取消', color: '#b91c1c', objs: [no], anchor: [W / 2 + 0.8, 3.4, 0], view: 'side', hl: '#ef4444' },
        { id: 'talk', label: 'ボタン(talk)', desc: '押して話す', color: '#334155', objs: [talk], anchor: [W / 2 + 0.8, -6.6, 0], view: 'side', hl: '#0891b2' },
      ] },
      { name: '上面', items: [
        { id: 'mic-top', label: '上マイク（自分）', desc: '自分の声を拾う', color: '#475569', objs: [top], anchor: [8.6, H / 2 + 0.3, 0], view: 'top', hl: '#059669' },
      ] },
      { name: 'ストラップ', items: [
        { id: 'strap', label: 'ストラップ', desc: 'ネックレス型', color: '#475569', objs: [thin, ...eyelets], anchor: curve.getPoint(0.1).toArray(), view: 'full', strap: true, hl: '#0891b2' },
        { id: 'sub', label: '電源(サブ)', desc: 'ストラップ内蔵バッテリー 600mAh', color: '#475569', objs: [battery, apex], anchor: curve.getPoint(0.36).toArray(), view: 'full', strap: true, hl: '#d97706' },
        { id: 'ear', label: 'イヤホン', desc: '有線・マグネットで着脱', color: '#475569', objs: [budL, budR, cable], anchor: budRPos.toArray(), view: 'full', strap: true, hl: '#0891b2' },
      ] },
    ],
    views: ['angle', 'front', 'side', 'top', 'full'],
  };
}

/* ---------- ビューア本体 ---------- */
function createViewer(host) {
  const kind = host.dataset.model;

  host.innerHTML = `
    <div class="v3d-layout">
      <div class="v3d-stage">
        <svg class="v3d-lines" aria-hidden="true"><line/><circle r="3.5"/></svg>
        <div class="v3d-overlay"></div>
        <div class="v3d-label" hidden><b></b><span></span></div>
        <div class="v3d-hint">ドラッグで回転・部品をタップ</div>
        <div class="v3d-views" role="group" aria-label="向き"></div>
      </div>
      <div class="v3d-list"></div>
    </div>`;
  const stage = host.querySelector('.v3d-stage');
  const overlay = host.querySelector('.v3d-overlay');
  const labelEl = host.querySelector('.v3d-label');
  const lineEl = host.querySelector('.v3d-lines line');
  const dotEl = host.querySelector('.v3d-lines circle');
  const hint = host.querySelector('.v3d-hint');

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  } catch (e) {
    stage.innerHTML = '<p class="v3d-fallback">この端末では 3D を表示できません</p>';
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  stage.prepend(renderer.domElement);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.add(new THREE.HemisphereLight(0xffffff, 0xdfe7e1, 0.6));
  const sun = new THREE.DirectionalLight(0xffffff, 1.4); sun.position.set(40, 80, 60); scene.add(sun);

  const camera = new THREE.PerspectiveCamera(30, 1, 1, 3000);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.minDistance = 60;
  controls.maxDistance = 420;

  const root = new THREE.Group(); scene.add(root);
  const model = kind === 'ideal' ? buildIdeal(root, scene) : buildVer3(root);

  // 寸法線
  const dims = [
    { line: dimLine([-15, -23, FZ], [15, -23, FZ], [0, 1, 0]), a: [-15, -23, FZ], b: [15, -23, FZ], at: [0, -26.5, FZ], text: '30 mm' },
    { line: dimLine([-18.5, -20, FZ], [-18.5, 20, FZ], [1, 0, 0]), a: [-18.5, -20, FZ], b: [-18.5, 20, FZ], at: [-22.5, 0, FZ], text: '40 mm' },
    { line: dimLine([-15, 23, FZ], [-15, 23, -FZ], [0, 1, 0]), a: [-15, 23, FZ], b: [-15, 23, -FZ], at: [-15, 26.5, 0], text: '10 mm' },
  ];
  const dimGroup = new THREE.Group(); root.add(dimGroup);
  dims.forEach(d => {
    dimGroup.add(d.line);
    d.el = document.createElement('div'); d.el.className = 'v3d-dim'; d.el.textContent = d.text;
    overlay.appendChild(d.el);
  });

  // 部品ごとの素材を控える（光らせたあと元に戻すため）
  const items = [];
  const pickables = [];
  model.groups.forEach(g => g.items.forEach(it => {
    it.meshes = [];
    it.objs.forEach(o => o.traverse(m => {
      if (!m.isMesh) return;
      m.material = m.material.clone();
      m.userData.item = it;
      m.userData.base = { c: m.material.color.clone(), e: m.material.emissive.clone(), i: m.material.emissiveIntensity };
      it.meshes.push(m); pickables.push(m);
    }));
    it.anchorV = new THREE.Vector3(...it.anchor);
    items.push(it);
  }));

  // リスト
  const list = host.querySelector('.v3d-list');
  model.groups.forEach(g => {
    const sec = document.createElement('div'); sec.className = 'v3d-group';
    sec.innerHTML = `<h4>${g.name}</h4><div class="v3d-items"></div>`;
    const wrap = sec.querySelector('.v3d-items');
    g.items.forEach(it => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'v3d-item';
      b.innerHTML = `<i style="background:${it.hl || it.color}"></i>${it.label}`;
      b.addEventListener('click', () => select(selected === it ? null : it));
      it.btn = b; wrap.appendChild(b);
    });
    list.appendChild(sec);
  });

  // 向きボタン
  const viewsEl = host.querySelector('.v3d-views');
  model.views.forEach(v => {
    const b = document.createElement('button');
    b.type = 'button'; b.textContent = VIEWS[v].label; b.dataset.v = v;
    b.addEventListener('click', () => { select(null, true); setView(v); });
    viewsEl.appendChild(b);
  });

  /* ---- 状態 ---- */
  let selected = null, viewName = 'angle', tween = null;

  function fitScale() {
    const a = stage.clientWidth / Math.max(1, stage.clientHeight);
    return a < 0.95 ? Math.min(1.7, 0.95 / a) : 1;
  }
  function goTo(v, instant) {
    const dir = new THREE.Vector3(...v.dir).normalize();
    const target = new THREE.Vector3(...v.target);
    const toO = dir.multiplyScalar(v.dist * fitScale());
    const fromO = camera.position.clone().sub(controls.target);
    if (instant || REDUCED) {
      controls.target.copy(target); camera.position.copy(target).add(toO); controls.update(); tween = null; return;
    }
    tween = {
      q: new THREE.Quaternion().setFromUnitVectors(fromO.clone().normalize(), toO.clone().normalize()),
      fromDir: fromO.clone().normalize(), fromLen: fromO.length(), toLen: toO.length(),
      fromT: controls.target.clone(), toT: target, t0: performance.now(), dur: 750,
    };
  }
  function setView(v, instant) {
    viewName = v;
    viewsEl.querySelectorAll('button').forEach(b => b.classList.toggle('is-active', b.dataset.v === v));
    updateVisibility();
    goTo(VIEWS[v], instant);
  }
  function updateVisibility() {
    const showStrap = viewName === 'full' || (selected && selected.strap);
    if (model.strap) model.strap.visible = !!showStrap;
    if (model.beam) model.beam.visible = !!(selected && selected.beam);
    dimGroup.visible = !showStrap && !(selected && selected.beam);
  }
  function resetGlow(it) {
    it.meshes.forEach(m => {
      const b = m.userData.base;
      m.material.color.copy(b.c); m.material.emissive.copy(b.e); m.material.emissiveIntensity = b.i;
    });
  }
  function select(it, keepView) {
    if (selected) { resetGlow(selected); selected.btn.classList.remove('is-active'); }
    selected = it;
    if (it) {
      it.btn.classList.add('is-active');
      labelEl.querySelector('b').textContent = it.label;
      labelEl.querySelector('b').style.color = it.color;
      labelEl.querySelector('span').textContent = it.desc;
      labelEl.hidden = false;
      viewsEl.querySelectorAll('button').forEach(b => b.classList.remove('is-active'));
      if (typeof it.view === 'string') viewName = it.view; else viewName = null;
      updateVisibility();
      goTo(typeof it.view === 'string' ? VIEWS[it.view] : it.view);
      hideHint();
      if (window.__mascotBeep) window.__mascotBeep();
    } else {
      labelEl.hidden = true;
      if (!keepView) updateVisibility();
    }
  }
  function hideHint() { hint.classList.add('is-hidden'); }

  /* ---- タップで部品を選ぶ ---- */
  const ray = new THREE.Raycaster(), ptr = new THREE.Vector2();
  let down = null;
  renderer.domElement.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY }; });
  renderer.domElement.addEventListener('pointerup', e => {
    if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) { down = null; return; }
    down = null;
    const r = renderer.domElement.getBoundingClientRect();
    ptr.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ptr, camera);
    const hit = ray.intersectObjects(pickables.filter(m => isShown(m)), false)[0];
    if (hit) select(hit.object.userData.item === selected ? null : hit.object.userData.item);
  });
  renderer.domElement.addEventListener('pointermove', e => {
    if (e.buttons) return;
    const r = renderer.domElement.getBoundingClientRect();
    ptr.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ptr, camera);
    stage.classList.toggle('is-over', ray.intersectObjects(pickables.filter(m => isShown(m)), false).length > 0);
  });
  function isShown(o) { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true; }
  controls.addEventListener('start', () => { tween = null; hideHint(); });

  /* ---- 画面上の位置を求める ---- */
  const tmp = new THREE.Vector3();
  function toScreen(v, w, h) {
    tmp.copy(v).project(camera);
    return { x: (tmp.x + 1) / 2 * w, y: (1 - tmp.y) / 2 * h };
  }
  function updateOverlay(w, h) {
    dims.forEach(d => {
      const a = toScreen(new THREE.Vector3(...d.a), w, h), b = toScreen(new THREE.Vector3(...d.b), w, h);
      const show = dimGroup.visible && Math.hypot(a.x - b.x, a.y - b.y) > 38;
      d.el.style.display = show ? '' : 'none';
      if (show) { const p = toScreen(new THREE.Vector3(...d.at), w, h); d.el.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -50%)`; }
    });
    if (!selected) { lineEl.style.display = dotEl.style.display = 'none'; return; }
    const p = toScreen(selected.anchorV, w, h);
    // ラベルは形の外（左右どちらか）に置く。形の画面上の幅は外接箱の 8 隅から取る
    const box = selected.strap ? STRAP_BOX : BODY_BOX;
    let minX = Infinity, maxX = -Infinity;
    box.forEach(v => { const s = toScreen(v, w, h); minX = Math.min(minX, s.x); maxX = Math.max(maxX, s.x); });
    const mid = toScreen(new THREE.Vector3(0, selected.anchorV.y, selected.anchorV.z), w, h);
    const right = p.x - mid.x > 4;
    const lw = labelEl.offsetWidth, lh = labelEl.offsetHeight;
    let lx = right ? maxX + 36 : minX - 36 - lw, ly = p.y - lh / 2;
    lx = Math.max(8, Math.min(w - lw - 8, lx)); ly = Math.max(8, Math.min(h - lh - 56, ly));
    labelEl.style.transform = `translate(${lx}px, ${ly}px)`;
    lineEl.style.display = dotEl.style.display = '';
    lineEl.setAttribute('x1', p.x); lineEl.setAttribute('y1', p.y);
    lineEl.setAttribute('x2', lx + lw / 2); lineEl.setAttribute('y2', ly + lh / 2);
    lineEl.style.stroke = selected.hl || selected.color;
    dotEl.setAttribute('cx', p.x); dotEl.setAttribute('cy', p.y);
    dotEl.style.fill = selected.hl || selected.color;
  }

  /* ---- ループ ---- */
  let lastW = 0, lastH = 0;
  const hlColor = new THREE.Color();
  function frame(now) {
    requestAnimationFrame(frame);
    const w = stage.clientWidth, h = stage.clientHeight;
    if (!w || !h) return; // タブで隠れている間は描かない
    if (w !== lastW || h !== lastH) {
      const first = !lastW;
      lastW = w; lastH = h;
      renderer.setSize(w, h, false);
      camera.aspect = w / h; camera.updateProjectionMatrix();
      if (first) setView('angle', true);
    }
    if (tween) {
      const k = Math.min(1, (now - tween.t0) / tween.dur), e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      const q = new THREE.Quaternion().slerp(tween.q, e);
      const dir = tween.fromDir.clone().applyQuaternion(q);
      controls.target.lerpVectors(tween.fromT, tween.toT, e);
      camera.position.copy(controls.target).add(dir.multiplyScalar(tween.fromLen + (tween.toLen - tween.fromLen) * e));
      if (k >= 1) tween = null;
    }
    controls.update();
    if (selected) {
      hlColor.set(selected.hl || selected.color);
      // 白い部品も黒い部品も光って見えるよう、色を寄せる + 発光を足す
      const s = 0.5 + 0.5 * Math.sin(now / 180);
      selected.meshes.forEach(m => {
        m.material.color.copy(m.userData.base.c).lerp(hlColor, 0.45 + 0.35 * s);
        m.material.emissive.copy(hlColor); m.material.emissiveIntensity = 0.25 + 0.35 * s;
      });
    }
    renderer.render(scene, camera);
    updateOverlay(w, h);
  }
  requestAnimationFrame(frame);
}

document.querySelectorAll('.v3d-root').forEach(createViewer);
