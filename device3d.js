/* ===== 部品配置の 3D ビューア =====
 * 本体 30 × 40 × 10 mm（単位は mm のまま扱う）。前面 = +z、右側面 = +x、上面 = +y。
 * 右のリストで部品を選ぶ → その面までカメラが回り、部品だけが光ってラベルが 1 つ出る。
 * 見た目は「暗いスタジオに置いたアルミの製品写真」。床に影、発光部分はブルームでにじませる。
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const W = 30, H = 40, D = 10, FZ = D / 2;
const FLOOR_Y = -30;
const REDUCED = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const VIEWS = {
  angle:  { label: '斜め', dir: [0.75, 0.42, 1],  dist: 125, target: [0, 0, 0] },
  front:  { label: '前',   dir: [0.12, 0.08, 1],  dist: 112, target: [0, 0, 0] },
  side:   { label: '横',   dir: [1, 0.14, 0.32],  dist: 112, target: [0, 0, 0] },
  top:    { label: '上',   dir: [0.22, 1, 0.6],   dist: 112, target: [0, 3, 0] },
  bottom: { label: '下',   dir: [0.22, -1, 0.6],  dist: 112, target: [0, -3, 0] },
  full:   { label: '全体', dir: [0.5, 0.22, 1],   dist: 235, target: [0, 24, -8] },
};
const corners = (x0, x1, y0, y1, z0, z1) => [x0, x1].flatMap(x => [y0, y1].flatMap(y => [z0, z1].map(z => new THREE.Vector3(x, y, z))));
const BODY_BOX = corners(-W / 2, W / 2 + 0.8, -H / 2, H / 2, -FZ, FZ);
const STRAP_BOX = corners(-20, 20, -H / 2, 73, -28, FZ);
const LASER_VIEW = { dir: [-0.3, 0.32, 1], dist: 200, target: [-10, -12, 16] };

/* ---------- 素材 ---------- */
function std(color, o = {}) {
  return new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.5, metalness: 0.05 }, o));
}
const alu = (color = 0xc9cfd3) => new THREE.MeshPhysicalMaterial({
  color, metalness: 0.85, roughness: 0.48,
});
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* ---------- 形のヘルパー ---------- */
function rrShape(w, h, r) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}
/* ShapeGeometry の UV は座標そのままなので 0〜1 に直す */
function rrPlane(w, h, r) {
  const g = new THREE.ShapeGeometry(rrShape(w, h, r), 8);
  const p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) + w / 2) / w, (p.getY(i) + h / 2) / h);
  return g;
}
function mesh(geo, mat, pos, parent) {
  const m = new THREE.Mesh(geo, mat);
  if (pos) m.position.set(pos[0], pos[1], pos[2]);
  if (parent) parent.add(m);
  return m;
}
function frontMic(x, y, parent) {
  const g = new THREE.Group();
  mesh(new THREE.TorusGeometry(1.0, 0.2, 12, 32), alu(0x8b949b), null, g);
  mesh(new THREE.CircleGeometry(0.34, 20), std(0x020406), null, g);
  g.position.set(x, y, FZ + 0.03);
  parent.add(g);
  return g;
}
function dimLine(a, b, tick) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), T = new THREE.Vector3(...tick).multiplyScalar(1.2);
  const pts = [A, B, A.clone().sub(T), A.clone().add(T), B.clone().sub(T), B.clone().add(T)];
  return new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts),
    new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.55 }));
}

