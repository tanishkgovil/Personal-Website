import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { buildTimeline, shotAt } from '../film-schema.mjs';

const fixture = () => ({ title: 'A film', module: 'scenes.js', shots: [
  { id: 'image', type: 'image', src: 'photo.jpg', duration: 4 },
  { id: 'video', type: 'video', src: 'clip.mp4', duration: 7 },
  { id: 'work', type: 'custom', key: 'diagram', duration: 5 },
] });

test('the timeline is continuous and boundaries select the next shot', () => {
  const film = buildTimeline(fixture());
  assert.deepEqual(film.shots.map(({ start, end }) => [start, end]), [[0, 4], [4, 11], [11, 16]]);
  assert.equal(film.duration, 16);
  assert.equal(shotAt(film, -8), 0);
  assert.equal(shotAt(film, 3.999), 0);
  assert.equal(shotAt(film, 4), 1);
  assert.equal(shotAt(film, 11), 2);
  assert.equal(shotAt(film, 16), 2);
  assert.equal(shotAt(film, 999), 2);
});

test('invalid timing, duplicate IDs, and nonlocal media are rejected', () => {
  for (const duration of [0, -1, Infinity, NaN]) {
    const film = fixture(); film.shots[0].duration = duration;
    assert.throws(() => buildTimeline(film), /duration/);
  }
  const duplicate = fixture(); duplicate.shots[1].id = 'image';
  assert.throws(() => buildTimeline(duplicate), /Duplicate/);
  const outside = fixture(); outside.shots[0].src = '../private/resume.pdf';
  assert.throws(() => buildTimeline(outside), /local media/);
  const missing = fixture(); delete missing.module;
  assert.throws(() => buildTimeline(missing), /film module/);
});

test('the NYC film and its assets remain self-contained', async () => {
  const base = new URL('../screenings/nyc/', import.meta.url);
  const film = buildTimeline(JSON.parse(await readFile(new URL('film.json', base), 'utf8')));
  await access(new URL(film.module, base));
  for (const shot of film.shots) if (shot.src) await access(new URL(shot.src, base));
  assert(film.duration > 0);
  assert.equal(film.shots[0].start, 0);
  assert.equal(film.shots.at(-1).end, film.duration);
});
