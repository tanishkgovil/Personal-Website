import { buildTimeline, shotAt } from './film-schema.mjs';
import { drawMedia, createBackdropRenderer } from './framing.mjs';

const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));

export async function createFilm(url, { onEnd = () => {}, onSoundChange = () => {} } = {}) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not load the film (${response.status}).`);
  const film = buildTimeline(await response.json());
  const base = new URL('.', url);
  const asset = (path) => new URL(path, base).href;
  const custom = film.module ? await import(asset(film.module)) : null;
  const canvas = document.createElement('canvas');
  canvas.width = 1280; canvas.height = 720;
  canvas.setAttribute('aria-label', film.title);
  const context = canvas.getContext('2d', { alpha: false });
  const drawBackdrop = createBackdropRenderer();
  const previous = document.createElement('canvas');
  previous.width = canvas.width; previous.height = canvas.height;
  const previousContext = previous.getContext('2d', { alpha: false });
  const media = new Map();
  let time = 0, playing = false, muted = false, index = -1, dirty = true, ended = false;
  let blendAge = 1, blendDuration = .45, lastDraw = -1;
  let roomGain = 1;

  const imageLoads = film.shots.filter((shot) => shot.type === 'image').map(async (shot) => {
    if (media.has(shot.src)) return;
    const image = new Image(); image.decoding = 'async';
    media.set(shot.src, image);
    image.src = asset(shot.src);
    await image.decode();
  });
  for (const shot of film.shots.filter((item) => item.type === 'video')) {
    if (media.has(shot.src)) continue;
    const video = document.createElement('video');
    video.playsInline = true; video.preload = 'auto'; video.muted = muted;
    video.src = asset(shot.src);
    media.set(shot.src, video);
  }
  await Promise.all(imageLoads);

  function stopVideos() { for (const item of media.values()) if (item instanceof HTMLVideoElement) item.pause(); }
  function playVideo(video) {
    video.muted = muted;
    video.play().catch((error) => {
      if (error.name === 'NotAllowedError' && playing) {
        muted = true; video.muted = true; onSoundChange(muted);
        video.play().catch(() => {});
      }
    });
  }
  function enterShot(nextIndex, blend = true) {
    if (blend && index >= 0) previousContext.drawImage(canvas, 0, 0);
    stopVideos();
    index = nextIndex;
    const shot = film.shots[index];
    blendDuration = shot.transition ?? (shot.type === 'video' ? .2 : .45);
    blendAge = blend && index > 0 ? 0 : blendDuration;
    if (shot.type === 'video') {
      const video = media.get(shot.src);
      video.currentTime = (shot.trimStart ?? 0) + Math.max(0, time - shot.start);
      if (playing) playVideo(video);
    }
    dirty = true;
  }
  function fitImage(source, shot, progress) {
    drawMedia(context, source, shot, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : progress, canvas.width, canvas.height);
  }
  function caption(shot, age) {
    if (!shot.title && !shot.caption) return;
    const opacity = clamp(age / .5) * clamp((shot.duration - age) / .4);
    context.save(); context.globalAlpha = opacity;
    const gradient = context.createLinearGradient(0, 410, 0, 720);
    gradient.addColorStop(0, 'rgba(0,0,0,0)'); gradient.addColorStop(1, 'rgba(3,8,12,.82)');
    context.fillStyle = gradient; context.fillRect(0, 400, 1280, 320);
    context.fillStyle = '#f8eed7';
    const title = shot.title ?? shot.caption;
    if (shot.treatment === 'title') {
      context.font = '84px Georgia, serif'; context.fillText(title, 80, 555);
      if (shot.subtitle) { context.font = '27px Arial, sans-serif'; context.fillText(shot.subtitle, 84, 608); }
    } else {
      const compact = matchMedia('(max-width: 600px) and (orientation: portrait)').matches;
      const titleSize = compact ? 50 : 30, subtitleSize = compact ? 46 : 23;
      const lines = [];
      if (shot.subtitle) {
        context.font = `${subtitleSize}px Arial, sans-serif`;
        let line = '';
        for (const word of shot.subtitle.split(' ')) {
          const candidate = `${line} ${word}`.trim();
          if (line && context.measureText(candidate).width > 1140) { lines.push(line); line = word; }
          else line = candidate;
        }
        if (line) lines.push(line);
      }
      const lineHeight = subtitleSize * 1.3;
      context.font = `${titleSize}px Arial, sans-serif`; context.fillText(title, 64, 650 - lines.length * lineHeight);
      context.font = `${subtitleSize}px Arial, sans-serif`; context.fillStyle = '#dbd1ba';
      lines.forEach((line, index) => context.fillText(line, 64, 650 - (lines.length - 1 - index) * lineHeight));
    }
    context.restore();
  }
  function draw() {
    const shot = film.shots[index];
    if (!shot) return false;
    // Keep the previous picture until a clip can actually draw its first frame.
    // A slow connection must not dissolve the projection into a black rectangle.
    if (shot.type === 'video' && (media.get(shot.src).readyState < 2 || media.get(shot.src).seeking)) return false;
    const age = time - shot.start, progress = clamp(age / shot.duration);
    context.fillStyle = '#080d12'; context.fillRect(0, 0, 1280, 720);
    if (shot.type === 'custom') custom.draw(context, shot, { time: age, progress, width: 1280, height: 720, compact: matchMedia('(max-width: 600px) and (orientation: portrait)').matches });
    else {
      if (shot.backdrop === 'ambient') drawBackdrop(context, media.get(shot.src), shot, canvas.width, canvas.height);
      fitImage(media.get(shot.src), shot, progress);
      caption(shot, age);
    }
    if (blendAge < blendDuration) { context.globalAlpha = 1 - blendAge / blendDuration; context.drawImage(previous, 0, 0); context.globalAlpha = 1; }
    dirty = false;
    return true;
  }

  enterShot(0, false); draw();
  return {
    canvas, film,
    get time() { return time; },
    get duration() { return film.duration; },
    get playing() { return playing; },
    get muted() { return muted; },
    get shot() { return film.shots[index]; },
    setRoomGain(value) { roomGain = clamp(value, .05, 1); },
    play() {
      if (ended) { time = 0; ended = false; enterShot(0, false); }
      playing = true;
      const shot = film.shots[index];
      if (shot.type === 'video') playVideo(media.get(shot.src));
    },
    pause() { playing = false; stopVideos(); dirty = true; },
    seek(value) {
      time = clamp(value, 0, film.duration); ended = false;
      const next = shotAt(film, time);
      enterShot(next, false); draw();
    },
    setMuted(value) {
      muted = value;
      for (const item of media.values()) if (item instanceof HTMLVideoElement) item.muted = muted;
      onSoundChange(muted);
    },
    update(delta, now) {
      if (playing) {
        const shot = film.shots[index];
        const video = shot.type === 'video' ? media.get(shot.src) : null;
        // Hold the timeline during buffering instead of skipping unseen footage.
        if (!video || (video.readyState >= 2 && !video.seeking)) {
          time = Math.min(film.duration, time + delta);
          blendAge += delta;
          const next = shotAt(film, time);
          if (next !== index) enterShot(next);
        }
        if (video) {
          const age = time - shot.start;
          video.volume = .85 * roomGain * Math.min(clamp(age / .2), clamp((shot.duration - age) / .2));
        }
        dirty = true;
        if (time >= film.duration && !ended) { ended = true; playing = false; stopVideos(); onEnd(); }
      }
      if (dirty && (now - lastDraw > 1 / 24 || !playing)) { const changed = draw(); lastDraw = now; return changed; }
      return false;
    },
    dispose() {
      stopVideos();
      for (const item of media.values()) if (item instanceof HTMLVideoElement) { item.removeAttribute('src'); item.load(); }
      media.clear();
    },
  };
}
