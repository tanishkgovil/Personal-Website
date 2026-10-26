import test from 'node:test';
import assert from 'node:assert/strict';
import { seats, seatRows, zoneAt, floorHeight, canWalk, moveThroughRoom, standPosition } from '../navigation.mjs';

test('the center aisle, side aisles, and every row gap are walkable', () => {
  for (const row of seatRows) {
    assert(canWalk(0, row.z));
    assert(canWalk(6.3, row.z));
    assert(canWalk(-6.3, row.z));
    assert(canWalk(3, row.z - 1.05));
  }
  assert(canWalk(0, -8));
  assert(!canWalk(2, -8));
});

test('walking cannot tunnel through seats, furniture, walls, or the screen', () => {
  assert(!canWalk(1.35, -16.1));
  assert(!canWalk(4.7, -.6));
  assert(!canWalk(-6.2, .8));
  assert(!canWalk(7, -20));
  assert(!canWalk(0, -27));
  const intoRow = moveThroughRoom({ x: 3, z: -17.2 }, 0, 10);
  assert(intoRow.z < -16.9);
  const throughWall = moveThroughRoom({ x: 5, z: -5 }, 0, -20);
  assert(throughWall.z > -6.6);
});

test('every seat has a safe route to an aisle when standing up', () => {
  assert.equal(seats.length, 50);
  assert.equal(new Set(seats.map((seat) => seat.id)).size, 50);
  for (const seat of seats) {
    const standing = standPosition(seat);
    assert(canWalk(standing.x, standing.z), `seat ${seat.id}`);
    assert(canWalk(standing.gapX, standing.z), `row gap for seat ${seat.id}`);
    assert(standing.y > floorHeight(standing.z));
  }
});

test('floor height follows the steps and zones connect through the corridor', () => {
  assert.equal(floorHeight(0), 0);
  assert(floorHeight(-10.4) > floorHeight(-9.5));
  assert(floorHeight(-12) > floorHeight(-19));
  assert.equal(zoneAt(0), 'lobby');
  assert.equal(zoneAt(-8), 'corridor');
  assert.equal(zoneAt(-16), 'auditorium');
});
