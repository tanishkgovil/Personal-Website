import * as THREE from './vendor/three/three.module.min.js';
import { createFoyerLayout, canWalkFoyer } from './foyer-layout.mjs';

// The foyer has its own scene and lights. The approved auditorium is independent.
export async function createCinemaFoyer(screenings) {
  const layout = createFoyerLayout(screenings), scene = new THREE.Scene();
  scene.background = new THREE.Color('#c7af8a');
  scene.fog = new THREE.Fog('#c7af8a', 38, 95);
  const textures = [], posters = [], gates = [];
  let hoveredSlug;
  const materials = {
    plaster: new THREE.MeshStandardMaterial({ color: '#e1d1ad', roughness: .9 }),
    ceiling: new THREE.MeshStandardMaterial({ color: '#eee4cc', roughness: .85 }),
    wood: new THREE.MeshStandardMaterial({ color: '#653d2c', roughness: .65 }),
    brass: new THREE.MeshStandardMaterial({ color: '#bb9457', metalness: .5, roughness: .34 }),
    velvet: new THREE.MeshStandardMaterial({ color: '#8b3540', roughness: .95 }),
    dark: new THREE.MeshStandardMaterial({ color: '#221b19', roughness: .8 }),
    light: new THREE.MeshBasicMaterial({ color: '#fff0ca', toneMapped: false }),
    leaf: new THREE.MeshStandardMaterial({ color: '#3e6148', roughness: .9 }),
  };
  const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
  function box(w, h, d, mat, x, y, z, parent = scene) {
    const mesh = new THREE.Mesh(boxGeometry, mat); mesh.scale.set(w, h, d); mesh.position.set(x, y, z); parent.add(mesh); return mesh;
  }
  function cylinder(r, h, mat, x, y, z, parent = scene) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 16), mat); mesh.position.set(x, y, z); parent.add(mesh); return mesh;
  }
  function texture(w, h, paint) {
    const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h; paint(canvas.getContext('2d'), w, h);
    const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace; textures.push(map); return map;
  }
  function sign(value, w, h, x, y, z, size = 105, color = '#f8e5b4') {
    const map = texture(Math.round(256 * w / h), 256, (ctx, width) => { ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `${size}px Georgia, serif`; ctx.fillStyle = color; ctx.fillText(value, width / 2, 132, width - 40); });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false, toneMapped: false })); mesh.position.set(x, y, z); scene.add(mesh); return mesh;
  }
  function point(x, z) {
    const light = new THREE.PointLight('#ffe3b3', 65, 27, 2); light.position.set(x, 6.4, z); scene.add(light);
  }
  const posterCue = texture(768, 1080, (ctx, w, h) => {
    ctx.fillStyle = '#fff0c018'; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#fff3d2'; ctx.lineWidth = 12; ctx.strokeRect(6, 6, w - 12, h - 12);
    ctx.beginPath(); ctx.arc(w / 2, h * .44, 112, 0, Math.PI * 2);
    ctx.fillStyle = '#15201fe8'; ctx.fill(); ctx.lineWidth = 4; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(w / 2 - 25, h * .44 - 48); ctx.lineTo(w / 2 + 51, h * .44); ctx.lineTo(w / 2 - 25, h * .44 + 48);
    ctx.closePath(); ctx.fillStyle = '#fff3d2'; ctx.fill();
  });
  scene.add(new THREE.HemisphereLight('#fff5dd', '#a08665', 1.25));
  scene.add(new THREE.AmbientLight('#f6ddbb', .35));

  const width = layout.maxX - layout.minX, middle = (layout.maxX + layout.minX) / 2;
  const floorMap = texture(512, 512, ctx => {
    ctx.fillStyle = '#b5a78b'; ctx.fillRect(0, 0, 512, 512);
    for (let row = 0; row < 4; row++) for (let col = 0; col < 4; col++) {
      ctx.fillStyle = (row + col) % 2 ? '#c7baa0' : '#b6a68a'; ctx.fillRect(col * 128 + 2, row * 128 + 2, 124, 124);
      ctx.fillStyle = '#e4d8bd'; ctx.fillRect(col * 128 + 62, row * 128 + 62, 4, 4);
    }
  });
  floorMap.wrapS = floorMap.wrapT = THREE.RepeatWrapping; floorMap.repeat.set(width / 5, 4.3);
  box(width, .12, 21, new THREE.MeshStandardMaterial({ map: floorMap, roughness: .48, metalness: .08 }), middle, -.06, 3.5);
  box(width, .18, 22, materials.ceiling, middle, 8, 3);
  for (const x of [layout.minX, layout.maxX]) {
    box(.22, 8, 22, materials.plaster, x, 4, 3);
    box(.26, 1.1, 22, materials.wood, x, .55, 3);
    box(.29, .055, 22, materials.brass, x, 1.13, 3);
    box(.5, .25, 22, materials.wood, x, 7.8, 3);
  }
  // Coffered ceiling and long frosted light panels make the whole room welcoming.
  for (let x = layout.minX + 2.3; x < layout.maxX; x += 5) {
    box(.16, .25, 21.8, materials.plaster, x, 7.8, 3);
    for (const z of [-1.8, 7.6]) {
      box(2.7, .08, 5.2, materials.brass, x, 7.8, z);
      box(2.58, .09, 5.08, materials.light, x, 7.73, z);
    }
  }
  for (let x = layout.minX + 4; x < layout.maxX; x += 9) for (const z of [-2, 7]) point(x, z);

  // Frosted street-facing glazing belongs to the cinema, not to a screening.
  const street = texture(512, 768, (ctx, w, h) => {
    const sky = ctx.createLinearGradient(0, 0, w, h);
    sky.addColorStop(0, '#c5d2d4'); sky.addColorStop(.5, '#819699'); sky.addColorStop(1, '#526669');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);
    const reflection = ctx.createLinearGradient(0, 0, w, 0);
    reflection.addColorStop(0, '#f5ede333'); reflection.addColorStop(.25, '#f5ede300'); reflection.addColorStop(.75, '#f5ede300'); reflection.addColorStop(1, '#f5ede344');
    ctx.fillStyle = reflection; ctx.fillRect(0, 0, w, h);
  });
  const glass = new THREE.MeshBasicMaterial({ map: street, toneMapped: false });
  box(width, 8, .2, materials.plaster, middle, 4, 14);
  for (let x = layout.minX + 3.1; x < layout.maxX - 1; x += 5.2) {
    const window = new THREE.Mesh(new THREE.PlaneGeometry(4.7, 5.5), glass); window.position.set(x, 3.9, 13.82); window.rotation.y = Math.PI; scene.add(window);
    for (const side of [-1, 1]) box(.12, 5.65, .18, materials.brass, x + side * 2.4, 3.9, 13.75);
    box(4.9, .12, .18, materials.brass, x, 1.1, 13.75); box(4.9, .12, .18, materials.brass, x, 6.7, 13.75);
    box(.07, 5.5, .18, materials.wood, x, 3.9, 13.75); box(4.7, .07, .18, materials.wood, x, 3.9, 13.75);
  }
  // The left wall's windows remain visible from the initial view.
  for (const z of [-2, 4, 10]) {
    const window = new THREE.Mesh(new THREE.PlaneGeometry(4.8, 5.4), glass); window.position.set(layout.minX + .14, 4.1, z); window.rotation.y = Math.PI / 2; scene.add(window);
    for (const end of [-1, 1]) box(.18, 5.55, .1, materials.brass, layout.minX + .18, 4.1, z + end * 2.45);
    box(.18, .1, 5, materials.brass, layout.minX + .18, 1.38, z); box(.18, .07, 4.8, materials.wood, layout.minX + .18, 4.1, z); box(.18, 5.4, .07, materials.wood, layout.minX + .18, 4.1, z);
  }

  // A lit marquee and three real entrance bays; only published stories are active.
  box(width, 2.7, .35, materials.wood, middle, 6.25, -6.9);
  box(width - .4, .06, .45, materials.brass, middle, 4.94, -6.68);
  box(width - .4, .06, .45, materials.brass, middle, 7.54, -6.68);
  sign('C I N E M A', 12, 1.25, -.5, 6.45, -6.66, 160);
  sign('Tanishk Govil', 4.5, .7, -.5, 5.55, -6.64, 180);
  const bulbGeometry = new THREE.SphereGeometry(.055, 8, 6);
  const bulbCount = Math.floor((width - 1) / .42) * 2, bulbs = new THREE.InstancedMesh(bulbGeometry, materials.light, bulbCount), stamp = new THREE.Object3D();
  let bulb = 0;
  for (const y of [5.03, 7.43]) for (let x = layout.minX + .5; x < layout.maxX - .5 && bulb < bulbCount; x += .42) { stamp.position.set(x, y, -6.62); stamp.updateMatrix(); bulbs.setMatrixAt(bulb++, stamp.matrix); }
  bulbs.count = bulb; scene.add(bulbs);
  for (const bay of layout.bays) {
    const entry = bay.screening;
    // Front wall segments leave a doorway at the correct entrance for each film.
    box(7.2, 4.9, .2, materials.plaster, bay.doorX - 4.9, 2.45, -7);
    box(7.2, 4.9, .2, materials.plaster, bay.doorX + 4.9, 2.45, -7);
    box(2.55, 1.3, .2, materials.plaster, bay.doorX, 4.25, -7);
    for (const side of [-1, 1]) box(.18, 3.55, .4, materials.wood, bay.doorX + side * 1.26, 1.78, -6.83);
    box(2.7, .14, .44, materials.brass, bay.doorX, 3.55, -6.82);
    sign(bay.number, 1.2, .5, bay.doorX, 4.05, -6.72, 170, '#76573b');
    // Open vestibules connect directly to the physical auditorium corridors.
    for (const side of [-1, 1]) box(.15, 3.55, 2.8, materials.dark, bay.doorX + side * 1.27, 1.78, -8.3);
    box(2.7, .15, 2.8, materials.dark, bay.doorX, 3.6, -8.3);
    if (!entry) box(2.7, 3.6, .1, materials.dark, bay.doorX, 1.8, -9.6);
    const leaves = [];
    for (const side of [-1, 1]) {
      const hinge = new THREE.Group(); hinge.position.set(bay.doorX + side * 1.17, 0, -6.84); scene.add(hinge);
      const leaf = box(1.16, 3.35, .14, materials.velvet, -side * .58, 1.68, 0, hinge);
      if (entry) leaf.userData = { action: 'enter', slug: entry.slug };
      box(.055, .6, .09, materials.brass, -side * .99, 1.5, .13, hinge);
      box(.035, 3.1, .035, materials.brass, -side * .58, 1.68, .09, hinge); leaves.push({ hinge, side });
    }
    gates.push({ slug: entry?.slug, leaves, open: false });
    let source;
    if (entry?.posterImage) { source = new Image(); source.src = entry.posterImage; await source.decode(); }
    const map = texture(768, 1080, (ctx, w, h) => {
      ctx.fillStyle = entry ? '#263d3a' : '#ded1af'; ctx.fillRect(0, 0, w, h);
      if (source) { const scale = Math.max(w / source.naturalWidth, h / source.naturalHeight); ctx.drawImage(source, (w - source.naturalWidth * scale) / 2, (h - source.naturalHeight * scale) / 2, source.naturalWidth * scale, source.naturalHeight * scale); }
      if (entry) {
        const fade = ctx.createLinearGradient(0, 350, 0, 1080); fade.addColorStop(0, '#07121b00'); fade.addColorStop(1, '#07121bf0'); ctx.fillStyle = fade; ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#f6e8c9'; ctx.font = '98px Georgia, serif'; const lines = (entry.posterTitle || entry.title).split('\n');
        lines.forEach((line, index) => ctx.fillText(line, 55, 815 - (lines.length - 1 - index) * 108, 658));
        ctx.font = '32px Arial, sans-serif'; ctx.fillText(entry.posterSubtitle || '', 58, 893, 650);
        ctx.font = '23px Arial, sans-serif'; const seconds = Math.floor(entry.duration || 0); ctx.fillText(`Tanishk Govil${seconds ? ` · ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}` : ''}`, 58, 1000);
      } else {
        ctx.strokeStyle = '#ad946c'; ctx.lineWidth = 2; ctx.strokeRect(35, 35, w - 70, h - 70); ctx.fillStyle = '#866c49'; ctx.textAlign = 'center'; ctx.font = '210px Georgia, serif'; ctx.fillText(bay.number, w / 2, 520); ctx.font = '38px Georgia, serif'; ctx.fillText('Coming soon', w / 2, 660);
      }
    });
    const poster = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 2.95), new THREE.MeshBasicMaterial({ map, toneMapped: false })); poster.position.set(bay.posterX, 2.65, -6.72); scene.add(poster);
    box(2.29, 3.14, .14, materials.wood, bay.posterX, 2.65, -6.84);
    for (const side of [-1, 1]) { box(.035, 3.03, .05, materials.light, bay.posterX + side * 1.09, 2.65, -6.69); box(2.21, .035, .05, materials.light, bay.posterX, 2.65 + side * 1.51, -6.69); }
    if (entry) {
      poster.userData = { action: 'enter', slug: entry.slug };
      const cue = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 2.95), new THREE.MeshBasicMaterial({ map: posterCue, transparent: true, toneMapped: false, depthWrite: false }));
      cue.position.copy(poster.position); cue.position.z += .065; cue.visible = false;
      cue.userData = poster.userData; scene.add(cue); posters.push({ mesh: poster, entry, cue });
    }
    box(4.3, .018, 4.5, materials.velvet, bay.doorX, .014, -4.45);
    for (const side of [-1, 1]) box(.045, .02, 4.5, materials.brass, bay.doorX + side * 2.12, .026, -4.45);
  }

  // Ticket/concession counter, velvet seating, and greenery give it a public scale.
  const desk = layout.desk, deskX = (desk.minX + desk.maxX) / 2, deskZ = (desk.minZ + desk.maxZ) / 2;
  box(desk.maxX - desk.minX, 1.03, 1.5, materials.wood, deskX, .515, deskZ);
  box(desk.maxX - desk.minX + .14, .12, 1.7, materials.plaster, deskX, 1.09, deskZ);
  for (let x = desk.minX + .3; x < desk.maxX; x += .38) box(.035, .85, .045, materials.brass, x, .53, deskZ + .77);
  box(3.9, .85, .12, materials.plaster, deskX, 2.8, deskZ + .7);
  for (const side of [-1, 1]) box(.045, 1.7, .045, materials.brass, deskX + side * 1.8, 1.95, deskZ + .7);
  sign('T I C K E T S', 3.6, .6, deskX, 2.8, deskZ + .8, 110, '#76573b');
  for (const x of [deskX - 1.4, deskX + 1.4]) {
    cylinder(.26, .5, materials.velvet, x, 1.39, deskZ);
    cylinder(.27, .04, materials.brass, x, 1.65, deskZ);
    const popcorn = new THREE.InstancedMesh(new THREE.SphereGeometry(.055, 7, 5), materials.light, 24);
    for (let i = 0; i < 24; i++) { stamp.position.set(x + Math.cos(i * 2.4) * .18 * (i % 4) / 3, 1.68 + (i % 3) * .035, deskZ + Math.sin(i * 2.4) * .18); stamp.updateMatrix(); popcorn.setMatrixAt(i, stamp.matrix); } scene.add(popcorn);
  }
  box(.65, .5, .09, materials.dark, deskX, 1.45, deskZ - .25); box(.12, .35, .12, materials.brass, deskX, 1.2, deskZ - .25);
  for (const bench of layout.benches) {
    const x = (bench.minX + bench.maxX) / 2, z = (bench.minZ + bench.maxZ) / 2;
    box(1.1, .25, 4, materials.wood, x, .4, z); box(1.13, .2, 4, materials.velvet, x, .6, z); box(.15, .9, 4, materials.velvet, x - .5, .95, z);
  }
  const leafGeometry = new THREE.SphereGeometry(1, 7, 5);
  for (const [x, z] of [[-12.8, -4.1], [-12.8, 7], [layout.maxX - .8, -3], [layout.maxX - .8, 10.5]]) {
    cylinder(.35, .65, materials.brass, x, .325, z);
    for (let i = 0; i < 7; i++) { const leaf = new THREE.Mesh(leafGeometry, materials.leaf); leaf.scale.set(.13, .8 + (i % 3) * .12, .3); leaf.position.set(x + Math.cos(i) * .2, 1.1 + (i % 3) * .1, z + Math.sin(i) * .2); leaf.rotation.set(Math.sin(i) * .25, i, Math.cos(i) * .3); scene.add(leaf); }
  }

  return {
    scene, layout,
    bay: slug => layout.bays.find(bay => bay.screening?.slug === slug) || layout.bays.find(bay => bay.screening),
    canWalk: (x, z) => canWalkFoyer(layout, x, z),
    nearDoor: position => layout.bays.find(bay => bay.screening && Math.abs(position.x - bay.doorX) < 1.02 && position.z < -5.8),
    hover(slug) {
      if (slug === hoveredSlug) return;
      hoveredSlug = slug;
      posters.forEach(({ entry, cue }) => { cue.visible = entry.slug === slug; });
    },
    spawn(portrait = false) { return portrait ? { x: -7.4, y: 1.72, z: 6.4, target: [-9.4, 2.7, -6.8] } : { x: 0, y: 1.72, z: 10.8, target: [-4, 3, -6.8] }; },
    open(slug) { gates.forEach(gate => { gate.open = gate.slug === slug; }); },
    close({ instant = false } = {}) { gates.forEach(gate => { gate.open = false; if (instant) gate.leaves.forEach(({ hinge }) => { hinge.rotation.y = 0; }); }); },
    update(delta) { for (const gate of gates) for (const { hinge, side } of gate.leaves) hinge.rotation.y += ((gate.open ? side * Math.PI * .46 : 0) - hinge.rotation.y) * Math.min(1, delta * 5); },
    posterRects(camera, canvas) {
      const direction = camera.getWorldDirection(new THREE.Vector3());
      return posters.flatMap(({ mesh, entry }) => {
        const center = mesh.getWorldPosition(new THREE.Vector3()); if (center.sub(camera.position).dot(direction) < 0) return [];
        const corners = [[-1.05,-1.475],[1.05,-1.475],[1.05,1.475],[-1.05,1.475]].map(([x,y]) => mesh.localToWorld(new THREE.Vector3(x,y,0)).project(camera));
        if (corners.some(p => p.z < -1 || p.z > 1)) return [];
        const xs = corners.map(p => (p.x * .5 + .5) * canvas.clientWidth), ys = corners.map(p => (-p.y * .5 + .5) * canvas.clientHeight);
        return [{ slug: entry.slug, left: Math.min(...xs), top: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) }];
      });
    },
    dispose() {
      textures.forEach(map => map.dispose()); const geometries = new Set(), mats = new Set(); scene.traverse(object => { if (object.geometry) geometries.add(object.geometry); if (object.material) mats.add(object.material); }); geometries.forEach(geo => geo.dispose()); mats.forEach(mat => mat.dispose());
    },
  };
}