/* ---------- スタジオ（背景・床・影） ---------- */
function buildStudio(scene) {
  scene.background = canvasTex(512, 512, (g, w, h) => {
    const r = g.createRadialGradient(w * 0.5, h * 0.32, 10, w * 0.5, h * 0.5, w * 0.78);
    r.addColorStop(0, '#1d2b26'); r.addColorStop(0.55, '#0d1412'); r.addColorStop(1, '#050807');
    g.fillStyle = r; g.fillRect(0, 0, w, h);
  });
  const floor = new THREE.Group(); floor.position.y = FLOOR_Y; scene.add(floor);
  const glow = mesh(new THREE.CircleGeometry(80, 64), new THREE.MeshBasicMaterial({
    transparent: true, depthWrite: false,
    map: canvasTex(512, 512, (g, w) => {
      const r = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
      r.addColorStop(0, 'rgba(52,211,153,0.16)'); r.addColorStop(0.5, 'rgba(52,211,153,0.05)'); r.addColorStop(1, 'rgba(52,211,153,0)');
      g.fillStyle = r; g.fillRect(0, 0, w, w);
      g.strokeStyle = 'rgba(110,231,183,0.13)'; g.lineWidth = 1.5;
      [0.36, 0.62].forEach(k => { g.beginPath(); g.arc(w / 2, w / 2, w / 2 * k, 0, Math.PI * 2); g.stroke(); });
    }),
  }), null, floor);
  glow.rotation.x = -Math.PI / 2;
  const shadow = mesh(new THREE.PlaneGeometry(52, 34), new THREE.MeshBasicMaterial({
    transparent: true, depthWrite: false,
    map: canvasTex(256, 256, (g, w) => {
      const r = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
      r.addColorStop(0, 'rgba(0,0,0,0.75)'); r.addColorStop(0.45, 'rgba(0,0,0,0.35)'); r.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = r; g.fillRect(0, 0, w, w);
    }),
  }), [0, 0.02, 0], floor);
  shadow.rotation.x = -Math.PI / 2;
}

/* ---------- ディスプレイの画面（時計 + 声の波形、ゆっくり動く） ---------- */
function makeScreen() {
  const c = document.createElement('canvas'); c.width = 540; c.height = 740;
  const g = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  function draw(t) {
    const w = c.width, h = c.height;
    const bg = g.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#08121c'); bg.addColorStop(1, '#020508');
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    const orbY = 330, pulse = 1 + 0.04 * Math.sin(t * 2.2);
    const halo = g.createRadialGradient(w / 2, orbY, 0, w / 2, orbY, 250);
    halo.addColorStop(0, 'rgba(52,211,153,0.40)'); halo.addColorStop(1, 'rgba(52,211,153,0)');
    g.fillStyle = halo; g.fillRect(0, 0, w, h);
    const core = g.createRadialGradient(w / 2 - 20, orbY - 24, 4, w / 2, orbY, 78 * pulse);
    core.addColorStop(0, '#d1fae5'); core.addColorStop(0.45, '#34d399'); core.addColorStop(1, 'rgba(16,185,129,0.15)');
    g.fillStyle = core; g.beginPath(); g.arc(w / 2, orbY, 78 * pulse, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.88)';
    g.font = '300 46px "Noto Sans JP", sans-serif'; g.textAlign = 'center';
    g.fillText('9:41', w / 2, 150);
    const n = 17, bw = 12, gap = 10, x0 = w / 2 - (n * bw + (n - 1) * gap) / 2;
    for (let i = 0; i < n; i++) {
      const k = Math.abs(i - (n - 1) / 2) / ((n - 1) / 2);
      const amp = (0.25 + 0.75 * (1 - k)) * (0.45 + 0.55 * Math.abs(Math.sin(t * 3 + i * 0.7)));
      const bh = 10 + 70 * amp;
      g.fillStyle = `rgba(110,231,183,${0.45 + 0.5 * (1 - k)})`;
      g.beginPath(); g.roundRect(x0 + i * (bw + gap), 530 - bh / 2, bw, bh, 6); g.fill();
    }
    tex.needsUpdate = true;
  }
  draw(0);
  return { tex, draw };
}

