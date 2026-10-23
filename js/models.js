// Procedural low-poly dioramas, one per island. Each builder returns
// { group, update(t) }; the group's origin sits on the tile's top face and
// everything stays inside the hex (inradius ≈ 0.86) unless it's meant to
// reach into the sea.
import * as THREE from 'three';

export const C = {
  sand: '#E9DCC0', grass: '#A3C47F', grassDark: '#7FA563', wood: '#A9774B', woodDark: '#7A5233',
  white: '#F6F2EA', grey: '#9AA0A6', greyDark: '#5E646B', water: '#6FB7D6', waterDeep: '#4C97BD',
  orange: '#E8601C', blue: '#2E6FB7', gold: '#C9A227', green: '#5B8C5A', purple: '#7A5C9E',
  red: '#C8463D', skin: '#F1C9A5', glass: '#BFE3F2', dark: '#2B2F33', rock: '#8D8A80', snow: '#FBFAF7',
};
const PALETTE = [C.orange, C.blue, C.gold, C.green, C.purple];

const mats = new Map();
export function mat(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  if (!mats.has(key)) mats.set(key, new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.85, ...opts }));
  return mats.get(key);
}

function mesh(geo, color, opts) {
  const m = new THREE.Mesh(geo, typeof color === 'string' ? mat(color, opts) : color);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}
function at(m, x = 0, y = 0, z = 0) { m.position.set(x, y, z); return m; }

// Primitives are placed by their base (y = bottom), which is how dioramas think.
export function box(w, h, d, color, x = 0, y = 0, z = 0, opts) {
  return at(mesh(new THREE.BoxGeometry(w, h, d), color, opts), x, y + h / 2, z);
}
export function cyl(rt, rb, h, color, x = 0, y = 0, z = 0, seg = 8, opts) {
  return at(mesh(new THREE.CylinderGeometry(rt, rb, h, seg), color, opts), x, y + h / 2, z);
}
export function cone(r, h, color, x = 0, y = 0, z = 0, seg = 6) {
  return at(mesh(new THREE.ConeGeometry(r, h, seg), color), x, y + h / 2, z);
}
function sphere(r, color, x = 0, y = 0, z = 0, detail = 0) {
  return at(mesh(new THREE.IcosahedronGeometry(r, detail), color), x, y, z);
}
// Gable roof: a triangular prism spanning w (x) by d (z).
function roof(w, d, h, color, x = 0, y = 0, z = 0) {
  const s = new THREE.Shape([new THREE.Vector2(-w / 2, 0), new THREE.Vector2(w / 2, 0), new THREE.Vector2(0, h)]);
  const g = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false });
  g.translate(0, 0, -d / 2);
  return at(mesh(g, color), x, y, z);
}
function house(w, h, d, wall, roofColor, x = 0, z = 0, rotY = 0) {
  const g = new THREE.Group();
  g.add(box(w, h, d, wall), roof(w * 1.15, d * 1.1, h * 0.6, roofColor, 0, h, 0));
  g.position.set(x, 0, z);
  g.rotation.y = rotY;
  return g;
}
export function tree(h, x = 0, z = 0, color = C.grassDark) {
  const g = new THREE.Group();
  g.add(cyl(0.015, 0.02, h * 0.3, C.woodDark), cone(h * 0.28, h * 0.8, color, 0, h * 0.25, 0, 6));
  g.position.set(x, 0, z);
  return g;
}
function person(color, x = 0, z = 0) {
  const g = new THREE.Group();
  g.add(cyl(0.022, 0.028, 0.07, color, 0, 0, 0, 6), sphere(0.022, C.skin, 0, 0.095, 0));
  g.position.set(x, 0, z);
  return g;
}

export function rng(seed) {
  return () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
}

function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

