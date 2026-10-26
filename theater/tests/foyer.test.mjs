import test from 'node:test';
import assert from 'node:assert/strict';
import { createFoyerLayout, canWalkFoyer, canWalkCinema } from '../foyer-layout.mjs';
import { moveThroughRoom } from '../navigation.mjs';

const stories = count => Array.from({ length: count }, (_, index) => ({ slug: `story-${index}` }));

test('every story gets its own poster and entrance, with room for future screenings', () => {
  const one = createFoyerLayout(stories(1));
  assert.equal(one.bays.length, 3);
  assert.equal(one.bays.filter(bay => bay.screening).length, 1);
  const many = createFoyerLayout(stories(6));
  assert.equal(many.bays.length, 6);
  assert(many.maxX > one.maxX);
  for (const [index, bay] of many.bays.entries()) {
    assert.equal(bay.screening.slug, `story-${index}`);
    assert(bay.posterX > many.minX && bay.posterX < many.maxX);
    assert(canWalkFoyer(many, bay.doorX, -8));
    if (index) assert(bay.doorX - many.bays[index - 1].doorX > 14, 'Auditorium footprints cannot overlap');
  }
  assert.equal(new Set(many.bays.map(bay => bay.doorX)).size, 6);
});

test('each entrance connects to its auditorium without moving the coordinate system', () => {
  const layout = createFoyerLayout(stories(3));
  for (const bay of layout.bays) {
    const canMove = (x, z) => canWalkCinema(layout, bay.doorX, x, z);
    const intoRoom = moveThroughRoom({ x: bay.doorX, z: -5.5 }, 0, -10, canMove);
    assert.equal(intoRoom.x, bay.doorX);
    assert(Math.abs(intoRoom.z + 15.5) < .001);
    const outOfRoom = moveThroughRoom(intoRoom, 0, 12, canMove);
    assert.equal(outOfRoom.x, bay.doorX);
    assert(Math.abs(outOfRoom.z + 3.5) < .001);
    assert(!canMove(bay.doorX + 2, -8), 'Corridor walls block movement');
    assert(!canMove(bay.doorX + 17, -8), 'An inactive entrance cannot enter the selected auditorium');
  }
});

test('only active entrances are passable and the counter, seating, and walls block movement', () => {
  const room = createFoyerLayout(stories(1));
  assert(canWalkFoyer(room, room.bays[0].doorX, -8));
  assert(!canWalkFoyer(room, room.bays[1].doorX, -8));
  assert(!canWalkFoyer(room, room.bays[0].posterX, -8));
  assert(!canWalkFoyer(room, room.maxX + 1, 0));
  assert(!canWalkFoyer(room, 0, room.maxZ + 1));
  assert(!canWalkFoyer(room, NaN, 0));
  assert(!canWalkFoyer(room, room.desk.minX + 1, 6));
  assert(!canWalkFoyer(room, -13, 3));
  assert(canWalkFoyer(room, 3, 10.8));
  assert(canWalkFoyer(room, -7.4, 6.4));
  const moved = moveThroughRoom({ x: room.desk.minX - 1, z: 6 }, 10, 0, (x, z) => canWalkFoyer(room, x, z));
  assert(moved.x <= room.desk.minX - .25, 'Fast movement cannot tunnel through the counter');
});
