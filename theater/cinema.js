import { createCinemaWorld } from './world.js';
import { createFilm } from './film-player.js';

const $ = (selector) => document.querySelector(selector);
const canvas = $('#world'), posterTarget = $('#poster-target'), transport = $('#transport');
const help = $('#help-dialog'), program = $('#film-program'), direct = $('#direct-view');
let world, film, filmPromise, mode = 'boot', transition = 0, focused = false, flat = false;
let frameTime = performance.now(), lastHUD = 0, controlsTimer, helpResume = false;
let selected = '', catalog = [], activeEntry, programPage = 0;
let navigation = { mode: 'lobby', zone: 'lobby', seat: undefined };
let lookReleasedAt = -Infinity;
let filmVersion = 0;
const posterTargets = new Map();
const formatTime = (time) => `${Math.floor(time / 60)}:${String(Math.floor(time % 60)).padStart(2, '0')}`;
const playSVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 5 11 7-11 7z"/></svg>';
const pauseSVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14M16 5v14"/></svg>';

function setMode(value) {
  mode = value; document.body.dataset.mode = value;
  const watching = ['playing', 'paused', 'ended'].includes(value);
  $('#back-lobby').hidden = !watching && value !== 'entering';
  $('#sound').hidden = !watching;
  $('#focus-film').hidden = !watching || flat;
  $('#ending').hidden = value !== 'ended';
  transport.hidden = !['playing', 'paused'].includes(value);
  $('#play-pause').innerHTML = value === 'playing' ? pauseSVG : playSVG;
  $('#play-pause').setAttribute('aria-label', value === 'playing' ? 'Pause film' : 'Play film');
  $('#play-pause').title = `${value === 'playing' ? 'Pause' : 'Play'} (Space)`;
  $('#announcement').textContent = value === 'lobby' ? 'Cinema lobby. Click a poster to enter its theater.' : value === 'ended' ? 'The film has finished. Watch again or return to the lobby.' : value === 'playing' ? `${activeEntry.title}. Playing.` : value === 'paused' ? 'Film paused.' : '';
  updateTime();
  syncNavigation();
}
function syncNavigation(value = navigation) {
  navigation = value;
  const moving = ['entering', 'standing', 'seating'].includes(value.mode);
  const seated = flat || value.mode === 'seated';
  document.body.dataset.navigation = moving ? 'moving' : seated ? 'seated' : 'walking';
  const zone = flat && mode !== 'lobby' ? 'auditorium' : value.zone;
  document.body.dataset.zone = zone;
  document.body.dataset.seat = value.seat === undefined ? '' : String(value.seat);
  const watching = ['playing', 'paused', 'ended'].includes(mode);
  $('#roam').hidden = !watching || flat;
  $('#roam').disabled = moving;
  $('#mouse-look').disabled = moving;
  $('#roam').setAttribute('aria-label', seated ? 'Walk around' : 'Take a seat');
  $('#roam').setAttribute('aria-pressed', String(!seated));
  $('#roam').title = `${seated ? 'Walk around' : 'Take a seat'} (R)`;
  $('#back-lobby').hidden = zone === 'lobby' ? mode !== 'entering' : !watching && mode !== 'entering';
  if (value.row && seated) $('#announcement').textContent = `Seated in row ${value.row}. The film continues.`;
}
function showControls() {
  document.body.classList.add('controls-visible');
  clearTimeout(controlsTimer);
  controlsTimer = setTimeout(() => document.body.classList.remove('controls-visible'), 1800);
}
function soundChanged(muted) {
  $('#sound').setAttribute('aria-label', muted ? 'Enable sound' : 'Mute sound');
  $('#sound').setAttribute('aria-pressed', String(!muted));
  $('#sound').title = `${muted ? 'Enable sound' : 'Mute sound'} (M)`;
  $('#sound').innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4z"/>${muted ? '<path d="m16 9 5 6m0-6-5 6"/>' : '<path d="M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>'}</svg>`;
}
function failure(error) {
  console.error(error); $('#boot').hidden = true;
  $('#failure-text').textContent = 'The film couldn’t load. Try again, or explore the screening directly.';
  $('#failure').hidden = false;
}
function setFocused(value) {
  focused = flat || value;
  document.body.classList.toggle('is-focused', focused);
  direct.hidden = !focused;
  $('#focus-film').setAttribute('aria-pressed', String(focused));
  $('#focus-film').setAttribute('aria-label', focused ? 'Return to auditorium' : 'Focus on film');
  world?.setInputEnabled(!focused && !help.open && !program.open);
  $('#mouse-look').hidden = flat || focused || !canvas.requestPointerLock || !matchMedia('(pointer: fine)').matches;
}
function lookChanged(locked) {
  document.body.dataset.look = locked ? 'locked' : 'free';
  $('#mouse-look').setAttribute('aria-pressed', String(locked));
  $('#mouse-look').setAttribute('aria-label', locked ? 'Release mouse' : 'Mouse look');
  if (!locked) lookReleasedAt = performance.now();
  $('#announcement').textContent = locked ? 'Mouse look enabled. Move the mouse to look. Esc releases the cursor.' : 'Cursor released.';
}
function toggleMouseLook() {
  if (world?.mouseLook) world.releaseMouseLook();
  else world?.requestMouseLook();
}
function toggleExploration() {
  if (!world || flat) return;
  if (focused) setFocused(false);
  if (world.mode === 'seated') world.stand();
  else if (['walking', 'lobby'].includes(world.mode)) world.watch();
  canvas.focus({ preventScroll: true }); showControls();
}
function updateTime() {
  if (!film) return;
  $('#seek').value = film.time;
  $('#seek').setAttribute('aria-valuetext', `${formatTime(film.time)} of ${formatTime(film.duration)}`);
  $('#film-time').textContent = `${formatTime(film.time)} / ${formatTime(film.duration)}`;
  const detailURL = `screening.html?from=${encodeURIComponent(`${selected}/${film.time.toFixed(1)}`)}#${selected}`;
  for (const link of [$('#explore-screening'), $('#help-explore'), $('#failure-screening')]) link.href = detailURL;
}
function seek(time) {
  if (!film) return;
  film.seek(time); world?.markProjectionDirty(); updateTime();
  if (mode === 'ended') { world?.setHouseLights(.12); setMode('paused'); }
  showControls();
}
function togglePlayback() {
  if (!film || !['playing', 'paused', 'ended'].includes(mode)) return;
  if (mode === 'playing') { film.pause(); setMode('paused'); }
  else { if (mode === 'ended') { film.seek(0); world?.setHouseLights(.12); updateTime(); } film.play(); setMode('playing'); }
  showControls();
}
function goLobby({ history = true } = {}) {
  ++transition; film?.pause(); film?.seek(0); world?.lobby(); world?.markProjectionDirty();
  setFocused(false); setMode('lobby'); $('#failure').hidden = true;
  if (history && location.hash !== '#lobby') window.history.pushState(null, '', '#lobby');
}
async function leaveTheater() {
  if (!world || mode === 'entering' || world.zone === 'lobby') { goLobby(); return; }
  setFocused(false); await world.walkOut();
  canvas.focus({ preventScroll: true }); showControls();
}
function configureEntry(entry) {
  selected = entry.slug; activeEntry = entry;
  document.title = `${entry.title} — Tanishk’s theater`;
  world?.selectScreening(selected);
  for (const link of [$('#explore-screening'), $('#help-explore'), $('#failure-screening')]) link.href = `screening.html#${selected}`;
}
function loadFilm(entry) {
  const version = ++filmVersion;
  film?.dispose(); film = undefined; direct.replaceChildren(); configureEntry(entry);
  const base = new URL(`screenings/${selected}/`, import.meta.url);
  filmPromise = createFilm(new URL(entry.film, base), {
    onEnd: () => { world?.setHouseLights(1); setMode('ended'); document.body.classList.add('controls-visible'); },
    onSoundChange: soundChanged,
  }).then(loaded => {
    if (version !== filmVersion) { loaded.dispose(); return loaded; }
    film = loaded; direct.replaceChildren(film.canvas); world?.setProjectionCanvas(film.canvas);
    $('#seek').max = film.duration; soundChanged(film.muted); return loaded;
  });
  filmPromise.catch(error => { if (version === filmVersion) failure(error); });
}
function createPosterTargets() {
  catalog.filter(entry => entry.film).forEach((entry, index) => {
    const button = index === 0 ? posterTarget : document.createElement('button');
    button.className = 'world-target'; button.hidden = true; button.dataset.screening = entry.slug;
    button.setAttribute('aria-label', `Enter ${entry.title}`); button.title = `Enter ${entry.title}`;
    button.addEventListener('click', () => enter({ slug: entry.slug }));
    if (index) $('#cinema').append(button);
    posterTargets.set(entry.slug, button);
  });
}
async function enter({ instant = false, history = true, start = null, slug = selected } = {}) {
  if (mode === 'entering') return;
  if (slug !== selected) {
    const entry = catalog.find(item => item.slug === slug && item.film); if (!entry) return;
    if (world?.zone !== 'lobby') world?.lobby();
    loadFilm(entry); setFocused(false); setMode('lobby');
  }
  if (['playing', 'paused', 'ended'].includes(mode) && world?.zone === 'lobby') { setFocused(false); await world.watch(); return; }
  if (!['lobby', 'boot'].includes(mode)) return;
  const version = ++transition;
  setMode('entering'); posterTarget.hidden = true;
  $('#walk-hint').classList.add('dismissed');
  try {
    const [loaded] = await Promise.all([filmPromise, world?.enter({ instant })]);
    if (version !== transition) return;
    film = loaded;
    film.seek(0); world?.markProjectionDirty();
    if (start !== null) {
      const shot = film.film.shots.find((item) => item.id === start);
      film.seek(shot ? shot.start : Number(start) || 0); world?.markProjectionDirty();
    }
    if (world) await world.openCurtains();
    if (version !== transition) return;
    if (help.open || program.open) { film.pause(); setMode('paused'); }
    else { film.play(); setMode('playing'); }
    if (history) window.history.pushState(null, '', `#${selected}`);
    canvas.focus({ preventScroll: true }); showControls();
  } catch (error) { if (version === transition) failure(error); }
}
async function route() {
  if (mode === 'boot') return;
  const [id, start] = location.hash.slice(1).split('/');
  if (catalog.some(entry => entry.slug === id && entry.film)) {
    if (mode !== 'lobby') goLobby({ history: false });
    await enter({ slug: id, instant: true, history: false, start: start ?? null });
  } else goLobby({ history: false });
}

