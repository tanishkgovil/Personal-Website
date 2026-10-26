// Physical layout shared by walking, seating, and the auditorium geometry.
export const seatRows = Array.from({ length: 5 }, (_, row) => ({ row, z: -11.7 - row * 2.2, level: (5 - row) * .12 }));
export const seats = seatRows.flatMap(({ row, z, level }) => [-1, 1].flatMap((side) => Array.from({ length: 5 }, (_, column) => ({
  id: row * 10 + (side === 1 ? 5 : 0) + column, row, column, x: side * (1.35 + column * 1.02), z, level,
}))));

export function zoneAt(z) { return z > -6.6 ? 'lobby' : z > -9.35 ? 'corridor' : 'auditorium'; }

export function floorHeight(z) {
  if (z > -9.3) return 0;
  if (z > -10.6) return Math.min(.6, Math.ceil((-z - 9.3) / .44) * .2);
  for (const row of seatRows) if (z >= row.z - 1.1) return row.level;
  return 0;
}

function inside(x, z, minX, maxX, minZ, maxZ, radius) {
  return x > minX - radius && x < maxX + radius && z > minZ - radius && z < maxZ + radius;
}

export function canWalk(x, z, radius = .23) {
  if (!Number.isFinite(x) || !Number.isFinite(z) || Math.abs(x) > 6.5 || z > 5.1 || z < -25.35) return false;
  // Both doorways and the corridor are narrower than the rooms.
  if (z < -6.55 && z > -9.6 && Math.abs(x) > 1.08) return false;
  if (z >= -6.55) {
    if (inside(x, z, 2.85, 6.55, -1.28, .08, radius)) return false;
    if (inside(x, z, -6.7, -5.8, -.8, 2.4, radius)) return false;
  }
  for (const row of seatRows) {
    if (inside(x, z, .9, 5.9, row.z - .62, row.z + .48, radius)) return false;
    if (inside(x, z, -5.9, -.9, row.z - .62, row.z + .48, radius)) return false;
  }
  return true;
}

export function moveThroughRoom(position, dx, dz, canMove = canWalk) {
  let { x, z } = position;
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / .08));
  for (let step = 0; step < steps; step++) {
    if (canMove(x + dx / steps, z)) x += dx / steps;
    if (canMove(x, z + dz / steps)) z += dz / steps;
  }
  return { x, z };
}

export function standPosition(position) {
  const row = seatRows.reduce((nearest, candidate) => Math.abs(candidate.z - position.z) < Math.abs(nearest.z - position.z) ? candidate : nearest);
  // Leave the seat through the gap in front of its row, then join an aisle.
  const z = canWalk(position.x, position.z) ? position.z : row.z - 1.05;
  const x = Math.abs(position.x) > 3.5 ? Math.sign(position.x) * 6.3 : 0;
  return { x, z, gapX: position.x, y: floorHeight(z) + 1.72 };
}