/* ---------- ver3（現行） ---------- */
function buildVer3(root) {
  mesh(new RoundedBoxGeometry(W, H, D, 5, 1.6), alu(0xcfd5d8), null, root);
  const teal = 0x22d3ee, green = 0x34d399;

  const cam = new THREE.Group();
  mesh(new THREE.CircleGeometry(5.3, 48), new THREE.MeshPhysicalMaterial({ color: 0x0b1419, roughness: 0.08, clearcoat: 1 }), null, cam);
  mesh(new THREE.TorusGeometry(5.3, 0.4, 16, 64), alu(0x9aa3a9), null, cam);
  mesh(new THREE.TorusGeometry(2.6, 0.22, 12, 48), std(teal, { emissive: teal, emissiveIntensity: 0.25 }), null, cam);
  mesh(new THREE.CircleGeometry(1.3, 24), std(0x020406, { roughness: 0.1 }), [0, 0, 0.02], cam);
  cam.position.set(0, 0, FZ + 0.02); root.add(cam);

  const led = mesh(new THREE.SphereGeometry(0.85, 20, 12), std(0xf59e0b, { emissive: 0xf59e0b, emissiveIntensity: 2.6 }), [10.3, 13.6, FZ], root);

  const ringMic = (rotX, pos) => {
    const g = new THREE.Group();
    mesh(new THREE.TorusGeometry(2.4, 0.26, 12, 48), std(green, { emissive: green, emissiveIntensity: 0.35 }), null, g);
    mesh(new THREE.CircleGeometry(0.5, 20), std(0x020406), null, g);
    g.rotation.x = rotX; g.position.set(...pos); root.add(g);
    return g;
  };
  const top = ringMic(-Math.PI / 2, [9.6, H / 2 + 0.02, 0]);
  const bot = ringMic(Math.PI / 2, [0, -H / 2 - 0.02, 0]);

  const btn = mesh(new RoundedBoxGeometry(1.6, 3.4, 5, 2, 0.5), alu(0x9ea7ad), [W / 2, -7, 0], root);

  return {
    groups: [
      { name: '前面', items: [
        { id: 'cam', label: 'カメラ', desc: '中央・前方', color: '#22d3ee', objs: [cam], anchor: [0, 0, FZ + 0.5], view: 'front' },
        { id: 'led', label: 'LED', desc: '録画インジケータ', color: '#f59e0b', objs: [led], anchor: [10.3, 13.6, FZ + 0.8], view: 'front' },
      ] },
      { name: '側面', items: [
        { id: 'btn', label: 'ボタン', desc: 'PTT・押している間だけ録音', color: '#38bdf8', objs: [btn], anchor: [W / 2 + 0.8, -7, 0], view: 'side' },
      ] },
      { name: '上面', items: [
        { id: 'mic-top', label: '上マイク（自分）', desc: '自分の声を拾う', color: '#34d399', objs: [top], anchor: [9.6, H / 2 + 0.3, 0], view: 'top' },
      ] },
      { name: '底面', items: [
        { id: 'mic-bot', label: '下マイク（相手）', desc: '相手の声を拾う', color: '#34d399', objs: [bot], anchor: [0, -H / 2 - 0.3, 0], view: 'bottom' },
      ] },
    ],
    views: ['angle', 'front', 'side', 'top', 'bottom'],
  };
}