const builders = {
  pier() {
    const g = new THREE.Group();
    // planks run west, past the tile edge, out over the sea
    g.add(box(1.25, 0.04, 0.26, C.wood, -0.62, 0.0, 0.18));
    for (let i = 0; i < 6; i++) g.add(cyl(0.025, 0.025, 0.42, C.woodDark, -0.05 - i * 0.24, -0.38, 0.06, 5), cyl(0.025, 0.025, 0.42, C.woodDark, -0.05 - i * 0.24, -0.38, 0.3, 5));
    g.add(house(0.34, 0.22, 0.26, C.white, C.orange, 0.32, -0.25), house(0.28, 0.18, 0.24, '#E7D8BF', C.woodDark, 0.38, 0.2));
    const r = rng(7);
    for (let i = 0; i < 5; i++) g.add(box(0.08, 0.08, 0.08, i % 2 ? C.orange : C.wood, -0.1 - r() * 0.3, 0.04, 0.12 + r() * 0.12));
    g.add(person(C.blue, -0.3, 0.22), person(C.orange, 0.05, 0.05));
    // sailboat moored at the end of the pier
    const boat = new THREE.Group();
    boat.add(box(0.42, 0.08, 0.14, C.white),box(0.42, 0.02, 0.15, C.orange, 0, 0.06, 0));
    boat.add(cyl(0.01, 0.012, 0.5, C.woodDark, 0, 0.08, 0, 5));
    const sailShape = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(0.24, 0), new THREE.Vector2(0, 0.4)]);
    const sail = mesh(new THREE.ShapeGeometry(sailShape), C.white, { side: THREE.DoubleSide });
    sail.position.set(0.01, 0.12, 0);
    const flag = mesh(new THREE.PlaneGeometry(0.1, 0.06), C.orange, { side: THREE.DoubleSide });
    flag.position.set(0.05, 0.56, 0);
    boat.add(sail, flag);
    boat.position.set(-1.05, -0.36, -0.12);
    g.add(boat);
    return { group: g, update(t) { boat.position.y = -0.36 + Math.sin(t * 1.6) * 0.012; boat.rotation.z = Math.sin(t * 1.2) * 0.04; flag.rotation.y = Math.sin(t * 5) * 0.4; } };
  },

  bridge() {
    const g = new THREE.Group();
    // channel under the bridge
    g.add(box(0.24, 0.012, 1.5, C.water, 0, 0, 0));
    // a half torus in the xy-plane: the arch spans x, across the channel
    const arch = mesh(new THREE.TorusGeometry(0.34, 0.035, 6, 18, Math.PI), C.white);
    g.add(arch, box(0.9, 0.035, 0.14, C.white, 0, 0.32, 0), box(0.9, 0.05, 0.01, C.orange, 0, 0.355, 0.07), box(0.9, 0.05, 0.01, C.orange, 0, 0.355, -0.07));
    // nine little platforms, each with a branch on it
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + 0.35;
      const x = Math.cos(a) * 0.64, z = Math.sin(a) * 0.62;
      if (Math.abs(x) < 0.2) continue;
      g.add(cyl(0.12, 0.13, 0.04, C.sand, x, 0, z, 6), house(0.11, 0.09, 0.09, C.white, PALETTE[i % 5], x, z, -a));
    }
    const walkers = [person(C.orange), person(C.blue), person(C.green)];
    walkers.forEach((p) => { p.scale.setScalar(0.8); g.add(p); });
    return { group: g, update(t) { walkers.forEach((p, i) => { const u = ((t * 0.12 + i / 3) % 1) * 2 - 1; p.position.set(u * 0.42, 0.34, (i - 1) * 0.03); }); } };
  },

  port() {
    const g = new THREE.Group();
    g.add(box(0.7, 0.015, 0.36, C.water, -0.22, 0, 0.36));
    const r = rng(3);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) {
      const n = 1 + Math.floor(r() * 3);
      for (let k = 0; k < n; k++) g.add(box(0.2, 0.08, 0.09, PALETTE[(i + j + k) % 5], 0.05 + i * 0.12 - 0.12, k * 0.08, -0.45 + j * 0.11));
    }
    // gantry crane
    const crane = new THREE.Group();
    crane.add(box(0.03, 0.55, 0.03, C.orange, -0.18, 0, 0.18), box(0.03, 0.55, 0.03, C.orange, -0.18, 0, -0.08), box(0.03, 0.55, 0.03, C.orange, 0.12, 0, 0.18), box(0.03, 0.55, 0.03, C.orange, 0.12, 0, -0.08));
    crane.add(box(0.36, 0.04, 0.3, C.orange, -0.03, 0.55, 0.05), box(0.6, 0.03, 0.04, C.orange, -0.25, 0.59, 0.05));
    const hook = box(0.18, 0.08, 0.08, C.blue, -0.42, 0.3, 0.05);
    crane.add(hook);
    crane.position.set(-0.05, 0, 0.12);
    g.add(crane);
    // scrolling ticker board — text only, no prices, so nothing reads as a quote
    const tex = canvasTexture(1024, 64, (x, w, h) => {
      x.fillStyle = '#1E2226'; x.fillRect(0, 0, w, h);
      x.font = 'bold 40px "JetBrains Mono", "Noto Sans TC", sans-serif'; x.fillStyle = '#FFB27A'; x.textBaseline = 'middle';
      x.fillText('UNI ISLAND · 證券港 · 金贏島 · 金好探 · e統金 · e起發 · e指發 · 405 · API · ', 8, h / 2);
    });
    tex.wrapS = THREE.RepeatWrapping;
    tex.repeat.set(0.5, 1);
    const board = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.1, 0.02), [mat(C.dark), mat(C.dark), mat(C.dark), mat(C.dark), new THREE.MeshBasicMaterial({ map: tex }), mat(C.dark)]);
    board.position.set(0.3, 0.42, 0.42);
    board.rotation.y = -0.35;
    g.add(board, box(0.02, 0.38, 0.02, C.greyDark, 0.0, 0, 0.52), box(0.02, 0.38, 0.02, C.greyDark, 0.6, 0, 0.32));
    const ship = new THREE.Group();
    ship.add(box(0.36, 0.06, 0.1, C.greyDark), box(0.08, 0.06, 0.08, C.white, -0.12, 0.06, 0), box(0.08, 0.05, 0.08, C.orange, 0.02, 0.06, 0), box(0.08, 0.05, 0.08, C.blue, 0.11, 0.06, 0));
    ship.position.set(-0.25, 0.0, 0.36);
    g.add(ship);
    return { group: g, update(t) { tex.offset.x = (t * 0.05) % 1; hook.position.y = 0.2 + (Math.sin(t * 0.9) * 0.5 + 0.5) * 0.25; ship.position.y = Math.sin(t * 1.4) * 0.006; } };
  },

  kiosk() {
    const g = new THREE.Group();
    g.add(box(0.8, 0.02, 0.6, '#D9D4C8', 0, 0, -0.05));
    g.add(box(0.7, 0.36, 0.5, C.glass, 0, 0.02, -0.05, { transparent: true, opacity: 0.38, roughness: 0.1 }));
    g.add(box(0.74, 0.03, 0.54, C.orange, 0, 0.38, -0.05));
    for (let i = 0; i < 4; i++) {
      g.add(box(0.1, 0.2, 0.08, C.white, -0.24 + i * 0.16, 0.02, -0.2), box(0.08, 0.06, 0.005, PALETTE[i], -0.24 + i * 0.16, 0.14, -0.155, { emissive: PALETTE[i], emissiveIntensity: 0.4 }));
    }
    const queue = [];
    for (let i = 0; i < 4; i++) { const p = person(PALETTE[(i + 1) % 5], 0.0, 0.3 + i * 0.1); g.add(p); queue.push(p); }
    g.add(box(0.012, 0.02, 0.004, C.dark, 0.02, 0.07, 0.29));
    return { group: g, update(t) { queue.forEach((p, i) => { p.position.y = Math.max(0, Math.sin(t * 3 + i * 1.3)) * 0.012; }); } };
  },

  vault() {
    const g = new THREE.Group();
    for (let i = 0; i < 4; i++) g.add(house(0.2, 0.2, 0.22, i % 2 ? C.white : '#EADFCB', i % 2 ? C.green : C.woodDark, -0.45 + i * 0.21, 0.28));
    const safe = new THREE.Group();
    safe.add(box(0.46, 0.4, 0.36, C.greyDark));
    const door = at(mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.03, 12), C.grey), 0, 0.2, 0.19);
    door.rotation.x = Math.PI / 2;
    const wheel = at(mesh(new THREE.TorusGeometry(0.06, 0.012, 4, 8), C.gold), 0, 0.2, 0.21);
    safe.add(door, wheel);
    safe.position.set(0.25, 0, -0.2);
    g.add(safe);
    // balance scale on a post
    const scale = new THREE.Group();
    const beam = box(0.4, 0.02, 0.02, C.gold, 0, 0, 0);
    const panL = cyl(0.06, 0.04, 0.02, C.gold, -0.19, -0.08, 0, 8);
    const panR = cyl(0.06, 0.04, 0.02, C.gold, 0.19, -0.08, 0, 8);
    scale.add(beam, panL, panR);
    scale.position.set(-0.32, 0.5, -0.22);
    g.add(cyl(0.015, 0.02, 0.5, C.woodDark, -0.32, 0, -0.22, 5), scale);
    return { group: g, update(t) { scale.rotation.z = Math.sin(t * 0.8) * 0.12; wheel.rotation.z = t * 0.4; } };
  },

  lighthouse() {
    const g = new THREE.Group();
    const rocks = rng(11);
    for (let i = 0; i < 6; i++) g.add(sphere(0.12 + rocks() * 0.1, C.rock, (rocks() - 0.5) * 0.9, 0.02, (rocks() - 0.5) * 0.9));
    for (let i = 0; i < 5; i++) g.add(cyl(0.16 - (i + 1) * 0.015, 0.16 - i * 0.015, 0.16, i % 2 ? C.orange : C.white, 0, i * 0.16, 0, 10));
    g.add(cyl(0.11, 0.11, 0.025, C.dark, 0, 0.8, 0, 10));
    g.add(cyl(0.08, 0.08, 0.12, C.glass, 0, 0.825, 0, 10, { emissive: '#FFE8A3', emissiveIntensity: 0.9 }));
    g.add(cone(0.11, 0.1, C.orange, 0, 0.945, 0, 10));
    // time marks carved on the tower
    for (let i = 0; i < 4; i++) g.add(box(0.005, 0.01, 0.06, C.dark, 0.0, 0.1 + i * 0.18, 0.15));
    const beamGeo = new THREE.ConeGeometry(0.22, 1.8, 16, 1, true);
    beamGeo.translate(0, -0.9, 0);
    beamGeo.rotateZ(Math.PI / 2);
    const beam = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ color: '#FFE9A8', transparent: true, opacity: 0.14, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
    beam.position.y = 0.88;
    g.add(beam);
    return { group: g, update(t) { beam.rotation.y = t * 0.8; } };
  },

  park() {
    const g = new THREE.Group();
    // ferris wheel
    const wheel = new THREE.Group();
    wheel.add(mesh(new THREE.TorusGeometry(0.3, 0.012, 4, 24), C.white));
    const gondolas = [];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const spoke = box(0.006, 0.3, 0.006, C.white, 0, 0, 0);
      spoke.geometry.translate(0, -0.15, 0);
      spoke.position.set(0, 0, 0);
      spoke.rotation.z = a;
      wheel.add(spoke);
      const gd = box(0.05, 0.05, 0.05, PALETTE[i % 5]);
      gd.position.set(Math.cos(a) * 0.3, Math.sin(a) * 0.3, 0);
      wheel.add(gd);
      gondolas.push([gd, a]);
    }
    wheel.position.set(-0.3, 0.42, -0.25);
    g.add(wheel);
    for (const s of [-1, 1]) { const leg = box(0.02, 0.48, 0.02, C.greyDark, 0, 0, 0); leg.position.set(-0.3 + s * 0.12, 0.2, -0.25); leg.rotation.z = s * 0.25; g.add(leg); }
    // carousel
    const carousel = new THREE.Group();
    carousel.add(cyl(0.18, 0.18, 0.03, C.white, 0, 0, 0, 12), cyl(0.015, 0.015, 0.18, C.gold, 0, 0.03, 0, 6), cone(0.21, 0.1, C.orange, 0, 0.2, 0, 12));
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; carousel.add(box(0.04, 0.04, 0.06, PALETTE[i % 5], Math.cos(a) * 0.13, 0.06, Math.sin(a) * 0.13)); }
    carousel.position.set(0.3, 0, -0.18);
    g.add(carousel);
    // roller coaster loop
    const pts = [];
    for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(a) * 0.45, 0.12 + (Math.sin(a * 2) * 0.5 + 0.5) * 0.18, 0.25 + Math.sin(a) * 0.22)); }
    const curve = new THREE.CatmullRomCurve3(pts, true);
    g.add(mesh(new THREE.TubeGeometry(curve, 80, 0.012, 4, true), C.blue));
    for (let i = 0; i < 12; i += 2) g.add(box(0.012, pts[i].y, 0.012, C.greyDark, pts[i].x, 0, pts[i].z));
    const cars = [0, 1, 2].map((i) => { const c = box(0.06, 0.035, 0.04, PALETTE[i]); c.geometry.translate(0, -0.0175, 0); g.add(c); return c; });
    const v = new THREE.Vector3();
    return { group: g, update(t) {
      wheel.rotation.z = t * 0.3;
      gondolas.forEach(([gd]) => { gd.rotation.z = -wheel.rotation.z; });
      carousel.rotation.y = t * 0.6;
      cars.forEach((c, i) => { const u = ((t * 0.08 - i * 0.025) % 1 + 1) % 1; curve.getPointAt(u, v); c.position.copy(v); c.position.y += 0.035; curve.getPointAt((u + 0.01) % 1, v); c.lookAt(v.x, c.position.y, v.z); });
    } };
  },

  river() {
    const g = new THREE.Group();
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.1, 0, -0.9), new THREE.Vector3(-0.3, 0, -0.4), new THREE.Vector3(0.15, 0, 0.05), new THREE.Vector3(-0.05, 0, 0.5), new THREE.Vector3(0.1, 0, 0.95),
    ]);
    const shape = curve.getSpacedPoints(40);
    const pos = [];
    const up = new THREE.Vector3(0, 1, 0), side = new THREE.Vector3(), tan = new THREE.Vector3();
    shape.forEach((p, i) => { curve.getTangentAt(i / 40, tan); side.crossVectors(up, tan).normalize().multiplyScalar(0.14); pos.push(p.x + side.x, 0.012, p.z + side.z, p.x - side.x, 0.012, p.z - side.z); });
    const idx = [];
    for (let i = 0; i < 40; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const water = new THREE.Mesh(geo, mat(C.water, { side: THREE.DoubleSide, roughness: 0.3 }));
    water.receiveShadow = true;
    g.add(water);
    // lock gates
    for (const u of [0.32, 0.7]) {
      const p = curve.getPointAt(u); curve.getTangentAt(u, tan);
      const gate = box(0.34, 0.08, 0.03, C.woodDark, 0, 0, 0);
      gate.position.set(p.x, 0.0, p.z); gate.rotation.y = Math.atan2(tan.x, tan.z) + Math.PI / 2;
      g.add(gate);
    }
    const r = rng(5);
    for (let i = 0; i < 7; i++) { const a = r() * Math.PI * 2, d = 0.5 + r() * 0.25; const x = Math.cos(a) * d, z = Math.sin(a) * d; if (Math.abs(x - 0) > 0.28) g.add(tree(0.22 + r() * 0.1, x, z)); }
    const boats = [0, 1].map((i) => {
      const b = new THREE.Group();
      b.add(box(0.16, 0.03, 0.08, C.wood));
      const scroll = at(mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.07, 8), C.white), 0, 0.05, 0);
      scroll.rotation.x = Math.PI / 2;
      b.add(scroll);
      g.add(b);
      return b;
    });
    const p = new THREE.Vector3();
    return { group: g, update(t) {
      boats.forEach((b, i) => { const u = ((t * 0.035 + i * 0.5) % 1) * 0.9 + 0.05; curve.getPointAt(u, p); b.position.set(p.x, 0.015, p.z); curve.getTangentAt(u, tan); b.rotation.y = Math.atan2(tan.x, tan.z) + Math.PI / 2; });
    } };
  },

  airport() {
    const g = new THREE.Group();
    const runway = new THREE.Group();
    runway.add(box(1.3, 0.012, 0.22, '#4A4F55'));
    for (let i = 0; i < 7; i++) runway.add(box(0.08, 0.013, 0.015, C.white, -0.54 + i * 0.18, 0, 0));
    runway.rotation.y = 0.3;
    runway.position.set(0, 0, 0.28);
    g.add(runway);
    g.add(box(0.5, 0.16, 0.2, C.white, -0.15, 0, -0.35), box(0.5, 0.05, 0.005, C.glass, -0.15, 0.08, -0.248, { roughness: 0.1 }), box(0.54, 0.02, 0.24, C.orange, -0.15, 0.16, -0.35));
    g.add(cyl(0.035, 0.04, 0.36, C.white, 0.28, 0, -0.38, 8), cyl(0.08, 0.06, 0.07, C.glass, 0.28, 0.36, -0.38, 8), cyl(0.085, 0.085, 0.015, C.orange, 0.28, 0.43, -0.38, 8));
    const board = canvasTexture(256, 128, (x, w, h) => {
      x.fillStyle = '#1E2226'; x.fillRect(0, 0, w, h);
      x.font = 'bold 26px "JetBrains Mono", "Noto Sans TC", sans-serif'; x.fillStyle = '#FFD27A';
      ['紐約', '香港', '上海', '東京'].forEach((s, i) => x.fillText(s, 12, 28 + i * 28));
    });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.1), new THREE.MeshBasicMaterial({ map: board }));
    sign.position.set(-0.15, 0.3, -0.24);
    g.add(sign, box(0.01, 0.14, 0.01, C.greyDark, -0.15, 0.16, -0.25));
    const plane = new THREE.Group();
    const body = mesh(new THREE.CylinderGeometry(0.025, 0.02, 0.24, 8), C.white);
    body.rotation.z = Math.PI / 2;
    plane.add(body, box(0.06, 0.008, 0.26, C.white), box(0.03, 0.06, 0.008, C.orange, -0.11, 0.0, 0), box(0.03, 0.006, 0.09, C.white, -0.11, 0.0, 0));
    g.add(plane);
    return { group: g, update(t) {
      const u = (t * 0.09) % 1;
      const x = -0.6 + u * 1.9;
      const lift = Math.max(0, u - 0.35) * 1.6;
      const lx = x * Math.cos(0.3), lz = -x * Math.sin(0.3);
      plane.position.set(lx, 0.04 + lift * lift, 0.28 + lz);
      plane.rotation.set(0, 0.3, Math.min(0.3, lift * 0.8));
      plane.visible = u < 0.92;
    } };
  },

  manor() {
    const g = new THREE.Group();
    g.add(box(0.46, 0.24, 0.3, C.white, -0.15, 0, -0.25), roof(0.54, 0.34, 0.16, C.orange, -0.15, 0.24, -0.25), box(0.05, 0.12, 0.05, C.woodDark, 0.0, 0.3, -0.3));
    g.add(box(0.1, 0.13, 0.01, C.woodDark, -0.15, 0, -0.095));
    // hedges around a garden
    g.add(box(0.9, 0.06, 0.04, C.grassDark, 0, 0, 0.55), box(0.04, 0.06, 0.5, C.grassDark, -0.45, 0, 0.3), box(0.04, 0.06, 0.5, C.grassDark, 0.45, 0, 0.3));
    // five trees, each a year taller
    for (let i = 0; i < 5; i++) g.add(tree(0.12 + i * 0.08, -0.32 + i * 0.16, 0.25, i % 2 ? C.grassDark : C.green));
    const gardener = person(C.gold, 0.3, 0.1);
    g.add(gardener, box(0.02, 0.03, 0.02, C.blue, 0.33, 0.06, 0.1));
    return { group: g, update(t) { gardener.position.x = -0.3 + (Math.sin(t * 0.25) * 0.5 + 0.5) * 0.6; gardener.position.z = 0.42; } };
  },

  umbrella() {
    const g = new THREE.Group();
    g.add(house(0.3, 0.2, 0.26, C.white, C.woodDark, 0, 0));
    g.add(cyl(0.012, 0.012, 0.42, C.woodDark, 0.0, 0.2, 0, 5));
    const canopy = new THREE.Group();
    for (let i = 0; i < 8; i++) {
      const seg = mesh(new THREE.ConeGeometry(0.42, 0.16, 8, 1, true, (i / 8) * Math.PI * 2, Math.PI / 4), i % 2 ? C.orange : C.white, { side: THREE.DoubleSide });
      seg.position.y = 0.62;
      canopy.add(seg);
    }
    g.add(canopy);
    // rain, only outside the umbrella's shadow
    const n = 80, r = rng(2);
    const pos = new Float32Array(n * 3), seeds = [];
    for (let i = 0; i < n; i++) { const a = r() * Math.PI * 2, d = 0.46 + r() * 0.34; seeds.push([Math.cos(a) * d, Math.sin(a) * d, r()]); }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const rain = new THREE.Points(geo, new THREE.PointsMaterial({ color: '#7FB8D8', size: 0.025 }));
    g.add(rain);
    return { group: g, update(t) {
      seeds.forEach(([x, z, o], i) => { pos[i * 3] = x; pos[i * 3 + 1] = 0.9 - ((t * 0.7 + o) % 1) * 0.9; pos[i * 3 + 2] = z; });
      geo.attributes.position.needsUpdate = true;
    } };
  },

  tower() {
    const g = new THREE.Group();
    g.add(cone(0.75, 0.28, C.grass, 0, 0, 0, 7));
    g.add(cyl(0.11, 0.16, 0.9, '#EFE7D8', 0, 0.2, 0, 8));
    for (let i = 0; i < 4; i++) g.add(cyl(0.142 - i * 0.012, 0.142 - i * 0.012, 0.03, C.purple, 0, 0.36 + i * 0.18, 0, 8));
    g.add(cyl(0.18, 0.18, 0.04, C.greyDark, 0, 1.1, 0, 8));
    const scope = new THREE.Group();
    const tube = mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.22, 8), C.gold);
    tube.rotation.z = Math.PI / 2.6;
    tube.position.set(0.05, 0.06, 0);
    scope.add(tube, cyl(0.01, 0.01, 0.06, C.dark, 0, 0, 0, 5));
    scope.position.set(0.04, 1.14, 0.04);
    g.add(scope, cyl(0.004, 0.008, 0.32, C.dark, -0.1, 1.14, -0.06, 4));
    const blink = sphere(0.022, C.red, -0.1, 1.47, -0.06);
    blink.material = new THREE.MeshStandardMaterial({ color: C.red, emissive: C.red, emissiveIntensity: 1 });
    g.add(blink);
    return { group: g, update(t) { scope.rotation.y = Math.sin(t * 0.3) * 1.2; blink.material.emissiveIntensity = Math.sin(t * 4) > 0.6 ? 1.6 : 0.1; } };
  },

  postoffice() {
    const g = new THREE.Group();
    g.add(box(0.62, 0.04, 0.4, C.white, 0, 0, -0.18), box(0.56, 0.04, 0.36, C.white, 0, 0.04, -0.18));
    g.add(box(0.5, 0.26, 0.24, '#EFE7D8', 0, 0.08, -0.24));
    for (let i = 0; i < 4; i++) g.add(cyl(0.022, 0.022, 0.26, C.white, -0.18 + i * 0.12, 0.08, -0.07, 8));
    g.add(box(0.54, 0.04, 0.3, C.white, 0, 0.34, -0.2), roof(0.54, 0.3, 0.12, C.orange, 0, 0.38, -0.2));
    const boxes = [];
    for (let i = 0; i < 5; i++) {
      const a = Math.PI * 0.15 + (i / 4) * Math.PI * 0.7;
      const x = Math.cos(a) * 0.55, z = 0.1 + Math.sin(a) * 0.45;
      g.add(cyl(0.008, 0.008, 0.12, C.greyDark, x, 0, z, 4), box(0.07, 0.06, 0.05, PALETTE[i], x, 0.12, z));
      boxes.push(new THREE.Vector3(x, 0, z));
    }
    const postman = person(C.blue);
    g.add(postman, box(0.03, 0.03, 0.01, C.white, 0, 0, 0));
    return { group: g, update(t) {
      const u = (t * 0.12) % 1, k = u * (boxes.length - 1), i = Math.floor(k), f = k - i;
      const a = boxes[i], b = boxes[Math.min(i + 1, boxes.length - 1)];
      postman.position.set(a.x + (b.x - a.x) * f, 0, a.z + (b.z - a.z) * f - 0.06);
    } };
  },

  forest() {
    const g = new THREE.Group();
    const r = rng(19);
    for (let i = 0; i < 26; i++) {
      const a = r() * Math.PI * 2, d = 0.3 + r() * 0.52;
      g.add(tree(0.2 + r() * 0.22, Math.cos(a) * d, Math.sin(a) * d * 0.95, r() > 0.5 ? C.grassDark : C.green));
    }
    // the big tree and a small gathering under it
    g.add(cyl(0.05, 0.07, 0.32, C.woodDark, 0, 0, 0, 7));
    g.add(sphere(0.24, C.green, 0, 0.42, 0, 0), sphere(0.17, C.grassDark, 0.12, 0.56, 0.05, 0), sphere(0.15, C.green, -0.1, 0.6, -0.06, 0));
    for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; g.add(person(PALETTE[i], Math.cos(a) * 0.17, Math.sin(a) * 0.17)); }
    // shield-shaped anti-fraud sign
    const s = new THREE.Shape();
    s.moveTo(-0.07, 0.08); s.lineTo(0.07, 0.08); s.lineTo(0.07, 0.0); s.quadraticCurveTo(0.06, -0.06, 0, -0.09); s.quadraticCurveTo(-0.06, -0.06, -0.07, 0.0); s.closePath();
    const shield = at(mesh(new THREE.ExtrudeGeometry(s, { depth: 0.015, bevelEnabled: false }), C.orange), 0.42, 0.24, 0.32);
    shield.rotation.y = -0.6;
    g.add(cyl(0.008, 0.008, 0.22, C.woodDark, 0.42, 0, 0.32, 4), shield);
    return { group: g, update(t) { shield.rotation.y = -0.6 + Math.sin(t * 0.7) * 0.15; } };
  },
};

export function buildModel(key) {
  const b = builders[key];
  if (!b) return { group: new THREE.Group(), update() {} };
  return b();
}