$('#back-lobby').addEventListener('click', leaveTheater);
$('#leave').addEventListener('click', leaveTheater);
$('#replay').addEventListener('click', () => { film.seek(0); updateTime(); world?.markProjectionDirty(); world?.setHouseLights(.12); film.play(); setMode('playing'); showControls(); });
$('#play-pause').addEventListener('click', togglePlayback);
$('#seek').addEventListener('input', (event) => seek(Number(event.target.value)));
$('#sound').addEventListener('click', () => { film?.setMuted(!film.muted); showControls(); });
$('#focus-film').addEventListener('click', () => setFocused(!focused));
$('#roam').addEventListener('click', toggleExploration);
$('#mouse-look').addEventListener('click', toggleMouseLook);
function openDialog(dialog) {
  helpResume = mode === 'playing';
  if (helpResume) { film.pause(); setMode('paused'); }
  dialog.showModal();
  world?.setInputEnabled(false);
}
$('#help').addEventListener('click', () => openDialog(help));
$('#close-help').addEventListener('click', () => help.close());
for (const dialog of [help, program]) dialog.addEventListener('close', () => { if (helpResume && mode === 'paused') { film.play(); setMode('playing'); } helpResume = false; world?.setInputEnabled(!focused); });
function renderProgram() {
  const entries = catalog.filter(entry => entry.film), pages = Math.ceil(entries.length / 4);
  const list = $('#film-list'); list.replaceChildren();
  for (const entry of entries.slice(programPage * 4, programPage * 4 + 4)) {
    const link = document.createElement('a'); link.href = `#${entry.slug}`;
    if (entry.slug === selected) link.setAttribute('aria-current', 'true');
    if (entry.cover.image) {
      const image = document.createElement('img'); image.src = new URL(`screenings/${entry.slug}/${entry.cover.image}`, import.meta.url); image.alt = entry.cover.alt; link.append(image);
    }
    const title = document.createElement('span'); title.textContent = entry.title; link.append(title);
    link.addEventListener('click', event => { event.preventDefault(); const same = entry.slug === selected; program.close(); if (!same || mode === 'lobby') enter({ slug: entry.slug }); });
    list.append(link);
  }
  $('#program-pages').hidden = pages <= 1;
  $('#program-previous').disabled = programPage === 0; $('#program-next').disabled = programPage === pages - 1;
  $('#program-page').textContent = `${programPage + 1} / ${pages}`;
}
$('#choose-screening').addEventListener('click', () => { renderProgram(); openDialog(program); });
$('#close-program').addEventListener('click', () => program.close());
$('#program-previous').addEventListener('click', () => { programPage--; renderProgram(); });
$('#program-next').addEventListener('click', () => { programPage++; renderProgram(); });
$('#retry').addEventListener('click', () => location.reload());
document.addEventListener('pointermove', () => { if (mode === 'playing') showControls(); });
document.addEventListener('pointerdown', () => { if (mode === 'playing') showControls(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && mode === 'playing') { film.pause(); setMode('paused'); } });
document.addEventListener('keydown', (event) => {
  if (event.altKey || event.ctrlKey || event.metaKey || help.open || program.open || event.target.closest('input, textarea, select')) return;
  if (event.key === 'Escape' && (world?.mouseLook || performance.now() - lookReleasedAt < 250)) { event.preventDefault(); world?.releaseMouseLook(); return; }
  if (event.key.toLowerCase() === 'l' && !flat && !focused) { event.preventDefault(); toggleMouseLook(); return; }
  if (event.key === 'Escape' && mode !== 'lobby' && mode !== 'boot') {
    event.preventDefault(); if (focused && !flat) setFocused(false); else leaveTheater(); return;
  }
  if (!['playing', 'paused', 'ended'].includes(mode)) return;
  switch (event.key.toLowerCase()) {
    case ' ': if (!event.target.closest('button, a')) { event.preventDefault(); togglePlayback(); } break;
    case 'm': event.preventDefault(); film.setMuted(!film.muted); showControls(); break;
    case 'f': event.preventDefault(); setFocused(!focused); break;
    case 'r': if (!event.target.closest('button, a')) { event.preventDefault(); toggleExploration(); } break;
    case 'arrowleft': if (focused || world?.mode === 'seated') { event.preventDefault(); seek(film.time - 5); } break;
    case 'arrowright': if (focused || world?.mode === 'seated') { event.preventDefault(); seek(film.time + 5); } break;
  }
});
window.addEventListener('popstate', route);
window.addEventListener('hashchange', route);

