const local = (value) => typeof value === 'string' && value.length > 0 && !/^(?:[a-z]+:|\/|\\)/i.test(value) && !value.split(/[\/\\]/).includes('..');

export function buildTimeline(film) {
  if (!film?.title || !Array.isArray(film.shots) || !film.shots.length) throw new Error('A film needs a title and shots.');
  if (film.module && !local(film.module)) throw new Error('The film module must be inside its screening folder.');
  let duration = 0;
  const ids = new Set();
  const shots = film.shots.map((shot) => {
    if (!shot.id || ids.has(shot.id)) throw new Error(`Duplicate or missing shot ID: ${shot.id}`);
    ids.add(shot.id);
    if (!['image', 'video', 'custom'].includes(shot.type)) throw new Error(`Unknown shot type: ${shot.type}`);
    if (!Number.isFinite(shot.duration) || shot.duration <= 0) throw new Error(`${shot.id}: duration must be positive.`);
    if (shot.type !== 'custom' && !local(shot.src)) throw new Error(`${shot.id}: use a local media file.`);
    if (shot.type === 'custom' && !film.module) throw new Error(`${shot.id}: custom shots need a film module.`);
    if (shot.trimStart !== undefined && (!Number.isFinite(shot.trimStart) || shot.trimStart < 0)) throw new Error(`${shot.id}: invalid trimStart.`);
    if (shot.fit !== undefined && !['cover', 'contain'].includes(shot.fit)) throw new Error(`${shot.id}: fit must be cover or contain.`);
    if (shot.backdrop !== undefined && shot.backdrop !== 'ambient') throw new Error(`${shot.id}: backdrop must be ambient.`);
    if (shot.rotation !== undefined && (!Number.isFinite(shot.rotation) || shot.rotation % 90 !== 0)) throw new Error(`${shot.id}: rotation must be a multiple of 90 degrees.`);
    for (const frame of [shot, shot.motion].filter(Boolean)) {
      for (const axis of ['x', 'y']) if (frame[axis] !== undefined && (!Number.isFinite(frame[axis]) || frame[axis] < 0 || frame[axis] > 1)) throw new Error(`${shot.id}: ${axis} must be between 0 and 1.`);
      if (frame.zoom !== undefined && (!Number.isFinite(frame.zoom) || frame.zoom < 1)) throw new Error(`${shot.id}: zoom must be at least 1.`);
    }
    if (shot.transition !== undefined && (!Number.isFinite(shot.transition) || shot.transition < 0 || shot.transition > shot.duration)) throw new Error(`${shot.id}: invalid transition duration.`);
    const start = duration;
    duration += shot.duration;
    return { ...shot, start, end: duration };
  });
  return { ...film, shots, duration };
}

export function shotAt(film, time) {
  const clamped = Math.max(0, Math.min(time, film.duration));
  const index = film.shots.findIndex((shot) => clamped < shot.end);
  return index === -1 ? film.shots.length - 1 : index;
}
