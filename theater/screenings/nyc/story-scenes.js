// These compositions belong to this screening. All story copy/media live in JSON.
import { mediaFrame, createBackdropRenderer } from '../../framing.mjs';
import { caddyProject } from './caddy-project.js';
const escape = (value = '') => String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
const paragraphs = (body = []) => (Array.isArray(body) ? body : [body]).map((text) => `<p>${escape(text)}</p>`).join('');

function media(item, asset) {
  if (item.kind === 'video') {
    return `<div class="nyc-media">${item.backdrop === 'ambient' ? '<canvas class="nyc-backdrop" aria-hidden="true"></canvas>' : ''}<video class="nyc-video" data-cinematic playsinline preload="metadata" src="${escape(asset(item.src))}" poster="${escape(asset(item.poster))}" aria-label="${escape(item.alt)}"><a href="${escape(asset(item.src))}">Open video</a></video></div>`;
  }
  return `<div class="nyc-media">${item.backdrop === 'ambient' ? '<canvas class="nyc-backdrop" aria-hidden="true"></canvas>' : ''}<img class="nyc-image" src="${escape(asset(item.src))}" alt="${escape(item.alt)}"></div>`;
}

function frameMedia(root, item) {
  const element = root.querySelector('.nyc-image, .nyc-video');
  const isVideo = element.tagName === 'VIDEO';
  const container = element.parentElement;
  const backdrop = container.querySelector('canvas');
  const drawBackdrop = backdrop ? createBackdropRenderer() : undefined;
  let animation, lastDraw = 0;
  const paintBackdrop = () => {
    if (!backdrop || (isVideo && element.readyState < 2)) return;
    drawBackdrop(backdrop.getContext('2d', { alpha: false }), element, item, backdrop.width, backdrop.height);
  };
  const animateBackdrop = (now) => {
    if (now - lastDraw > 1000 / 24) { paintBackdrop(); lastDraw = now; }
    if (isVideo && !element.paused) animation = requestAnimationFrame(animateBackdrop);
  };
  const play = () => { cancelAnimationFrame(animation); animation = requestAnimationFrame(animateBackdrop); };
  const pause = () => { cancelAnimationFrame(animation); paintBackdrop(); };
  const render = () => {
    const sourceWidth = element.videoWidth || element.naturalWidth;
    const sourceHeight = element.videoHeight || element.naturalHeight;
    if (!sourceWidth || !sourceHeight) return;
    const position = (item.position ?? '50% 50%').split(' ').map(value => parseFloat(value) / 100);
    const shot = { ...item, x: item.x ?? position[0], y: item.y ?? position[1] };
    const frame = mediaFrame(sourceWidth, sourceHeight, shot, 0, container.clientWidth, container.clientHeight);
    Object.assign(element.style, { width: `${frame.drawWidth}px`, height: `${frame.drawHeight}px`, left: `${frame.x + frame.width / 2}px`, top: `${frame.y + frame.height / 2}px`, transform: `translate(-50%, -50%) rotate(${frame.rotation}deg)` });
    if (backdrop) { backdrop.width = 640; backdrop.height = Math.round(640 * container.clientHeight / container.clientWidth); paintBackdrop(); }
  };
  const observer = new ResizeObserver(render); observer.observe(container);
  element.addEventListener('load', render); element.addEventListener('loadedmetadata', render); render();
  if (backdrop && isVideo) { element.addEventListener('play', play); element.addEventListener('pause', pause); element.addEventListener('seeked', paintBackdrop); element.addEventListener('loadeddata', paintBackdrop); if (!element.paused) play(); }
  return () => { observer.disconnect(); cancelAnimationFrame(animation); element.removeEventListener('load', render); element.removeEventListener('loadedmetadata', render); element.removeEventListener('play', play); element.removeEventListener('pause', pause); element.removeEventListener('seeked', paintBackdrop); element.removeEventListener('loadeddata', paintBackdrop); };
}

function copy(scene) {
  if (!scene.title && !scene.body) return '';
  return `<div class="nyc-copy">${scene.kicker ? `<p class="nyc-kicker">${escape(scene.kicker)}</p>` : ''}<h2>${escape(scene.title)}</h2>${paragraphs(scene.body)}</div>`;
}

const reviewSteps = [
  ['The diff', 'Get the patch.', 'The agent retrieved the change and its review comments from Gerrit.'],
  ['Context', 'Read the surrounding code.', 'I built ten tools for inspecting the repository, retrieving diffs, analyzing comments, and leaving inline feedback.'],
  ['Checks', 'Run linters and tests.', 'Proposed fixes ran in isolated Git worktrees.'],
  ['Feedback', 'Stream the response.', 'I used Server-Sent Events to stream feedback. The first visible token arrived in under two seconds.'],
];

