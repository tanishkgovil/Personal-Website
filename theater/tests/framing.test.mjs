import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { mediaFrame } from '../framing.mjs';
import { buildTimeline } from '../film-schema.mjs';
import { validateScreening } from '../schema.mjs';

test('cover fills the projection throughout a pan and rotated landscape shot', () => {
  for (const [width, height] of [[1536, 2048], [2048, 1536], [720, 1280]]) {
    for (const rotation of [0, 90, -90, 180]) {
      for (const progress of [0, .5, 1]) {
        const frame = mediaFrame(width, height, { type: 'image', rotation, y: .36, motion: { y: .8, zoom: 1.04 } }, progress);
        assert(frame.x <= 0 && frame.y <= 0);
        assert(frame.x + frame.width >= 1279.999);
        assert(frame.y + frame.height >= 719.999);
        assert(Number.isFinite(frame.drawWidth) && Number.isFinite(frame.drawHeight));
      }
    }
  }
  const food = mediaFrame(1536, 2048, { rotation: -90 }, 0);
  assert(food.drawHeight > food.drawWidth);
  assert.equal(food.width, 1280);
  assert.equal(food.height, 960);
});

test('portrait clips retain the complete frame inside a wide projection', () => {
  const frame = mediaFrame(720, 1280, { type: 'video', fit: 'contain' }, 0);
  assert.equal(frame.height, 720);
  assert.equal(frame.width, 405);
  assert.equal(frame.x, (1280 - 405) / 2);
  assert.equal(frame.y, 0);
  assert.equal(frame.drawWidth / frame.drawHeight, 720 / 1280);
});

test('NYC uses uncropped clips with ambient edges and the corrected Bungalow orientation', async () => {
  const film = JSON.parse(await readFile(new URL('../screenings/nyc/film.json', import.meta.url), 'utf8'));
  for (const shot of film.shots.filter(shot => shot.type === 'video')) {
    assert.equal(shot.fit, 'contain');
    assert.equal(shot.backdrop, 'ambient');
    assert(!shot.motion);
  }
  assert.equal(film.shots.find(shot => shot.id === 'food').rotation, -90);
});

test('invalid crops and transitions fail before a screening is indexed', () => {
  for (const change of [{ x: -1 }, { y: 2 }, { rotation: 45 }, { zoom: .5 }, { motion: { x: NaN } }, { transition: -1 }, { fit: 'stretch' }]) {
    assert.throws(() => buildTimeline({ title: 'Test', shots: [{ id: 'frame', type: 'image', src: 'photo.jpg', duration: 4, ...change }] }));
  }
});

test('the starter folder includes a playable film and extended screening without custom code', async () => {
  const base = new URL('../templates/screening/', import.meta.url);
  const story = validateScreening(JSON.parse(await readFile(new URL('screening.json', base), 'utf8')), 'another-story');
  const film = buildTimeline(JSON.parse(await readFile(new URL(story.film, base), 'utf8')));
  await access(new URL(story.cover.image, base));
  for (const shot of film.shots) await access(new URL(shot.src, base));
  assert(film.duration > 0);
  assert(!film.module);
});
