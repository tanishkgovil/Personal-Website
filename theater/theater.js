import { renderCover, renderScene, escape } from './renderers.js';
import { validateScreening } from './schema.mjs';
import { createPresentation } from './presentation.js';
import { mountCinematicMedia } from './cinematic-media.js';

const sceneRoot = document.querySelector('#scene');
const screen = document.querySelector('#screen');
const progress = document.querySelector('#scene-progress');
const previous = document.querySelector('#previous');
const next = document.querySelector('#next');
const expand = document.querySelector('#expand');
const pageCounter = document.querySelector('#page-count');
const program = document.querySelector('#program-dialog');
const soundButton = document.querySelector('#sound');
const presentation = createPresentation({ screen, curtains: document.querySelector('#curtains'), controls: document.querySelector('.screen-controls') });
const cache = new Map();
const sceneState = new Map();
let catalog = [];
let active;
let current = -1;
let page = 0;
let pageCount = 1;
let expanded = false;
let cleanup;
let renderVersion = 0;
let routeVersion = 0;
let programPage = 0;
let resizeFrame;
let screeningStylesheet;
let resumeVideo;

async function readJSON(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not load ${url}: ${response.status}`);
  return response.json();
}

function loadScreening(slug) {
  if (!cache.has(slug)) {
    const base = new URL(`screenings/${slug}/`, import.meta.url);
    const promise = readJSON(new URL('screening.json', base)).then((data) => ({ slug, data: validateScreening(data, slug), base }));
    cache.set(slug, promise);
    promise.catch(() => cache.delete(slug));
  }
  return cache.get(slug);
}

async function activateScreening(screening, version) {
  if (version !== routeVersion) return false;
  if (active?.slug === screening.slug) return true;
  let stylesheet;
  if (screening.data.stylesheet) {
    stylesheet = document.createElement('link');
    stylesheet.rel = 'stylesheet';
    stylesheet.media = 'not all';
    stylesheet.href = new URL(screening.data.stylesheet, screening.base).href;
    try {
      await new Promise((resolve, reject) => {
        stylesheet.onload = resolve;
        stylesheet.onerror = () => reject(new Error(`Could not load ${stylesheet.href}`));
        document.head.append(stylesheet);
      });
    } catch (error) { stylesheet.remove(); throw error; }
  }
  if (version !== routeVersion) { stylesheet?.remove(); return false; }
  screeningStylesheet?.remove();
  if (stylesheet) stylesheet.media = 'all';
  screeningStylesheet = stylesheet;
  active = screening;
  const [fromSlug, fromTime] = (new URLSearchParams(location.search).get('from') ?? '').split('/');
  const resume = fromSlug === screening.slug && fromTime !== undefined && Number.isFinite(Number(fromTime)) && Number(fromTime) >= 0 ? `/${Number(fromTime)}` : '';
  document.querySelector('#return-theater').href = screening.data.film ? `./#${screening.slug}${resume}` : './';
  screen.dataset.screening = screening.slug;
  return true;
}

function pauseMedia() {
  sceneRoot.querySelectorAll('video, audio').forEach((media) => media.pause());
}

function syncHash(replace = false) {
  const scene = active.data.scenes[current];
  const hash = `#${active.slug}${scene ? `/${scene.id}` : ''}${page > 0 ? `/${page + 1}` : ''}`;
  if (window.location.hash !== hash) window.history[replace ? 'replaceState' : 'pushState'](null, '', hash);
}