function mountReview(root, scene, state) {
  root.innerHTML = `<section class="nyc-review nyc-editorial">${copy(scene)}<div class="nyc-review-steps" role="group" aria-label="Explore the review workflow">${reviewSteps.map(([label], index) => `<button type="button" data-review-step="${index}" aria-pressed="false"><span aria-hidden="true">0${index + 1}</span>${label}</button>`).join('')}</div><div class="nyc-review-detail" aria-live="polite" aria-atomic="true"><h3></h3><p></p></div><div class="nyc-review-foot"><span>Heimdall</span><span>Python · Gerrit · SSE</span></div></section>`;
  const show = (index) => {
    state.step = index;
    root.querySelectorAll('[data-review-step]').forEach((button) => button.setAttribute('aria-pressed', String(Number(button.dataset.reviewStep) === index)));
    root.querySelector('.nyc-review-detail h3').textContent = reviewSteps[index][1];
    root.querySelector('.nyc-review-detail p').textContent = reviewSteps[index][2];
  };
  const listener = (event) => {
    const button = event.target.closest('[data-review-step]');
    if (button) show(Number(button.dataset.reviewStep));
  };
  root.addEventListener('click', listener);
  show(state.step ?? 0);
  return () => root.removeEventListener('click', listener);
}

function mountMetrics(root, scene, state) {
  root.innerHTML = `<section class="nyc-metrics nyc-editorial">${copy(scene)}<div class="nyc-metric-tabs" role="group" aria-label="Explore the Caddy project"><button class="nyc-action" data-metrics-view="overview">Overview</button><button class="nyc-action" data-metrics-view="coverage">Metrics</button><button class="nyc-action" data-metrics-view="reload">Reloads</button></div><div class="nyc-metric-content"></div><div class="nyc-metrics-foot"><span data-metric-note></span><a data-metric-source target="_blank" rel="noopener noreferrer">Read the code <span aria-hidden="true">↗</span></a></div></section>`;
  const content = root.querySelector('.nyc-metric-content');
  const render = () => {
    const view = state.metricsView ?? 'overview', reload = view === 'reload', group = state.metricGroup ?? 0;
    root.querySelectorAll('[data-metrics-view]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.metricsView === view)));
    root.querySelector('[data-metric-note]').textContent = reload ? 'Illustrative counts' : view === 'overview' ? 'Public internship project' : 'HAProxy-style monitoring';
    root.querySelector('[data-metric-source]').href = reload ? caddyProject.trackerSource : caddyProject.areas[group].source;
    if (view === 'overview') {
      content.innerHTML = `<div class="nyc-review-detail"><h3>Traffic, speed, and failures.</h3><p>${escape(caddyProject.overview)}</p></div>`;
    } else if (!reload) {
      const area = caddyProject.areas[group];
      content.innerHTML = `<div class="nyc-review-steps" role="group" aria-label="Metric categories">${caddyProject.areas.map((item, index) => `<button data-metric-group="${index}" aria-pressed="${index === group}">${escape(item.label)}</button>`).join('')}</div><div class="nyc-review-detail"><h3>${escape(area.title)}</h3><p>${escape(area.body)}</p></div>`;
    } else {
      const changed = Boolean(state.reloaded);
      const rows = [['A', '42', changed ? 'kept' : 'active'], ['B', '17', changed ? 'pruned' : 'active'], ['C', '0', changed ? 'new' : 'not configured']];
      content.innerHTML = `<div class="nyc-metric-board" aria-label="Illustration of metric series before and after a reload">${rows.map(([label, value, status], index) => `<div class="nyc-metric-row${index === 1 && changed ? ' is-pruned' : ''}${index === 2 && !changed ? ' is-inactive' : ''}"><span>Backend ${label}</span><strong>${value}</strong><span class="nyc-series-status">${status}</span></div>`).join('')}</div><div class="nyc-metrics-action"><button class="nyc-action" data-reload>${changed ? 'Reset ↺' : 'Reload config ↻'}</button><p class="nyc-metrics-result">${changed ? 'A keeps its value. B disappears. C starts at zero.' : 'Two backends. Two active series.'}</p></div>`;
    }
  };
  const listener = event => {
    const button = event.target.closest('button');
    if (!button) return;
    let focus;
    if (button.dataset.metricsView) { state.metricsView = button.dataset.metricsView; focus = `[data-metrics-view="${state.metricsView}"]`; }
    else if (button.dataset.metricGroup !== undefined) { state.metricGroup = Number(button.dataset.metricGroup); focus = `[data-metric-group="${state.metricGroup}"]`; }
    else if (button.hasAttribute('data-reload')) { state.reloaded = !state.reloaded; focus = '[data-reload]'; }
    else return;
    render(); root.querySelector(focus)?.focus({ preventScroll: true });
  };
  root.addEventListener('click', listener); render();
  return () => root.removeEventListener('click', listener);
}

export function mount(root, { scene, asset, state }) {
  if (scene.layout === 'heimdall') return mountReview(root, scene, state);
  if (scene.layout === 'metrics') return mountMetrics(root, scene, state);
  const items = scene.media ?? [];
  switch (scene.layout) {
    case 'photo':
      root.innerHTML = `<section class="nyc-photo nyc-position-${escape(scene.position ?? 'bottom-left')}${scene.title || scene.body ? ' has-caption' : ''}">${media(items[0], asset)}${copy(scene)}</section>`;
      break;
    case 'clip':
      root.innerHTML = `<section class="nyc-clip${scene.title || scene.body ? ' has-caption' : ''}">${media(items[0], asset)}${copy(scene)}</section>`;
      break;
    default:
      throw new Error(`Unknown NYC composition: ${scene.layout}`);
  }
  return frameMedia(root, items[0]);
}
