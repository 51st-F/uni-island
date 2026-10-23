import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { buildModel, mat, cone, tree, rng, C } from './models.js';

const SQ3 = Math.sqrt(3);
const NEIGHBORS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, -1], [-1, 1]];
const key = (q, r) => `${q},${r}`;
// Pointy-top axial coordinates; rows run north (−z) to south (+z), so −x is west.
export const hexToWorld = (q, r) => new THREE.Vector3(SQ3 * (q + r / 2), 0, 1.5 * r);
const hexX = (q, r) => q + r / 2;
const hexDist = (a, b) => (Math.abs(a[0] - b[0]) + Math.abs(a[0] + a[1] - b[0] - b[1]) + Math.abs(a[1] - b[1])) / 2;

const ISLAND_H = 0.34;
const LABEL_Y = { tower: 1.75, lighthouse: 1.2, park: 0.95 };
const GRASSY = new Set(['forest', 'tower', 'manor', 'river', 'park', 'umbrella', 'bridge']);
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

function hexRing(inner, outer, color) {
  const g = new THREE.RingGeometry(inner, outer, 6, 1, Math.PI / 2);
  g.rotateX(-Math.PI / 2);
  return new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false }));
}

function tile(h, top, side) {
  const g = new THREE.CylinderGeometry(0.97, 1.0, h, 6);
  const m = new THREE.Mesh(g, [mat(side), mat(top), mat(side)]);
  m.position.y = h / 2;
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

// Fill the gaps around the islands with sea, beach, grassland and an eastern range.
function terrain(islands) {
  const taken = new Set(islands.map((i) => key(...i.hex)));
  const cells = new Map();
  for (const i of islands) {
    for (let dq = -2; dq <= 2; dq++) for (let dr = -2; dr <= 2; dr++) {
      const c = [i.hex[0] + dq, i.hex[1] + dr];
      const d = hexDist(c, i.hex);
      const k = key(...c);
      if (d === 0 || taken.has(k) || cells.has(k)) continue;
      const x = hexX(...c);
      if (d === 1 || (d === 2 && x >= 2)) cells.set(k, c);
    }
  }
  const out = [];
  for (const c of cells.values()) {
    const x = hexX(...c);
    const n = rng((c[0] * 73856093) ^ (c[1] * 19349663))();
    if (x < -1.6) continue; // the western sea
    if (x >= 2.2) out.push({ hex: c, type: 'mountain', n });
    else if (x < -0.9 || c[1] >= 2) { if (c[1] < 2 || n > 0.35) out.push({ hex: c, type: 'beach', n }); }
    else if (n < 0.18) continue; // a few bays keep the coastline ragged
    else out.push({ hex: c, type: 'grass', n });
  }
  return out;
}

export function createWorld(container, data, { onPick, onHover } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  const labelRenderer = new CSS2DRenderer();
  labelRenderer.domElement.className = 'label-layer';
  container.appendChild(labelRenderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#CFE6EE');
  scene.fog = new THREE.Fog('#CFE6EE', 16, 34);

  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.maxPolarAngle = 1.2;
  controls.minDistance = 2.5;
  controls.maxDistance = 22;
  controls.screenSpacePanning = false;

  scene.add(new THREE.HemisphereLight('#FFF6E8', '#6F8F9C', 1.4));
  const sun = new THREE.DirectionalLight('#FFF1DC', 2.2);
  sun.position.set(5, 9, 4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 1, far: 30 });
  sun.shadow.bias = -0.0008;
  scene.add(sun, sun.target);

  const sea = new THREE.Mesh(new THREE.CircleGeometry(40, 48), new THREE.MeshStandardMaterial({ color: '#7DC2DC', roughness: 0.35 }));
  sea.rotation.x = -Math.PI / 2;
  sea.receiveShadow = true;
  scene.add(sea);

  const world = new THREE.Group();
  scene.add(world);

  // filler terrain
  for (const t of terrain(data.islands)) {
    const p = hexToWorld(...t.hex);
    const r = rng(Math.floor(t.n * 1e9));
    if (t.type === 'mountain') {
      const h = 0.5 + t.n * 0.35;
      const m = tile(h, C.grassDark, C.rock);
      m.position.set(p.x, h / 2, p.z);
      world.add(m);
      const peak = new THREE.Group();
      const ph = 0.7 + r() * 0.7;
      peak.add(cone(0.75, ph, C.rock, 0, 0, 0, 6), cone(0.28, ph * 0.36, C.snow, 0, ph * 0.64, 0, 6));
      if (r() > 0.4) peak.add(cone(0.45, ph * 0.6, '#9C978B', 0.45, 0, 0.3, 5));
      peak.position.set(p.x, h, p.z);
      peak.rotation.y = r() * 6;
      world.add(peak);
    } else if (t.type === 'beach') {
      const m = tile(0.16, C.sand, '#D8C8A6');
      m.position.set(p.x, 0.08, p.z);
      world.add(m);
    } else {
      const m = tile(0.28, C.grass, '#C7B48C');
      m.position.set(p.x, 0.14, p.z);
      world.add(m);
      const n = 1 + Math.floor(r() * 4);
      for (let i = 0; i < n; i++) { const tr = tree(0.2 + r() * 0.18, p.x + (r() - 0.5) * 1.1, p.z + (r() - 0.5) * 1.1); tr.position.y = 0.28; world.add(tr); }
    }
  }

  // islands
  const catColor = Object.fromEntries(data.categories.map((c) => [c.id, c.color]));
  const nodes = new Map();
  const pickables = [];
  for (const isl of data.islands) {
    const p = hexToWorld(...isl.hex);
    const g = new THREE.Group();
    g.position.copy(p);
    const t = tile(ISLAND_H, GRASSY.has(isl.model) ? C.grass : '#E6DAC0', catColor[isl.category]);
    t.userData.id = isl.id;
    g.add(t);
    const model = buildModel(isl.model);
    model.group.position.y = ISLAND_H;
    g.add(model.group);
    const hoverRing = hexRing(0.9, 1.0, '#FFFFFF');
    const selRing = hexRing(0.86, 1.04, '#E8601C');
    hoverRing.position.y = selRing.position.y = ISLAND_H + 0.012;
    g.add(hoverRing, selRing);

    const el = document.createElement('button');
    el.className = 'label';
    el.type = 'button';
    el.dataset.id = isl.id;
    el.style.setProperty('--cat', catColor[isl.category]);
    el.addEventListener('click', (e) => { e.stopPropagation(); onPick?.(isl.id); });
    const label = new CSS2DObject(el);
    label.position.set(0, ISLAND_H + (LABEL_Y[isl.model] ?? 0.82), 0);
    g.add(label);

    model.group.traverse((o) => { if (o.isMesh) o.userData.id = isl.id; });
    pickables.push(t, model.group);
    world.add(g);
    nodes.set(isl.id, { isl, group: g, model, hoverRing, selRing, label, el, lift: 0, pos: p });
  }

  // investor paths
  const edges = data.edges.map((e) => {
    const a = nodes.get(e.a).pos, b = nodes.get(e.b).pos;
    const d = a.distanceTo(b);
    const mid = a.clone().add(b).multiplyScalar(0.5);
    mid.y = ISLAND_H + 0.5 + d * 0.22;
    const curve = new THREE.QuadraticBezierCurve3(a.clone().setY(ISLAND_H + 0.15), mid, b.clone().setY(ISLAND_H + 0.15));
    const history = e.kind === 'history';
    const material = new THREE.MeshBasicMaterial({ color: history ? '#7A5C9E' : '#E8601C', transparent: true, opacity: 0.55, depthWrite: false });
    const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 40, history ? 0.012 : 0.018, 5, false), material);
    const dot = new THREE.Mesh(new THREE.IcosahedronGeometry(0.045, 1), new THREE.MeshBasicMaterial({ color: '#FFFFFF', transparent: true }));
    world.add(tube, dot);
    return { e, curve, tube, dot, material, phase: Math.random() };
  });

  // trail drawn during the tour, step by step
  const trailGroup = new THREE.Group();
  world.add(trailGroup);

  // camera
  const box3 = new THREE.Box3();
  nodes.forEach((n) => box3.expandByPoint(n.pos));
  const center = box3.getCenter(new THREE.Vector3());
  const homeOffset = new THREE.Vector3(1.2, 8.2, 9.6);
  camera.position.copy(center).add(homeOffset);
  controls.target.copy(center);
  sun.target.position.copy(center);
  sun.position.copy(center).add(new THREE.Vector3(5, 9, 4));

  let tween = null;
  function flyTo(target, position, dur = 1.2) {
    if (reduceMotion) { controls.target.copy(target); camera.position.copy(position); return; }
    tween = { t0: performance.now(), dur: dur * 1000, fromT: controls.target.clone(), fromP: camera.position.clone(), toT: target.clone(), toP: position.clone() };
  }
  function narrowScreen() { return container.clientWidth < 720; }
  function islandView(id) {
    const n = nodes.get(id);
    const target = n.pos.clone().setY(0.4);
    // shift the focus so the island isn't hidden behind the side panel / bottom sheet
    if (narrowScreen()) target.z += 0.9; else target.x += 0.9;
    return [target, target.clone().add(new THREE.Vector3(0.7, 4.0, 5.4))];
  }

  // picking
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let hovered = null, selected = null, related = null, pointerDirty = false, lastPointer = null, edgesOn = true;
  function pick(ev) {
    const r = renderer.domElement.getBoundingClientRect();
    ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(pickables, true)[0];
    return hit ? hit.object.userData.id ?? null : null;
  }
  renderer.domElement.addEventListener('pointermove', (ev) => { lastPointer = ev; pointerDirty = true; });
  renderer.domElement.addEventListener('pointerleave', () => { lastPointer = null; pointerDirty = true; });
  let down = null;
  renderer.domElement.addEventListener('pointerdown', (ev) => { down = [ev.clientX, ev.clientY]; tween = null; });
  renderer.domElement.addEventListener('pointerup', (ev) => {
    if (!down || Math.hypot(ev.clientX - down[0], ev.clientY - down[1]) > 6) return;
    onPick?.(pick(ev));
  });

  function refreshEmphasis() {
    nodes.forEach((n, id) => {
      const dim = related && !related.has(id);
      n.el.classList.toggle('dim', !!dim);
      n.el.classList.toggle('on', id === selected);
    });
    edges.forEach((ed) => {
      const on = selected && (ed.e.a === selected || ed.e.b === selected);
      ed.material.opacity = selected ? (on ? 0.95 : 0.08) : 0.5;
      ed.dot.visible = edgesOn && (!selected || on);
    });
  }

  // resize
  function resize() {
    const w = container.clientWidth, h = container.clientHeight;
    renderer.setSize(w, h);
    labelRenderer.setSize(w, h);
    camera.aspect = w / h;
    // pull back on portrait screens so the whole island fits
    camera.fov = w < h ? 50 : 34;
    camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(container);
  resize();

  const clock = new THREE.Clock();
  let raf = 0;
  function frame() {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime * (reduceMotion ? 0.3 : 1);

    if (tween) {
      const u = Math.min(1, (performance.now() - tween.t0) / tween.dur), k = ease(u);
      controls.target.lerpVectors(tween.fromT, tween.toT, k);
      camera.position.lerpVectors(tween.fromP, tween.toP, k);
      if (u >= 1) tween = null;
    }
    controls.update();

    if (pointerDirty) {
      pointerDirty = false;
      const id = lastPointer ? pick(lastPointer) : null;
      if (id !== hovered) { hovered = id; renderer.domElement.style.cursor = id ? 'pointer' : ''; onHover?.(id); }
    }

    nodes.forEach((n, id) => {
      const want = id === selected ? 0.12 : id === hovered ? 0.06 : 0;
      n.lift += (want - n.lift) * Math.min(1, dt * 10);
      n.group.position.y = n.lift;
      n.hoverRing.material.opacity += ((id === hovered && id !== selected ? 0.8 : 0) - n.hoverRing.material.opacity) * Math.min(1, dt * 12);
      n.selRing.material.opacity = id === selected ? 0.75 + Math.sin(t * 4) * 0.25 : 0;
      n.model.update(t);
    });
    edges.forEach((ed) => {
      const u = (t * 0.25 + ed.phase) % 2;
      ed.curve.getPoint(u < 1 ? u : 2 - u, ed.dot.position);
    });

    renderer.render(scene, camera);
    labelRenderer.render(scene, camera);
  }
  frame();

  return {
    select(id, { fly = true } = {}) {
      selected = id;
      related = null;
      if (id) {
        related = new Set([id]);
        data.edges.forEach((e) => { if (e.a === id) related.add(e.b); if (e.b === id) related.add(e.a); });
        if (fly) flyTo(...islandView(id));
      }
      refreshEmphasis();
    },
    home() { flyTo(center, center.clone().add(homeOffset), 1.4); },
    setLabels(on) { labelRenderer.domElement.classList.toggle('hidden', !on); },
    setEdges(on) { edgesOn = on; edges.forEach((ed) => { ed.tube.visible = on; }); refreshEmphasis(); },
    setLabelText(fn) { nodes.forEach((n) => { n.el.innerHTML = fn(n.isl); }); },
    setTrail(ids) {
      trailGroup.clear();
      for (let i = 1; i < ids.length; i++) {
        const a = nodes.get(ids[i - 1]).pos, b = nodes.get(ids[i]).pos;
        const mid = a.clone().add(b).multiplyScalar(0.5);
        mid.y = ISLAND_H + 0.35 + a.distanceTo(b) * 0.18;
        const curve = new THREE.QuadraticBezierCurve3(a.clone().setY(ISLAND_H + 0.1), mid, b.clone().setY(ISLAND_H + 0.1));
        trailGroup.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 32, 0.03, 6, false), new THREE.MeshBasicMaterial({ color: i === ids.length - 1 ? '#E8601C' : '#F3A778' })));
      }
    },
    dispose() { cancelAnimationFrame(raf); ro.disconnect(); renderer.dispose(); container.innerHTML = ''; },
  };
}