function updateControls() {
  if (!active) return;
  const focusedMarker = progress.contains(document.activeElement);
  previous.disabled = current === -1 && page === 0;
  next.disabled = false;
  const finalScene = current === active.data.scenes.length - 1;
  next.setAttribute('aria-label', page < pageCount - 1 ? 'Next page' : finalScene ? 'Replay screening' : current === -1 ? 'Begin screening' : 'Next scene');
  previous.setAttribute('aria-label', page > 0 ? 'Previous page' : 'Previous scene');
  const scenes = [{ id: 'cover', title: 'Title card' }, ...active.data.scenes];
  // Keep controls compact even for a screening with many scenes.
  const visibleMarkers = screen.clientWidth < 340 ? 3 : screen.clientWidth < 500 ? 5 : 7;
  const start = Math.max(0, Math.min(current + 1 - Math.floor(visibleMarkers / 2), scenes.length - visibleMarkers));
  progress.innerHTML = scenes.slice(start, start + visibleMarkers).map((scene, offset) => {
    const index = start + offset - 1;
    const label = index === -1 ? 'Title card' : `Scene ${index + 1}: ${scene.title || scene.id}`;
    return `<button class="scene-marker" type="button" data-scene="${index}" aria-label="${escape(label)}"${current === index ? ' aria-current="step"' : ''}></button>`;
  }).join('');
  if (focusedMarker) progress.querySelector('[aria-current="step"]')?.focus({ preventScroll: true });
  pageCounter.hidden = pageCount <= 1;
  pageCounter.textContent = `${page + 1} / ${pageCount}`;
  pageCounter.setAttribute('aria-label', `Page ${page + 1} of ${pageCount}`);
  const scene = active.data.scenes[current];
  document.querySelector('#scene-announcement').textContent = `${active.data.title}. ${scene ? scene.title || scene.id : 'Title card'}${pageCount > 1 ? `. Page ${page + 1} of ${pageCount}` : ''}.`;
}

function layoutText() {
  const window = sceneRoot.querySelector('.prose-window');
  const prose = window?.querySelector('.prose');
  if (!prose || !window.clientWidth || !window.clientHeight) {
    pageCount = 1;
    page = 0;
  } else {
    const gap = parseFloat(getComputedStyle(prose).columnGap);
    const width = window.clientWidth;
    prose.style.columnWidth = `${width}px`;
    prose.style.transform = '';
    pageCount = Math.max(1, Math.ceil((prose.scrollWidth + gap - 1) / (width + gap)));
    page = Math.max(0, Math.min(page, pageCount - 1));
    prose.style.transform = `translateX(${-page * (width + gap)}px)`;
  }
  updateControls();
}

async function showScene(index, requestedPage = 0, { history = true, focus = false, opening = false } = {}) {
  if (!opening) presentation.cancel();
  const version = ++renderVersion;
  pauseMedia();
  cleanup?.();
  cleanup = undefined;
  const markerFocused = progress.contains(document.activeElement);
  const previousFocused = document.activeElement === previous;
  current = Math.max(-1, Math.min(active.data.scenes.length - 1, index));
  presentation.setPlaying(current >= 0 && current < active.data.scenes.length - 1);
  page = requestedPage;
  pageCount = 1;
  const scene = active.data.scenes[current];
  sceneRoot.dataset.scene = scene?.id ?? 'cover';
  const asset = (path) => new URL(path, active.base).href;
  sceneRoot.innerHTML = scene ? renderScene(scene, asset) : renderCover(active.data, asset);
  screen.setAttribute('aria-label', active.data.title);
  screen.setAttribute('aria-busy', 'false');
  document.title = `${active.data.title} — Tanishk’s theater`;
  sceneRoot.classList.remove('entering');
  void sceneRoot.offsetWidth;
  sceneRoot.classList.add('entering');
  layoutText();
  if (scene?.type === 'custom') {
    try {
      const module = await import(asset(scene.module));
      if (version !== renderVersion) return;
      if (typeof module.mount !== 'function') throw new Error(`${scene.module} must export mount()`);
      const key = `${active.slug}/${scene.id}`;
      if (!sceneState.has(key)) sceneState.set(key, {});
      cleanup = module.mount(sceneRoot.querySelector('.custom-mount'), { scene, screening: active.data, asset, state: sceneState.get(key) });
    } catch (error) {
      if (version !== renderVersion) return;
      console.error(error);
      sceneRoot.innerHTML = '<article class="screen-message"><h2>This scene couldn’t load.</h2><p>You can continue to the next scene.</p></article>';
    }
  }
  if (version !== renderVersion) return;
  const customCleanup = cleanup;
  const mediaCleanup = mountCinematicMedia(sceneRoot, { soundButton, onEnded: () => { if (version === renderVersion) advance(1); } });
  cleanup = () => { mediaCleanup(); customCleanup?.(); };
  if (history) syncHash();
  if (markerFocused) progress.querySelector('[aria-current="step"]')?.focus({ preventScroll: true });
  if (focus || (previousFocused && previous.disabled)) screen.focus({ preventScroll: true });
}