// Touch movement stays on a small joystick; dragging the room changes the view.
const joystick = $('#joystick'), thumb = joystick.querySelector('.joystick-thumb');
let joystickPointer;
function moveJoystick(event) {
  if (event.pointerId !== joystickPointer) return;
  const rect = joystick.getBoundingClientRect();
  let x = (event.clientX - rect.left - rect.width / 2) / 27, y = (event.clientY - rect.top - rect.height / 2) / 27;
  const length = Math.max(1, Math.hypot(x, y)); x /= length; y /= length;
  world?.setJoystick(x, y); thumb.style.transform = `translate(${x * 24}px,${y * 24}px)`;
}
joystick.addEventListener('pointerdown', (event) => { joystickPointer = event.pointerId; joystick.setPointerCapture(event.pointerId); moveJoystick(event); });
joystick.addEventListener('pointermove', moveJoystick);
for (const name of ['pointerup', 'pointercancel']) joystick.addEventListener(name, () => { joystickPointer = undefined; world?.setJoystick(0, 0); thumb.style.transform = ''; });

function frame(now) {
  const delta = Math.min(1, (now - frameTime) / 1000); frameTime = now;
  film?.setRoomGain(focused ? 1 : world?.soundGain ?? 1);
  const changed = film?.update(delta, now / 1000);
  if (changed) world?.markProjectionDirty();
  world?.update(delta, !focused);
  const rects = new Map((world?.posterRects() ?? []).map(rect => [rect.slug, rect]));
  for (const [slug, button] of posterTargets) {
    const rect = rects.get(slug), visible = rect && rect.left + rect.width > 0 && rect.left < innerWidth && rect.top + rect.height > 0 && rect.top < innerHeight;
    button.hidden = !visible;
    if (visible) Object.assign(button.style, { left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px` });
  }
  if (film && now - lastHUD > 200) {
    lastHUD = now;
    updateTime();
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

try {
  const response = await fetch(new URL('screenings/catalog.json', import.meta.url));
  if (!response.ok) throw new Error('Could not load the program.');
  catalog = await response.json();
  const entry = catalog.find((item) => item.slug === location.hash.slice(1).split('/')[0] && item.film) ?? catalog.find((item) => item.film);
  if (!entry) throw new Error('No timed films are available.');
  configureEntry(entry); createPosterTargets();
  $('#choose-screening').hidden = catalog.filter(item => item.film).length < 2;
  for (const link of [$('#explore-screening'), $('#help-explore'), $('#failure-screening')]) link.href = `screening.html#${selected}`;
  const base = new URL(`screenings/${selected}/`, import.meta.url);
  try {
    const asset = path => path ? new URL(path, base).href : undefined;
    const screenings = catalog.filter(item => item.film).map(item => ({ ...item, posterImage: item.cover.image ? new URL(`screenings/${item.slug}/${item.cover.image}`, import.meta.url).href : undefined, posterTitle: item.cover.title, posterSubtitle: item.cover.subtitle }));
    world = await createCinemaWorld(canvas, { posterImage: asset(entry.cover.image), posterTitle: entry.cover.title, posterSubtitle: entry.cover.subtitle, duration: entry.duration, screenings, selected, onEnter: slug => enter({ slug }), onScreenInteract: togglePlayback, onNavigationChange: syncNavigation, onLookChange: lookChanged, onHintDismiss: () => $('#walk-hint').classList.add('dismissed') });
    document.body.dataset.graphics = 'webgl';
    $('#mouse-look').hidden = !canvas.requestPointerLock || !matchMedia('(pointer: fine)').matches;
  } catch (error) {
    console.warn('3D room unavailable; using direct playback.', error);
    flat = true; setFocused(true); document.body.dataset.graphics = 'flat';
    $('#choose-screening').hidden = false; $('#walk-hint').textContent = 'Choose a screening to watch';
  }
  loadFilm(entry);
  setMode('lobby'); $('#boot').hidden = true;
  setTimeout(() => $('#walk-hint').classList.add('dismissed'), 9000);
  if (location.hash.slice(1).split('/')[0] === selected) await route();
} catch (error) { failure(error); }
