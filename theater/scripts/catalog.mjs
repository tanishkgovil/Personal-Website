import { readdir, readFile, writeFile, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { validateScreening } from '../schema.mjs';
import { buildTimeline } from '../film-schema.mjs';

// A static host cannot list folders. Generate a tiny index when adding a film;
// viewing the theater still requires no build or server-side code.
const root = new URL('../screenings/', import.meta.url);
const folders = (await readdir(root, { withFileTypes: true })).filter((entry) => entry.isDirectory()).sort((a, b) => a.name.localeCompare(b.name));
const catalog = [];
for (const folder of folders) {
  const base = new URL(`${folder.name}/`, root);
  const story = validateScreening(JSON.parse(await readFile(new URL('screening.json', base), 'utf8')), folder.name);
  const files = [story.cover.image, story.stylesheet, story.lobby?.image, story.lobby?.entranceImage, ...story.scenes.flatMap((scene) => [scene.image, scene.module, scene.src, scene.poster, scene.captions?.src, ...(scene.media ?? []).flatMap(item => [item.src, item.poster])])].filter(Boolean);
  let duration;
  if (story.film) {
    files.push(story.film);
    const film = buildTimeline(JSON.parse(await readFile(new URL(story.film, base), 'utf8')));
    duration = film.duration;
    files.push(...film.shots.map((shot) => shot.src).filter(Boolean));
    if (film.module) files.push(film.module);
  }
  for (const file of files) {
    try { await access(new URL(file, base)); }
    catch { throw new Error(`${folder.name}: missing file ${file}`); }
  }
  catalog.push({ slug: folder.name, title: story.title, cover: story.cover, ...(story.lobby ? { lobby: story.lobby } : {}), ...(story.film ? { film: story.film, duration } : {}) });
}
if (!catalog.length) throw new Error('Add at least one screening folder.');
const destination = new URL('catalog.json', root);
await writeFile(destination, `${JSON.stringify(catalog, null, 2)}\n`);
console.log(`Indexed ${catalog.length} screening${catalog.length === 1 ? '' : 's'} → ${fileURLToPath(destination)}`);
