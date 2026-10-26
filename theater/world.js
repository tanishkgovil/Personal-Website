import * as THREE from './vendor/three/three.module.min.js';
import { seats, seatRows, zoneAt, floorHeight, moveThroughRoom, standPosition } from './navigation.mjs';
import { createCinemaFoyer } from './foyer.js';
import { foyerWalkSpeed, canWalkCinema } from './foyer-layout.mjs';

const ease = (t) => t * t * (3 - 2 * t);
const clamp = THREE.MathUtils.clamp;

export async function createCinemaWorld(canvas, { posterImage, posterTitle = 'Now screening', posterSubtitle = '', duration, screenings = [], selected, onEnter, onScreenInteract = () => {}, onNavigationChange = () => {}, onLookChange = () => {}, onHintDismiss = () => {} }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, matchMedia('(pointer: coarse)').matches ? 1.3 : 1.6));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2('#0d1013', .012);
  const camera = new THREE.PerspectiveCamera(54, 1, .08, 85);
  camera.position.set(-1.2, 1.7, 4.8);
  camera.rotation.order = 'YXZ';
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2();
  const keys = new Set(), disposable = [];
  let mode = 'lobby', yaw = -.1, pitch = .025, pointerState, hovered;
  let travel, curtainMotion, house = 1, targetHouse = 1, joystick = { x: 0, y: 0 };
  let projection, filmTexture, entering = false, journey = 0;
  let inputEnabled = true, lastSeat, lastNavigation = '', ignoreLockedMove = false;
  let activeSlug = selected || screenings[0]?.slug || 'screening', roomX = 0;
  const inFoyer = () => camera.position.z > -6.6;
  const currentZone = () => zoneAt(camera.position.z);
  const navigable = () => inputEnabled && ['lobby', 'walking', 'seated'].includes(mode);
  function notifyNavigation() {
    const zone = currentZone(), key = `${mode}:${zone}:${lastSeat ?? ''}`;
    if (key === lastNavigation) return;
    lastNavigation = key; onNavigationChange({ mode, zone, seat: lastSeat, row: lastSeat === undefined ? undefined : seats[lastSeat].row + 1 });
  }
  const materials = {
    wall: new THREE.MeshStandardMaterial({ color: '#344438', roughness: .92 }),
    wood: new THREE.MeshStandardMaterial({ color: '#3f2119', roughness: .62 }),
    dark: new THREE.MeshStandardMaterial({ color: '#11161b', roughness: .9 }),
    brass: new THREE.MeshStandardMaterial({ color: '#b68b4c', metalness: .5, roughness: .4 }),
    red: new THREE.MeshStandardMaterial({ color: '#591e2b', roughness: .92 }),
    black: new THREE.MeshStandardMaterial({ color: '#090c10', roughness: .75 }),
    glow: new THREE.MeshBasicMaterial({ color: '#ffce86', toneMapped: false }),
  };
  function box(w, h, d, material, x, y, z, parent = scene) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
  }
  function cylinder(radius, height, material, x, y, z, parent = scene) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, 12), material);
    mesh.position.set(x, y, z); parent.add(mesh); return mesh;
  }
  function canvasTexture(width, height, paint) {
    const element = document.createElement('canvas'); element.width = width; element.height = height;
    paint(element.getContext('2d'), width, height);
    const texture = new THREE.CanvasTexture(element); texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy()); disposable.push(texture); return texture;
  }
  function sign(text, width, height, x, y, z, fontSize = 80, color = '#d3b779') {
    const texture = canvasTexture(1024, 256, (ctx) => {
      ctx.clearRect(0, 0, 1024, 256); ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = `${fontSize}px Georgia, serif`; ctx.fillText(text, 512, 128);
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({ map: texture, transparent: true, toneMapped: false, depthWrite: false }));
    mesh.position.set(x, y, z); scene.add(mesh); return mesh;
  }
  function point(color, intensity, x, y, z, distance = 13) {
    const light = new THREE.PointLight(color, intensity, distance, 2); light.position.set(x, y, z); scene.add(light); return light;
  }

  const hemi = new THREE.HemisphereLight('#f1dbc0', '#191c22', 1.15); scene.add(hemi);
  const fill = new THREE.DirectionalLight('#f1e0c8', .6); fill.position.set(-3, 7, 4); scene.add(fill); scene.add(fill.target);
  fill.castShadow = true; fill.shadow.mapSize.set(1024, 1024);
  Object.assign(fill.shadow.camera, { left: -12, right: 12, top: 10, bottom: -10, near: .5, far: 45 });
  fill.shadow.bias = -.00015; fill.shadow.normalBias = .04;
  const ceilingLights = [];

  // The auditorium corridor meets the foyer doors in the same world coordinates.
  for (const side of [-1, 1]) box(.15, 5.5, 2.2, materials.dark, side * 1.4, 2.75, -8.2);
  box(2.8, .12, 2.4, materials.dark, 0, -.06, -8.1);

  // Auditorium with real geometry, a center aisle, and instanced upholstered seats.
  box(14, .15, 19.5, materials.dark, 0, -.08, -18);
  box(14, .15, 19.5, materials.black, 0, 7.2, -18);
  for (const x of [-4.2, 4.2]) box(5.8, 7.2, .2, materials.dark, x, 3.6, -9.4);
  box(2.6, 4, .2, materials.dark, 0, 5.2, -9.4);
  for (let step = 0; step < 3; step++) {
    const height = (step + 1) * .2;
    box(14, height, .44, materials.dark, 0, height / 2, -9.52 - step * .44);
  }
  const insideExit = sign('LOBBY', 1.15, .3, 0, 3.55, -9.55, 88); insideExit.rotation.y = Math.PI;
  for (const side of [-1, 1]) {
    box(.2, 7.2, 19.5, materials.dark, side * 7, 3.6, -18);
    for (let z = -11; z > -26; z -= 2.6) {
      box(.12, 4.5, 2.2, materials.red, side * 6.85, 3.6, z);
      box(.15, .035, 2.22, materials.brass, side * 6.77, 1.33, z);
    }
    for (const z of [-12, -17.5, -23]) {
      const bulb = cylinder(.035, .64, materials.glow, side * 6.68, 2.8, z);
      bulb.rotation.z = 0;
    }
  }
  box(14, 7.2, .2, materials.black, 0, 3.6, -27.7);
  for (let z = -10; z > -27; z -= 3) box(14, .12, .16, materials.wood, 0, 7.04, z);
  for (const z of [-12, -19, -24]) ceilingLights.push(point('#ffcf98', 58, 0, 6.7, z, 13));
  const screenLight = point('#e5e5d8', 15, 0, 3.7, -24.4, 16);

  function upholstered(w, h, d, radius) {
    const shape = new THREE.Shape(), x = -w / 2, y = -h / 2;
    shape.moveTo(x + radius, y); shape.lineTo(x + w - radius, y); shape.quadraticCurveTo(x + w, y, x + w, y + radius);
    shape.lineTo(x + w, y + h - radius); shape.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    shape.lineTo(x + radius, y + h); shape.quadraticCurveTo(x, y + h, x, y + h - radius);
    shape.lineTo(x, y + radius); shape.quadraticCurveTo(x, y, x + radius, y);
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: d, bevelEnabled: true, bevelSize: .025, bevelThickness: .025, bevelSegments: 2, steps: 1, curveSegments: 5 });
    geometry.translate(0, 0, -d / 2); return geometry;
  }
  const count = seats.length, back = new THREE.InstancedMesh(upholstered(.68, .9, .14, .12), materials.red, count);
  const cushion = new THREE.InstancedMesh(new THREE.BoxGeometry(.67, .15, .63), materials.red, count);
  const arms = new THREE.InstancedMesh(new THREE.BoxGeometry(.09, .13, .67), materials.wood, count * 2);
  const bases = new THREE.InstancedMesh(new THREE.BoxGeometry(.4, .36, .38), materials.black, count);
  const object = new THREE.Object3D();
  for (const { z, level } of seatRows) {
    box(14, level, 2.15, materials.dark, 0, level / 2, z);
    for (const side of [-1, 1]) box(.08, .025, 1.45, materials.glow, side * .8, level + .025, z);
  }
  for (const { id, x, z, level } of seats) {
    object.position.set(x, level + .94, z + .22); object.rotation.set(-.1, 0, 0); object.updateMatrix(); back.setMatrixAt(id, object.matrix);
    object.position.set(x, level + .48, z - .03); object.rotation.set(0, 0, 0); object.updateMatrix(); cushion.setMatrixAt(id, object.matrix);
    object.position.set(x, level + .22, z + .05); object.updateMatrix(); bases.setMatrixAt(id, object.matrix);
    for (const arm of [-1, 1]) { object.position.set(x + arm * .4, level + .68, z); object.updateMatrix(); arms.setMatrixAt(id * 2 + (arm + 1) / 2, object.matrix); }
  }
  for (const mesh of [back, cushion, arms, bases]) { mesh.castShadow = true; mesh.receiveShadow = true; scene.add(mesh); }
  for (const mesh of [back, cushion, arms]) { mesh.userData.action = 'seat'; mesh.userData.seatDivisor = mesh === arms ? 2 : 1; }

  // A 16:9 physical screen and two pleated curtain panels.
  box(11.5, 6.54, .17, materials.wood, 0, 3.8, -26.76);
  const projectionMaterial = new THREE.MeshBasicMaterial({ color: '#d1c5a5', toneMapped: false });
  projection = new THREE.Mesh(new THREE.PlaneGeometry(11.2, 6.3), projectionMaterial);
  projection.position.set(0, 3.8, -26.64); scene.add(projection);
  projection.userData.action = 'screen';
  const curtainMaterial = new THREE.MeshStandardMaterial({ color: '#661d30', roughness: .98, side: THREE.DoubleSide });
  const curtains = [];
  for (const side of [-1, 1]) {
    const group = new THREE.Group(); group.position.set(side * 5.7, 3.8, -26.37); scene.add(group);
    const geometry = new THREE.PlaneGeometry(5.75, 6.45, 100, 2), positions = geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) positions.setZ(i, .09 * Math.sin(positions.getX(i) * 15) + .025 * Math.sin(positions.getX(i) * 31));
    geometry.computeVertexNormals();
    const panel = new THREE.Mesh(geometry, curtainMaterial); panel.position.x = -side * 2.875; group.add(panel); curtains.push(group);
  }
  box(12, .45, .3, materials.red, 0, 7.05, -26.35);
  for (const side of [-1, 1]) {
    box(.2, 1.04, .13, materials.brass, side * 6.25, 3.8, -26.34);
    cylinder(.04, .74, materials.glow, side * 6.25, 3.8, -26.22);
    point('#ffc478', 8, side * 6.25, 3.8, -25.9, 4);
  }
  let curtainOpen = 0;

  const foyer = await createCinemaFoyer(screenings.length ? screenings : [{ slug: activeSlug, title: posterTitle, posterImage, posterTitle, posterSubtitle, duration }]);
  // Share camera coordinates and depth across the two lighting environments.
  // There is one real doorway, with no scene swap or position remapping at it.
  function selectScreening(slug) {
    const bay = foyer.bay(slug);
    if (bay.screening.slug !== activeSlug) {
      foyer.close({ instant: true });
      foyer.hover(undefined);
      curtains.forEach(group => { group.scale.x = 1; }); curtainOpen = 0;
      targetHouse = 1;
    }
    activeSlug = bay.screening.slug; roomX = bay.doorX;
    scene.position.x = roomX;
    hemi.position.x = -roomX; // Hemisphere light directions stay fixed in world space.
    scene.updateMatrixWorld(true); renderer.shadowMap.needsUpdate = true;
  }
  selectScreening(activeSlug);
  function canMove(x, z) {
    return canWalkCinema(foyer.layout, roomX, x, z);
  }
  function resetFoyerCamera() {
    const start = foyer.spawn(camera.aspect < .8); camera.position.set(start.x, start.y, start.z); camera.lookAt(...start.target); syncLook();
  }

  function seatPosition() {
    if (lastSeat !== undefined) {
      const seat = seats[lastSeat];
      return new THREE.Vector3(roomX + seat.x, seat.level + 1.62, seat.z + .08);
    }
    const distance = clamp(11.2 / (.88 * 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect), 9.8, 18.6);
    return new THREE.Vector3(roomX + (camera.aspect < .8 ? 0 : 1.35), camera.aspect < .8 ? 2.55 : 2.2, -26.6 + distance);
  }
  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight; renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.fov = camera.aspect < .8 ? 74 : 54; camera.updateProjectionMatrix();
    if (mode === 'seated') { camera.position.copy(seatPosition()); camera.lookAt(roomX, 3.8, -26.6); }
    else if (inFoyer() && mode === 'lobby') resetFoyerCamera();
  }
  resize(); window.addEventListener('resize', resize);
  function setCamera() { camera.rotation.set(pitch, yaw, 0, 'YXZ'); }
  function syncLook() { const rotation = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ'); yaw = rotation.y; pitch = rotation.x; }
  setCamera();
  function hit(event) {
    const bounds = canvas.getBoundingClientRect();
    if (document.pointerLockElement === canvas) pointer.set(0, 0);
    else pointer.set((event.clientX - bounds.left) / bounds.width * 2 - 1, -((event.clientY - bounds.top) / bounds.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    // Include walls and furniture so a click cannot select a seat through them.
    return raycaster.intersectObjects([...foyer.scene.children, ...scene.children], true)[0];
  }
  function interaction(event) {
    const intersection = hit(event);
    if (!intersection?.object.userData.action) return null;
    const { object, instanceId } = intersection;
    return { action: object.userData.action, slug: object.userData.slug, seat: instanceId === undefined ? undefined : Math.floor(instanceId / (object.userData.seatDivisor ?? 1)) };
  }
  function activate(target) {
    if (!target) return;
    if (target.action === 'seat' && mode !== 'lobby') sit(target.seat);
    else if (target.action === 'screen' && mode !== 'lobby') onScreenInteract();
    else if (['door', 'enter'].includes(target.action) && mode !== 'lobby' && currentZone() !== 'lobby') walkOut();
    else if (target.action === 'enter' || target.action === 'door') onEnter(target.slug || activeSlug);
  }
  const down = (event) => {
    if (!navigable() || event.button !== 0) return;
    if (document.pointerLockElement === canvas) { activate(interaction(event)); return; }
    syncLook();
    pointerState = { id: event.pointerId, x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY, dragged: false };
    canvas.setPointerCapture(event.pointerId);
  };
  const move = (event) => {
    if (!navigable()) return;
    if (document.pointerLockElement === canvas) return;
    if (pointerState?.id === event.pointerId) {
      const dx = event.clientX - pointerState.x, dy = event.clientY - pointerState.y;
      yaw -= dx * .004; pitch = clamp(pitch - dy * .003, -1.1, 1.1); setCamera();
      pointerState.dragged ||= Math.hypot(event.clientX - pointerState.startX, event.clientY - pointerState.startY) > 5;
      pointerState.x = event.clientX; pointerState.y = event.clientY; onHintDismiss();
    } else {
      hovered = interaction(event); canvas.style.cursor = hovered ? 'pointer' : 'grab';
      foyer.hover(hovered?.action === 'enter' ? hovered.slug : undefined);
      canvas.title = hovered?.action === 'seat' ? `Sit in row ${seats[hovered.seat].row + 1}` : hovered?.action === 'screen' ? 'Pause or play the film' : ['door', 'enter'].includes(hovered?.action) && mode !== 'lobby' && !inFoyer() ? 'Walk back to the lobby' : hovered ? `Enter ${foyer.bay(hovered.slug || activeSlug).screening.title}` : '';
    }
  };
  const up = (event) => {
    if (!pointerState || pointerState.id !== event.pointerId) return;
    const clicked = !pointerState.dragged ? interaction(event) : null;
    const wasClick = !pointerState.dragged && event.pointerType === 'mouse';
    pointerState = undefined;
    if (clicked) activate(clicked);
    else if (wasClick) requestMouseLook();
  };
  const keydown = (event) => {
    if (!navigable() || event.defaultPrevented || event.target.closest('input, button, a, dialog')) return;
    const key = event.key.toLowerCase();
    if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
      if (mode === 'seated') stand();
      keys.add(key); event.preventDefault(); onHintDismiss();
    }
    if (key === 'e') {
      activate(interaction({ clientX: canvas.clientWidth / 2, clientY: canvas.clientHeight / 2 }));
    }
  };
  const keyup = (event) => keys.delete(event.key.toLowerCase());
  canvas.addEventListener('pointerdown', down); canvas.addEventListener('pointermove', move); canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', () => { pointerState = undefined; });
  const mouseMove = (event) => {
    if (!navigable() || document.pointerLockElement !== canvas) return;
    // Discard the cursor-warp event some browsers send on capture.
    if (ignoreLockedMove) { ignoreLockedMove = false; return; }
    yaw -= event.movementX * .0025; pitch = clamp(pitch - event.movementY * .0025, -1.1, 1.1); setCamera(); onHintDismiss();
  };
  canvas.addEventListener('mousemove', mouseMove);
  const pointerLockChange = () => { pointerState = undefined; keys.clear(); foyer.hover(undefined); syncLook(); ignoreLockedMove = true; if (!inputEnabled && document.pointerLockElement === canvas) document.exitPointerLock(); onLookChange(document.pointerLockElement === canvas); };
  document.addEventListener('pointerlockchange', pointerLockChange);
  document.addEventListener('keydown', keydown); document.addEventListener('keyup', keyup);
  window.addEventListener('blur', () => { keys.clear(); joystick = { x: 0, y: 0 }; pointerState = undefined; });

  async function requestMouseLook() {
    if (!navigable() || !canvas.requestPointerLock || !matchMedia('(pointer: fine)').matches) return;
    syncLook(); canvas.focus({ preventScroll: true });
    try { await canvas.requestPointerLock(); } catch { /* Drag controls remain available when capture is declined. */ }
  }

  function animateCamera(points, duration, endRotation) {
    return new Promise((resolve) => {
      travel?.resolve();
      const position = camera.position.clone(), rotation = camera.quaternion.clone();
      const curve = new THREE.CatmullRomCurve3([position, ...points]);
      const end = points.at(-1);
      const targetCamera = camera.clone(); targetCamera.position.copy(end); targetCamera.lookAt(roomX, 3.8, -26.6);
      travel = { curve, duration, age: 0, rotation, endRotation: endRotation?.clone() ?? targetCamera.quaternion.clone(), resolve };
    });
  }

  async function enterFromFoyer(end, trip, instant = false) {
    const bay = foyer.bay(activeSlug); foyer.open(activeSlug);
    if (!instant && !reducedMotion.matches) {
      const target = camera.clone(); target.position.set(bay.doorX, 1.72, -8.15); target.lookAt(bay.doorX, 1.72, -12);
      const approach = camera.position.z > 1.8 ? [new THREE.Vector3(camera.position.x, 1.72, 1.8), new THREE.Vector3(bay.doorX, 1.72, 1.8)] : [];
      await animateCamera([...approach, new THREE.Vector3(bay.doorX, 1.72, -5.8), target.position.clone()], 2, target.quaternion);
    }
    if (trip !== journey) return false;
    if (instant || reducedMotion.matches) { camera.position.copy(end); camera.lookAt(roomX, 3.8, -26.6); }
    else await animateCamera([new THREE.Vector3(roomX, 1.8, -10.2), end], 1.4);
    return trip === journey;
  }

  async function sit(index = lastSeat) {
    if (entering || ['standing', 'seating'].includes(mode)) return;
    const trip = ++journey;
    lastSeat = index;
    const fromLobby = inFoyer();
    mode = 'seating'; keys.clear(); joystick = { x: 0, y: 0 }; notifyNavigation();
    const end = seatPosition();
    if (fromLobby) {
      if (!await enterFromFoyer(end, trip)) return;
      mode = 'seated'; syncLook(); notifyNavigation(); return;
    }
    if (reducedMotion.matches) { camera.position.copy(end); camera.lookAt(roomX, 3.8, -26.6); }
    else {
      await animateCamera([new THREE.Vector3((camera.position.x + end.x) / 2, Math.max(camera.position.y, end.y) + .2, (camera.position.z + end.z) / 2), end], .7);
    }
    if (trip !== journey) return;
    mode = 'seated'; syncLook(); notifyNavigation();
  }

  async function stand() {
    if (mode !== 'seated') return;
    const trip = ++journey, destination = standPosition({ x: camera.position.x - roomX, z: camera.position.z }), rotation = camera.quaternion.clone();
    mode = 'standing'; syncLook(); notifyNavigation();
    const end = new THREE.Vector3(roomX + destination.x, destination.y, destination.z);
    if (reducedMotion.matches) camera.position.copy(end);
    else await animateCamera([new THREE.Vector3(roomX + destination.gapX, destination.y, destination.z), end], .55, rotation);
    if (trip !== journey) return;
    mode = 'walking'; syncLook(); notifyNavigation();
  }

  async function walkOut() {
    if (entering || ['standing', 'seating'].includes(mode)) return;
    if (mode === 'seated') await stand();
    if (mode !== 'walking') return;
    const trip = ++journey;
    mode = 'seating'; keys.clear(); notifyNavigation();
    const end = new THREE.Vector3(roomX, 1.7, -5.5), target = camera.clone(); target.position.copy(end); target.lookAt(roomX, 1.7, 1);
    if (reducedMotion.matches) { camera.position.copy(end); camera.quaternion.copy(target.quaternion); }
    else await animateCamera([new THREE.Vector3(roomX, camera.position.y, camera.position.z), new THREE.Vector3(roomX, 2.2, -10.2), end], 2.2, target.quaternion);
    if (trip !== journey) return;
    mode = 'walking'; syncLook(); notifyNavigation();
  }

  return {
    renderer,
    get mode() { return mode; },
    get zone() { return currentZone(); },
    selectScreening,
    get mouseLook() { return document.pointerLockElement === canvas; },
    requestMouseLook,
    releaseMouseLook() { if (document.pointerLockElement === canvas) document.exitPointerLock(); },
    get soundGain() { return inFoyer() ? .12 : mode === 'seated' ? 1 : clamp((-camera.position.z - 5) / 6, .12, 1); },
    stand,
    walkOut,
    watch: () => sit(),
    setInputEnabled(value) { inputEnabled = value; if (!value) { keys.clear(); joystick = { x: 0, y: 0 }; pointerState = undefined; if (document.pointerLockElement === canvas) document.exitPointerLock(); } },
    setJoystick(x, y) { joystick = { x, y }; if (x || y) { if (mode === 'seated') stand(); onHintDismiss(); } },
    setHouseLights(value) { targetHouse = clamp(value, 0, 1); },
    setProjectionCanvas(element) {
      filmTexture?.dispose(); filmTexture = new THREE.CanvasTexture(element); filmTexture.colorSpace = THREE.SRGBColorSpace;
      filmTexture.minFilter = THREE.LinearFilter; filmTexture.magFilter = THREE.LinearFilter; filmTexture.generateMipmaps = false;
      projectionMaterial.map = filmTexture; projectionMaterial.color.set('#ffffff'); projectionMaterial.needsUpdate = true;
    },
    markProjectionDirty() { if (filmTexture) filmTexture.needsUpdate = true; },
    async enter({ instant = false } = {}) {
      if (entering) return; entering = true; mode = 'entering'; keys.clear(); canvas.style.cursor = 'default';
      lastSeat = undefined; notifyNavigation();
      const trip = ++journey;
      foyer.open(activeSlug);
      const seat = seatPosition();
      if (inFoyer()) { if (!await enterFromFoyer(seat, trip, instant)) return; }
      else if (instant || reducedMotion.matches) { camera.position.copy(seat); camera.lookAt(roomX, 3.8, -26.6); }
      else {
        await animateCamera([new THREE.Vector3(roomX, camera.position.y, camera.position.z), seat], 1.4);
      }
      if (trip === journey) { mode = 'seated'; entering = false; syncLook(); notifyNavigation(); }
    },
    openCurtains() {
      targetHouse = .12;
      return new Promise((resolve) => {
        if (reducedMotion.matches) { curtainOpen = 1; curtains.forEach((group) => { group.scale.x = .025; }); resolve(); }
        else curtainMotion = { age: 0, duration: 1.8, resolve };
      });
    },
    lobby() {
      if (document.pointerLockElement === canvas) document.exitPointerLock();
      ++journey;
      foyer.close();
      foyer.hover(undefined);
      mode = 'lobby'; entering = false; keys.clear(); travel?.resolve(); travel = undefined;
      lastSeat = undefined; joystick = { x: 0, y: 0 };
      curtainMotion?.resolve(); curtainMotion = undefined; curtainOpen = 0;
      curtains.forEach((group) => { group.scale.x = 1; });
      targetHouse = 1; resetFoyerCamera();
      notifyNavigation();
    },
    posterRect() {
      return inFoyer() && ['lobby', 'walking'].includes(mode) ? foyer.posterRects(camera, canvas).find(rect => rect.slug === activeSlug) : null;
    },
    posterRects() {
      return inFoyer() && ['lobby', 'walking'].includes(mode) ? foyer.posterRects(camera, canvas) : [];
    },
    update(delta, render = true) {
      foyer.update(delta);
      house += (targetHouse - house) * Math.min(1, delta * 2.7);
      hemi.intensity = .45 + house * .7; fill.intensity = .12 + house * .48;
      ceilingLights.forEach((light) => { light.intensity = 58 * house; }); screenLight.intensity = 8 + (1 - house) * 16;
      if (travel) {
        travel.age += delta; const t = ease(Math.min(1, travel.age / travel.duration));
        camera.position.copy(travel.curve.getPoint(t)); camera.quaternion.slerpQuaternions(travel.rotation, travel.endRotation, t);
        if (travel.age >= travel.duration) { const done = travel.resolve; travel = undefined; done(); }
      } else if (inputEnabled && ['lobby', 'walking'].includes(mode)) {
        if (keys.has('arrowleft')) yaw += delta * 1.2; if (keys.has('arrowright')) yaw -= delta * 1.2;
        const forward = Number(keys.has('w') || keys.has('arrowup')) - Number(keys.has('s') || keys.has('arrowdown')) - joystick.y;
        const strafe = Number(keys.has('d')) - Number(keys.has('a')) + joystick.x;
        const length = Math.max(1, Math.hypot(forward, strafe));
        const speed = inFoyer() ? foyerWalkSpeed : 2.7;
        const dx = (-Math.sin(yaw) * forward + Math.cos(yaw) * strafe) / length * delta * speed;
        const dz = (-Math.cos(yaw) * forward - Math.sin(yaw) * strafe) / length * delta * speed;
        const next = moveThroughRoom(camera.position, dx, dz, canMove);
        camera.position.x = next.x; camera.position.z = next.z;
        camera.position.y += (((inFoyer() ? 0 : floorHeight(next.z)) + 1.72) - camera.position.y) * Math.min(1, delta * 8);
        if (mode === 'lobby' && inFoyer() && dz < -.0001 && !entering) { const bay = foyer.nearDoor(camera.position); if (bay) onEnter(bay.screening.slug); }
        setCamera();
      }
      if (curtainMotion) {
        curtainMotion.age += delta; curtainOpen = ease(Math.min(1, curtainMotion.age / curtainMotion.duration));
        curtains.forEach((group) => { group.scale.x = 1 - curtainOpen * .975; });
        if (curtainMotion.age >= curtainMotion.duration) { const done = curtainMotion.resolve; curtainMotion = undefined; done(); }
      }
      if (document.pointerLockElement === canvas && inputEnabled && inFoyer() && ['lobby', 'walking'].includes(mode)) {
        const target = interaction({ clientX: canvas.clientWidth / 2, clientY: canvas.clientHeight / 2 });
        foyer.hover(target?.action === 'enter' ? target.slug : undefined);
      } else if (!inFoyer() || !inputEnabled || !['lobby', 'walking'].includes(mode)) foyer.hover(undefined);
      if (render) {
        renderer.render(foyer.scene, camera);
        renderer.autoClear = false;
        renderer.render(scene, camera);
        renderer.autoClear = true;
      }
      notifyNavigation();
    },
    dispose() {
      if (document.pointerLockElement === canvas) document.exitPointerLock();
      document.removeEventListener('pointerlockchange', pointerLockChange);
      canvas.removeEventListener('mousemove', mouseMove);
      foyer.dispose();
      window.removeEventListener('resize', resize); document.removeEventListener('keydown', keydown); document.removeEventListener('keyup', keyup);
      renderer.dispose(); disposable.forEach((texture) => texture.dispose()); filmTexture?.dispose();
      scene.traverse((object) => { object.geometry?.dispose(); if (object.material) for (const material of Array.isArray(object.material) ? object.material : [object.material]) material.dispose(); });
    },
  };
}
