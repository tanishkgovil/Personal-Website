const types = new Set(['text', 'split', 'image', 'video', 'quote', 'custom']);
export const validSlug = (value) => typeof value === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);

export function validateScreening(story, slug) {
  const fail = (message) => { throw new Error(`${slug}: ${message}`); };
  const text = (value) => typeof value === 'string' && value.trim().length > 0;
  const localFile = (value) => text(value) && !/^(?:[a-z]+:|\/|\\)/i.test(value) && !value.split(/[\/\\]/).includes('..');
  if (!validSlug(slug)) fail('use a lowercase, hyphen-separated folder name');
  if (!story || !text(story.title)) fail('title is required');
  if (!story.cover || !text(story.cover.title)) fail('cover.title is required');
  if (story.cover.image && (!localFile(story.cover.image) || !text(story.cover.alt))) fail('cover images need a local filename and alt text');
  if (story.stylesheet && (!localFile(story.stylesheet) || !story.stylesheet.endsWith('.css'))) fail('stylesheet must be a local CSS file');
  if (story.film && (!localFile(story.film) || !story.film.endsWith('.json'))) fail('film must be a local JSON file');
  if (story.lobby) for (const key of ['image', 'entranceImage']) {
    if (story.lobby[key] !== undefined && !localFile(story.lobby[key])) fail(`lobby.${key} must be a local image`);
  }
  if (!Array.isArray(story.scenes) || !story.scenes.length) fail('add at least one scene');
  const ids = new Set();
  for (const scene of story.scenes) {
    if (!validSlug(scene.id) || ids.has(scene.id)) fail(`scene IDs must be unique slugs: ${scene.id}`);
    ids.add(scene.id);
    if (!types.has(scene.type)) fail(`unknown scene type: ${scene.type}`);
    if (scene.title !== undefined && !text(scene.title)) fail(`${scene.id}: title must be nonempty`);
    if (scene.body !== undefined && !(text(scene.body) || (Array.isArray(scene.body) && scene.body.every(text)))) fail(`${scene.id}: body must be text or an array of paragraphs`);
    if (scene.type === 'text' && !text(scene.title) && !scene.body) fail(`${scene.id}: add a title or body`);
    if (scene.type === 'quote' && !text(scene.quote)) fail(`${scene.id}: quote is required`);
    if (scene.type === 'image' || scene.type === 'split') {
      if (!localFile(scene.image) || !text(scene.alt)) fail(`${scene.id}: image scenes need a local filename and alt text`);
    }
    if (scene.type === 'custom' && (!localFile(scene.module) || !/\.m?js$/.test(scene.module))) fail(`${scene.id}: custom scenes need a local JS module`);
    if (scene.fullBleed !== undefined && typeof scene.fullBleed !== 'boolean') fail(`${scene.id}: fullBleed must be true or false`);
    if (scene.type === 'video') {
      if (!localFile(scene.src) || !text(scene.title)) fail(`${scene.id}: video scenes need a local src and a descriptive title`);
      if (scene.poster && !localFile(scene.poster)) fail(`${scene.id}: poster must be a local image`);
      if (scene.captions && (!localFile(scene.captions.src) || !text(scene.captions.language) || !text(scene.captions.label))) fail(`${scene.id}: captions need src, language, and label`);
    }
    if (scene.theme && !['paper', 'dark'].includes(scene.theme)) fail(`${scene.id}: theme must be paper or dark`);
  }
  return story;
}