async function openRoute() {
  presentation.cancel();
  const version = ++routeVersion;
  const [requestedSlug, sceneId, requestedPage] = window.location.hash.slice(1).split('/');
  const slug = catalog.some((entry) => entry.slug === requestedSlug) ? requestedSlug : catalog[0].slug;
  try {
    const screening = await loadScreening(slug);
    if (!await activateScreening(screening, version)) return;
    const index = active.data.scenes.findIndex((scene) => scene.id === sceneId);
    const pageNumber = /^\d+$/.test(requestedPage ?? '') ? Math.max(0, Number(requestedPage) - 1) : 0;
    await showScene(index, pageNumber, { history: false });
    if (version === routeVersion && requestedSlug && requestedSlug !== slug) syncHash(true);
  } catch (error) {
    if (version !== routeVersion) return;
    console.error(error);
    pauseMedia();
    screen.setAttribute('aria-busy', 'false');
    sceneRoot.innerHTML = '<article class="screen-message"><h1>This screening couldn’t load.</h1><p>Choose another screening or try refreshing.</p></article>';
    previous.disabled = true;
    next.disabled = true;
  }
}

function advance(direction) {
  if (!active || presentation.running) return;
  if (current === -1 && direction > 0) { beginScreening(); return; }
  if ((direction > 0 && page < pageCount - 1) || (direction < 0 && page > 0)) {
    page += direction;
    layoutText();
    syncHash();
  } else if (direction > 0) {
    showScene(current === active.data.scenes.length - 1 ? -1 : current + 1);
  } else if (current >= 0) {
    showScene(current - 1, Number.MAX_SAFE_INTEGER);
  }
}

async function beginScreening() {
  if (!active || current !== -1 || presentation.running) return;
  await presentation.play(() => showScene(0, 0, { opening: true }));
  if (current >= 0 && !program.open) screen.focus({ preventScroll: true });
}

function toggleExpanded(force) {
  expanded = typeof force === 'boolean' ? force : !expanded;
  document.body.classList.toggle('is-expanded', expanded);
  expand.setAttribute('aria-pressed', String(expanded));
  const label = expanded ? 'Return to theater' : 'Expand screen';
  expand.setAttribute('aria-label', label);
  expand.title = `${label} (F)`;
}

function renderProgram() {
  const columns = matchMedia('(max-width: 600px)').matches ? 1 : 3;
  const pages = Math.ceil(catalog.length / columns);
  programPage = Math.max(0, Math.min(programPage, pages - 1));
  const grid = document.querySelector('#program-grid');
  grid.style.setProperty('--program-columns', columns);
  grid.innerHTML = catalog.slice(programPage * columns, (programPage + 1) * columns).map((entry) => {
    const image = entry.cover.image ? new URL(`screenings/${entry.slug}/${entry.cover.image}`, import.meta.url).href : null;
    return `<button class="program-film" type="button" data-screening="${escape(entry.slug)}" aria-label="Watch ${escape(entry.title)}"><span class="mini-poster">${image ? `<img src="${escape(image)}" alt="">` : ''}<span>${escape(entry.cover.title)}</span></span><strong>${escape(entry.title)}</strong></button>`;
  }).join('');
  document.querySelector('#program-pagination').hidden = pages <= 1;
  document.querySelector('#program-previous').disabled = programPage === 0;
  document.querySelector('#program-next').disabled = programPage === pages - 1;
  document.querySelector('#program-page').textContent = `${programPage + 1} / ${pages}`;
}

