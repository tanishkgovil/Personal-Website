import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, access } from 'node:fs/promises';

const base = new URL('../screenings/nyc/', import.meta.url);
const mediaExtension = /\.(?:jpe?g|png|gif|webp|avif|svg|mp4|mov|webm|mp3|m4a|wav|ogg|vtt)$/i;
async function references() {
  const paths = new Set();
  const collect = value => {
    if (typeof value === 'string' && mediaExtension.test(value)) paths.add(value);
    else if (Array.isArray(value)) value.forEach(collect);
    else if (value && typeof value === 'object') Object.values(value).forEach(collect);
  };
  for (const name of ['screening.json', 'film.json']) collect(JSON.parse(await readFile(new URL(name, base), 'utf8')));
  return paths;
}
async function mediaFiles(directory, prefix = '') {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = prefix + entry.name;
    if (entry.isDirectory()) files.push(...await mediaFiles(new URL(`${entry.name}/`, directory), `${path}/`));
    else if (mediaExtension.test(path)) files.push(path);
  }
  return files;
}

test('published NYC media contains exactly what the two presentations use', async () => {
  const used = await references();
  assert.deepEqual(new Set(await mediaFiles(base)), used);
  for (const path of used) {
    assert(path.startsWith('media/'), path);
    await access(new URL(path, base));
  }
  const story = JSON.parse(await readFile(new URL('screening.json', base), 'utf8'));
  assert(!Object.hasOwn(story, 'authorNotes'), 'Draft notes are not public content');
  const entries = await readdir(base);
  assert(!entries.includes('iCloud Photos'));
  assert(!entries.includes('STORY_NOTES.md'));
});

test('published JPEGs contain no EXIF, GPS, profiles, thumbnails, or comments', async () => {
  for (const path of await references()) {
    if (!/\.jpe?g$/i.test(path)) continue;
    const data = await readFile(new URL(path, base));
    assert.equal(data.readUInt16BE(0), 0xffd8, path);
    let offset = 2;
    while (offset < data.length) {
      assert.equal(data[offset++], 0xff, path);
      while (data[offset] === 0xff) offset++;
      const marker = data[offset++];
      if (marker === 0xda || marker === 0xd9) break;
      assert(!(marker >= 0xe0 && marker <= 0xef) && marker !== 0xfe, `Optional metadata in ${path}`);
      const length = data.readUInt16BE(offset);
      assert(length >= 2 && offset + length <= data.length, path);
      offset += length;
    }
  }
});

function inspectAtoms(data, start, end, path) {
  let offset = start;
  while (offset + 8 <= end) {
    let size = data.readUInt32BE(offset), header = 8;
    const type = data.toString('ascii', offset + 4, offset + 8);
    if (size === 1) { size = Number(data.readBigUInt64BE(offset + 8)); header = 16; }
    else if (size === 0) size = end - offset;
    assert(size >= header && offset + size <= end, `${path}: invalid ${type} atom`);
    const body = offset + header;
    assert(!['udta', 'meta', 'uuid'].includes(type), `${path}: optional ${type} metadata`);
    if (['moov', 'trak', 'mdia', 'minf', 'stbl'].includes(type)) inspectAtoms(data, body, offset + size, path);
    if (['mvhd', 'tkhd', 'mdhd'].includes(type)) {
      const length = data[body] === 1 ? 16 : 8;
      assert(data.subarray(body + 4, body + 4 + length).every(byte => byte === 0), `${path}: embedded capture/edit date`);
    }
    if (type === 'hdlr') assert(data.subarray(body + 24, offset + size).every(byte => byte === 0), `${path}: optional handler label`);
    offset += size;
  }
  assert.equal(offset, end, path);
}

test('published clips have no optional metadata containers, handler labels, or capture dates', async () => {
  for (const path of await references()) {
    if (!path.endsWith('.mp4')) continue;
    const data = await readFile(new URL(path, base));
    inspectAtoms(data, 0, data.length, path);
  }
});