/* ---------- 理想 ---------- */
function buildIdeal(root) {
  mesh(new RoundedBoxGeometry(W, H, D, 5, 1.6), alu(), null, root);

  // 前面 = 全面ディスプレイ（光る画面）
  const screen = makeScreen();
  const disp = mesh(rrPlane(W - 3.4, H - 3.4, 1.4),
    new THREE.MeshPhysicalMaterial({
      color: 0x000000, emissive: 0xffffff, emissiveMap: screen.tex, emissiveIntensity: 1,
      roughness: 0.2, clearcoat: 0.5, clearcoatRoughness: 0.1, envMapIntensity: 0.2,
    }),
    [0, 0, FZ + 0.01], root);

  // カメラ（前面左上）
  const cam = new THREE.Group();
  mesh(new THREE.TorusGeometry(2.45, 0.32, 16, 48), alu(0x8b949b), null, cam);
  mesh(new THREE.CircleGeometry(2.2, 40), new THREE.MeshPhysicalMaterial({ color: 0x0c1f2b, roughness: 0.05, clearcoat: 1 }), null, cam);
  mesh(new THREE.TorusGeometry(1.35, 0.08, 8, 40), std(0x22d3ee, { emissive: 0x22d3ee, emissiveIntensity: 0.6 }), [0, 0, 0.01], cam);
  mesh(new THREE.CircleGeometry(0.95, 32), std(0x010203, { roughness: 0.05 }), [0, 0, 0.012], cam);
  cam.position.set(-8.1, 15.3, FZ + 0.03); root.add(cam);

  // レーザー + ToF（前面下・左）
  const laser = new THREE.Group();
  mesh(new THREE.CircleGeometry(0.8, 24), std(0x22c55e, { emissive: 0x22c55e, emissiveIntensity: 3 }), [-11.4, -16, 0], laser);
  mesh(new THREE.TorusGeometry(0.8, 0.14, 8, 28), alu(0x8b949b), [-11.4, -16, 0], laser);
  mesh(new THREE.CircleGeometry(0.45, 20), std(0x38bdf8, { emissive: 0x38bdf8, emissiveIntensity: 1.2 }), [-12.85, -16, 0], laser);
  laser.position.z = FZ + 0.03; root.add(laser);

  // レーザーの投影（選んだときだけ）: 床に点・矢印・枠
  const beam = new THREE.Group(); beam.visible = false;
  const L0 = new THREE.Vector3(-11.4, -16, FZ + 0.05), G = new THREE.Vector3(-20, FLOOR_Y + 0.05, 44);
  const beamLen = L0.distanceTo(G), beamQ = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), G.clone().sub(L0).normalize());
  [[0.16, 0.95], [0.6, 0.18]].forEach(([r, o]) => {
    const b = mesh(new THREE.CylinderGeometry(r, r, beamLen, 10),
      new THREE.MeshBasicMaterial({ color: 0x4ade80, transparent: true, opacity: o, depthWrite: false }), null, beam);
    b.position.copy(L0).lerp(G, 0.5); b.quaternion.copy(beamQ);
  });
  const ground = new THREE.Group(); ground.position.copy(G); ground.rotation.x = -Math.PI / 2; beam.add(ground);
  const green = (o = 1) => new THREE.MeshBasicMaterial({ color: 0x4ade80, transparent: true, opacity: o, side: THREE.DoubleSide, depthWrite: false });
  mesh(new THREE.ShapeGeometry(rrShape(24, 14, 1.8)), green(0.1), [0, 0, 0], ground);
  ground.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(rrShape(24, 14, 1.8).getPoints(6)), new THREE.LineBasicMaterial({ color: 0x4ade80 })));
  mesh(new THREE.CircleGeometry(1.8, 24), green(0.3), [0, 0, 0.02], ground);
  mesh(new THREE.CircleGeometry(0.9, 20), green(), [0, 0, 0.03], ground);
  const arrow = new THREE.Shape();
  arrow.moveTo(0, 0); arrow.lineTo(1.6, 3.4); arrow.lineTo(0.5, 3.1); arrow.lineTo(0.5, 6.5); arrow.lineTo(-0.5, 6.5); arrow.lineTo(-0.5, 3.1); arrow.lineTo(-1.6, 3.4); arrow.closePath();
  const arr = mesh(new THREE.ShapeGeometry(arrow), green(), [5, -4.5, 0.03], ground);
  arr.rotation.z = -Math.PI * 0.75;
  root.add(beam);

  // 下マイク ×2
  const mics = [frontMic(-8.4, -16, root), frontMic(8.4, -16, root)];

  // スピーカー（前面下中央）
  const spk = new THREE.Group();
  mesh(new THREE.ShapeGeometry(rrShape(7.3, 3.9, 1.95), 8), std(0x0d141b, { roughness: 0.7 }), null, spk);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++)
    mesh(new THREE.CircleGeometry(0.28, 12), std(0x2a3744), [-2.1 + i * 1.4, 0.65 - j * 1.3, 0.01], spk);
  spk.position.set(0, -16, FZ + 0.03); root.add(spk);

  // 上マイク（上面）
  const top = new THREE.Group();
  mesh(new THREE.CircleGeometry(2.4, 40), alu(0xb4bcc2), null, top);
  mesh(new THREE.TorusGeometry(2.4, 0.16, 8, 40), alu(0x8b949b), null, top);
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++)
    mesh(new THREE.CircleGeometry(0.3, 12), std(0x0b0f12), [i * 1.1, j * 1.1, 0.01], top);
  top.rotation.x = -Math.PI / 2; top.position.set(8.6, H / 2 + 0.02, 0); root.add(top);

  // 側面ボタン ×3（アルミに色を差す）
  const btn = (y, h, color) => mesh(new RoundedBoxGeometry(1.6, h, 5, 2, 0.5), alu(color), [W / 2, y, 0], root);
  const yes = btn(9.0, 3.6, 0x86efac), no = btn(3.4, 3.6, 0xfca5a5), talk = btn(-6.6, 6.2, 0xaab3ba);

  // ---- ネックレス型ストラップ（全体表示のときだけ） ----
  const strap = new THREE.Group(); strap.visible = false; root.add(strap);
  const strapMat = () => std(0xdfe4e8, { roughness: 0.38, metalness: 0.35 });
  const curve = new THREE.CatmullRomCurve3([
    [-13, 21.2, 0], [-17.5, 38, -3], [-16, 60, -15], [0, 71, -26], [16, 60, -15], [17.5, 38, -3], [13, 21.2, 0],
  ].map(p => new THREE.Vector3(...p)), false, 'centripetal');
  const thin = mesh(new THREE.TubeGeometry(curve, 160, 0.9, 12), strapMat(), null, strap);
  const subPts = []; for (let i = 0; i <= 60; i++) subPts.push(curve.getPoint(0.24 + 0.52 * i / 60));
  const battery = mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(subPts), 100, 2.1, 16), strapMat(), null, strap);
  const eyelets = [-13, 13].map(x => mesh(new THREE.TorusGeometry(1.15, 0.4, 10, 28), alu(0xaeb6bc), [x, H / 2 + 1.0, 0], strap));
  const apex = mesh(new THREE.SphereGeometry(1, 24, 16), strapMat(), null, strap);
  apex.scale.set(4, 2.6, 2.8); apex.position.copy(curve.getPoint(0.5));

  // イヤホン: 左 = ストラップに着いた状態 / 右 = 外した状態
  const bud = (mat) => new THREE.Mesh(new THREE.CapsuleGeometry(1.7, 3.6, 6, 16), mat);
  const up = new THREE.Vector3(0, 1, 0);
  const budL = bud(strapMat());
  budL.position.copy(curve.getPoint(0.17)); budL.quaternion.setFromUnitVectors(up, curve.getTangent(0.17)); strap.add(budL);
  const dock = curve.getPoint(0.8);
  const budRPos = dock.clone().add(new THREE.Vector3(-5, -11, 4));
  const budR = bud(new THREE.MeshPhysicalMaterial({ color: 0xf8fafc, roughness: 0.2, clearcoat: 1 }));
  budR.position.copy(budRPos); budR.rotation.z = -0.35; strap.add(budR);
  const cable = mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
    dock, dock.clone().add(new THREE.Vector3(-1, -5, 2.5)), budRPos.clone().add(new THREE.Vector3(0.8, 2.6, 0)),
  ]), 40, 0.3, 8), std(0x9aa5b1), null, strap);

  return {
    beam, strap, screen,
    groups: [
      { name: '前面', items: [
        { id: 'cam', label: 'カメラ', desc: '前面左上・静止画/動画', color: '#22d3ee', objs: [cam], anchor: [-8.1, 15.3, FZ + 0.5], view: 'front' },
        { id: 'disp', label: 'ディスプレイ', desc: '全面・有機EL想定', color: '#34d399', objs: [disp], anchor: [6, 4, FZ + 0.2], view: 'front' },
        { id: 'laser', label: 'レーザー＋ToF', desc: '点・矢印・枠を投影／ToFで測距', color: '#4ade80', objs: [laser], anchor: [-11.4, -16, FZ + 0.5], view: LASER_VIEW, beam: true },
        { id: 'mics', label: '下マイク×2（相手）', desc: '相手の声を拾う', color: '#38bdf8', objs: mics, anchor: [8.4, -16, FZ + 0.5], view: 'front' },
        { id: 'spk', label: 'スピーカー', desc: '前面下中央', color: '#38bdf8', objs: [spk], anchor: [0, -16, FZ + 0.5], view: 'front' },
      ] },
      { name: '側面', items: [
        { id: 'yes', label: 'ボタン(yes)', desc: '確定', color: '#4ade80', objs: [yes], anchor: [W / 2 + 0.8, 9.0, 0], view: 'side' },
        { id: 'no', label: 'ボタン(no)', desc: '取消', color: '#f87171', objs: [no], anchor: [W / 2 + 0.8, 3.4, 0], view: 'side' },
        { id: 'talk', label: 'ボタン(talk)', desc: '押して話す', color: '#38bdf8', objs: [talk], anchor: [W / 2 + 0.8, -6.6, 0], view: 'side' },
      ] },
      { name: '上面', items: [
        { id: 'mic-top', label: '上マイク（自分）', desc: '自分の声を拾う', color: '#34d399', objs: [top], anchor: [8.6, H / 2 + 0.3, 0], view: 'top' },
      ] },
      { name: 'ストラップ', items: [
        { id: 'strap', label: 'ストラップ', desc: 'ネックレス型', color: '#38bdf8', objs: [thin, ...eyelets], anchor: curve.getPoint(0.1).toArray(), view: 'full', strap: true },
        { id: 'sub', label: '電源(サブ)', desc: 'ストラップ内蔵バッテリー 600mAh', color: '#fbbf24', objs: [battery, apex], anchor: curve.getPoint(0.36).toArray(), view: 'full', strap: true },
        { id: 'ear', label: 'イヤホン', desc: '有線・マグネットで着脱', color: '#38bdf8', objs: [budL, budR, cable], anchor: budRPos.toArray(), view: 'full', strap: true },
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
        <svg class="v3d-lines" aria-hidden="true">
          <line/>
          <circle class="v3d-ping" r="4"><animate attributeName="r" values="4;13" dur="1.4s" repeatCount="indefinite"/><animate attributeName="opacity" values="0.8;0" dur="1.4s" repeatCount="indefinite"/></circle>
          <circle class="v3d-dot" r="3.5"/>
        </svg>
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
  const dotEls = host.querySelectorAll('.v3d-lines circle');
  const hint = host.querySelector('.v3d-hint');

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true });
  } catch (e) {
    stage.innerHTML = '<p class="v3d-fallback">この端末では 3D を表示できません</p>';
    return;
  }
  const DPR = Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(DPR);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.9;
  stage.prepend(renderer.domElement);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.4;
  scene.environmentRotation.set(1.0, 0.6, 0); // 天井の強い照明が上面に真上から映り込んで白飛びしないよう傾ける
  buildStudio(scene);
  const key = new THREE.DirectionalLight(0xfff4e6, 1.1); key.position.set(80, 35, 90); scene.add(key);
  const rim = new THREE.DirectionalLight(0x7dd3fc, 1.0); rim.position.set(-80, 40, -90); scene.add(rim);
  const rim2 = new THREE.DirectionalLight(0x6ee7b7, 0.3); rim2.position.set(90, -10, -60); scene.add(rim2);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x0b1210, 0.35));

  const camera = new THREE.PerspectiveCamera(30, 1, 1, 3000);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.minDistance = 60;
  controls.maxDistance = 420;
  controls.autoRotateSpeed = 0.9;

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  // にじみは発光させた部品（レーザー・LED・選択中）だけに効くよう閾値を高く・弱めに。金属の反射はにじませない
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.3, 0.3, 1.8);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  const root = new THREE.Group(); scene.add(root);
  const model = kind === 'ideal' ? buildIdeal(root) : buildVer3(root);

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
      b.style.setProperty('--c', it.color);
      b.innerHTML = `<i></i>${it.label}`;
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
  let selected = null, viewName = 'angle', tween = null, lastTouch = 0;

  function fitScale() {
    const a = stage.clientWidth / Math.max(1, stage.clientHeight);
    return a < 0.95 ? Math.min(1.7, 0.95 / a) : 1;
  }
  function goTo(v, instant, dur = 750) {
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
      fromT: controls.target.clone(), toT: target, t0: performance.now(), dur,
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
    lastTouch = performance.now();
    if (selected) { resetGlow(selected); selected.btn.classList.remove('is-active'); }
    selected = it;
    stage.classList.toggle('has-selection', !!it);
    if (it) {
      it.btn.classList.add('is-active');
      labelEl.style.setProperty('--c', it.color);
      labelEl.querySelector('b').textContent = it.label;
      labelEl.querySelector('span').textContent = it.desc;
      labelEl.hidden = false;
      labelEl.classList.remove('is-in'); void labelEl.offsetWidth; labelEl.classList.add('is-in');
      viewsEl.querySelectorAll('button').forEach(b => b.classList.remove('is-active'));
      viewName = typeof it.view === 'string' ? it.view : null;
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
  function pick(e) {
    const r = renderer.domElement.getBoundingClientRect();
    ptr.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ptr, camera);
    return ray.intersectObjects(pickables.filter(isShown), false)[0];
  }
  renderer.domElement.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY }; });
  renderer.domElement.addEventListener('pointerup', e => {
    if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) { down = null; return; }
    down = null;
    const hit = pick(e);
    if (hit) select(hit.object.userData.item === selected ? null : hit.object.userData.item);
  });
  renderer.domElement.addEventListener('pointermove', e => {
    if (!e.buttons) stage.classList.toggle('is-over', !!pick(e));
  });
  function isShown(o) { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true; }
  controls.addEventListener('start', () => { tween = null; lastTouch = performance.now(); hideHint(); });
  controls.addEventListener('end', () => { lastTouch = performance.now(); });

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
    if (!selected) { lineEl.style.display = 'none'; dotEls.forEach(c => c.style.display = 'none'); return; }
    const p = toScreen(selected.anchorV, w, h);
    // ラベルは形の外（左右どちらか）に置く。形の画面上の幅は外接箱の 8 隅から取る
    const box = selected.strap ? STRAP_BOX : BODY_BOX;
    let minX = Infinity, maxX = -Infinity;
    box.forEach(v => { const s = toScreen(v, w, h); minX = Math.min(minX, s.x); maxX = Math.max(maxX, s.x); });
    const mid = toScreen(new THREE.Vector3(0, selected.anchorV.y, selected.anchorV.z), w, h);
    const right = p.x - mid.x > 4;
    const lw = labelEl.offsetWidth, lh = labelEl.offsetHeight;
    let lx = right ? maxX + 40 : minX - 40 - lw, ly = p.y - lh / 2;
    lx = Math.max(8, Math.min(w - lw - 8, lx)); ly = Math.max(8, Math.min(h - lh - 56, ly));
    labelEl.style.left = lx + 'px'; labelEl.style.top = ly + 'px';
    lineEl.style.display = ''; dotEls.forEach(c => c.style.display = '');
    lineEl.setAttribute('x1', p.x); lineEl.setAttribute('y1', p.y);
    lineEl.setAttribute('x2', right ? lx : lx + lw); lineEl.setAttribute('y2', ly + lh / 2);
    lineEl.style.stroke = lineEl.style.color = selected.color;
    dotEls.forEach(c => { c.setAttribute('cx', p.x); c.setAttribute('cy', p.y); c.style.fill = selected.color; });
  }

  /* ---- ループ（画面外・タブ非表示の間は止める） ---- */
  let lastW = 0, lastH = 0, onScreen = true, lastScreen = 0;
  new IntersectionObserver(es => { onScreen = es[0].isIntersecting; }).observe(stage);
  const hlColor = new THREE.Color();
  function frame(now) {
    requestAnimationFrame(frame);
    const w = stage.clientWidth, h = stage.clientHeight;
    if (!w || !h || !onScreen) return;
    if (w !== lastW || h !== lastH) {
      const first = !lastW;
      lastW = w; lastH = h;
      renderer.setSize(w, h, false);
      composer.setPixelRatio(DPR); composer.setSize(w, h);
      camera.aspect = w / h; camera.updateProjectionMatrix();
      if (first && selected) {
        goTo(typeof selected.view === 'string' ? VIEWS[selected.view] : selected.view, true);
      } else if (first) {
        // 最初の一回: 少し回り込んだ位置から「斜め」へ滑り込む
        goTo({ dir: [-0.9, 0.15, 1], dist: 190, target: [0, 0, 0] }, true);
        setView('angle');
        if (tween) tween.dur = 1600;
      }
    }
    if (tween) {
      const k = Math.min(1, (now - tween.t0) / tween.dur), e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      const q = new THREE.Quaternion().slerp(tween.q, e);
      const dir = tween.fromDir.clone().applyQuaternion(q);
      controls.target.lerpVectors(tween.fromT, tween.toT, e);
      camera.position.copy(controls.target).add(dir.multiplyScalar(tween.fromLen + (tween.toLen - tween.fromLen) * e));
      if (k >= 1) tween = null;
    }
    // 何も選んでいない・触っていない間はゆっくり回る
    controls.autoRotate = !REDUCED && !selected && !tween && now - lastTouch > 5000;
    controls.update();
    if (selected) {
      hlColor.set(selected.color);
      const s = 0.5 + 0.5 * Math.sin(now / 180);
      selected.meshes.forEach(m => {
        const b = m.userData.base;
        m.material.color.copy(b.c).lerp(hlColor, 0.4 + 0.35 * s);
        m.material.emissive.copy(hlColor); m.material.emissiveIntensity = Math.max(b.i, 0.3 + 0.9 * s);
      });
    }
    if (model.screen && now - lastScreen > 66) { model.screen.draw(now / 1000); lastScreen = now; }
    composer.render();
    updateOverlay(w, h);
  }
  requestAnimationFrame(frame);
}

document.querySelectorAll('.v3d-root').forEach(createViewer);