function openProgram() {
  const video = sceneRoot.querySelector('video[data-cinematic]');
  resumeVideo = video && !video.paused ? video : undefined;
  pauseMedia();
  presentation.cancel();
  presentation.setPlaying(current >= 0 && current < active.data.scenes.length - 1);
  renderProgram();
  program.showModal();
}
previous.addEventListener('click', () => advance(-1));
next.addEventListener('click', () => advance(1));
expand.addEventListener('click', () => toggleExpanded());
progress.addEventListener('click', (event) => {
  const marker = event.target.closest('[data-scene]');
  if (marker) {
    const index = Number(marker.dataset.scene);
    if (current === -1 && index === 0) beginScreening();
    else showScene(index);
  }
});
sceneRoot.addEventListener('click', (event) => {
  if (event.target.closest('[data-begin]')) beginScreening();
});
document.querySelector('#open-program').addEventListener('click', openProgram);
document.querySelector('#close-program').addEventListener('click', () => program.close());
document.querySelector('#program-previous').addEventListener('click', () => { programPage--; renderProgram(); });
document.querySelector('#program-next').addEventListener('click', () => { programPage++; renderProgram(); });
document.querySelector('#program-grid').addEventListener('click', async (event) => {
  const film = event.target.closest('[data-screening]');
  if (!film) return;
  resumeVideo = undefined;
  program.close();
  ++routeVersion;
  const version = routeVersion;
  try {
    const screening = await loadScreening(film.dataset.screening);
    if (!await activateScreening(screening, version)) return;
    await showScene(-1, 0, { focus: true });
  } catch (error) { console.error(error); }
});
program.addEventListener('click', (event) => {
  const rect = program.getBoundingClientRect();
  if (event.target === program && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) program.close();
});
program.addEventListener('close', () => {
  if (resumeVideo?.isConnected) resumeVideo.play().catch(() => {});
  resumeVideo = undefined;
});
document.addEventListener('keydown', (event) => {
  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.target.closest('input, textarea, select, video[controls], audio[controls], [contenteditable="true"]') || program.open) return;
  if (presentation.running && event.key === 'Escape') { event.preventDefault(); presentation.skip(); return; }
  switch (event.key.toLowerCase()) {
    case 'arrowright': event.preventDefault(); advance(1); break;
    case 'arrowleft': event.preventDefault(); advance(-1); break;
    case 'f': event.preventDefault(); toggleExpanded(); break;
    case 'p': event.preventDefault(); openProgram(); break;
    case 'm': if (!soundButton.hidden) { event.preventDefault(); soundButton.click(); } break;
    case ' ': {
      const video = sceneRoot.querySelector('video[data-cinematic]');
      if (video && !event.target.closest('button, a')) { event.preventDefault(); video.click(); }
      break;
    }
    case 'escape': if (expanded) toggleExpanded(false); break;
  }
});
window.addEventListener('popstate', openRoute);
window.addEventListener('hashchange', openRoute);
const observer = new ResizeObserver(() => {
  cancelAnimationFrame(resizeFrame);
  resizeFrame = requestAnimationFrame(() => { layoutText(); if (program.open) renderProgram(); });
});
observer.observe(screen);

document.querySelectorAll('.seat-row').forEach((row, rowIndex) => {
  row.innerHTML = Array.from({ length: 18 }, (_, index) => `${index === 9 ? '<span class="aisle"></span>' : ''}<span class="seat" style="transform:translateY(${Math.round(Math.abs(index - 8.5) ** 1.4 * (rowIndex + 1) * .3)}px)"></span>`).join('');
});

try {
  catalog = await readJSON(new URL('screenings/catalog.json', import.meta.url));
  if (!Array.isArray(catalog) || !catalog.length) throw new Error('No screenings in the catalog');
  await openRoute();
} catch (error) {
  console.error(error);
  screen.setAttribute('aria-busy', 'false');
  sceneRoot.innerHTML = '<article class="screen-message"><h1>The theater couldn’t load.</h1><p>Try refreshing.</p><a href="../">tanishk.org</a></article>';
}
