import { canWalk } from './navigation.mjs';

export const foyerWalkSpeed = 6;

export function createFoyerLayout(screenings) {
  const count = Math.max(3, screenings.length);
  const bays = Array.from({ length: count }, (_, index) => ({
    index, number: String(index + 1).padStart(2, '0'), screening: screenings[index],
    x: -9 + index * 17, doorX: -7.6 + index * 17, posterX: -11.1 + index * 17,
  }));
  // Each entrance has room for a full-width auditorium behind it.
  const maxX = bays.at(-1).doorX + 8.5;
  return {
    bays, minX: -16.1, maxX, minZ: -8.4, maxZ: 13.4,
    desk: { minX: maxX - 6.4, maxX: maxX - .7, minZ: 5.7, maxZ: 7.3 },
    benches: [{ minX: -13.6, maxX: -12.35, minZ: 1, maxZ: 5 }],
  };
}

export function canWalkFoyer(layout, x, z, radius = .25) {
  if (!Number.isFinite(x) || !Number.isFinite(z) || x < layout.minX + .45 || x > layout.maxX - .45 || z < layout.minZ || z > layout.maxZ) return false;
  if (z < -6.35 && !layout.bays.some(bay => bay.screening && Math.abs(x - bay.doorX) < .94)) return false;
  for (const item of [layout.desk, ...layout.benches]) {
    if (x > item.minX - radius && x < item.maxX + radius && z > item.minZ - radius && z < item.maxZ + radius) return false;
  }
  return true;
}

// Positions stay in world coordinates on both sides of the same doorway.
export function canWalkCinema(layout, roomX, x, z) {
  return z >= -6.35 ? canWalkFoyer(layout, x, z) : canWalk(x - roomX, z);
}
