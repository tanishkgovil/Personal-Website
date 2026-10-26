const escape = (text = '') => String(text).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
export { escape };

const heading = (scene) => `${scene.kicker ? `<p class="scene-kicker">${escape(scene.kicker)}</p>` : ''}${scene.title ? `<h2 class="scene-heading">${escape(scene.title)}</h2>` : ''}`;
const prose = (body) => {
  if (!body || (Array.isArray(body) && !body.length)) return '';
  return `<div class="prose-window"><div class="prose body-copy">${(Array.isArray(body) ? body : [body]).map((paragraph) => `<p>${escape(paragraph)}</p>`).join('')}</div></div>`;
};

export function renderCover(story, asset) {
  const cover = story.cover;
  return `<article class="cover${cover.image ? ' has-image' : ''}">${cover.image ? `<img class="cover-image" src="${escape(asset(cover.image))}" alt="${escape(cover.alt)}">` : ''}<div><h1>${escape(cover.title)}</h1>${cover.subtitle ? `<p class="cover-subtitle">${escape(cover.subtitle)}</p>` : ''}<button class="play-button" type="button" data-begin aria-label="Begin screening"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="m3 1 11 7-11 7z"/></svg>Play</button></div></article>`;
}

export function renderScene(scene, asset) {
  const theme = scene.theme === 'dark' ? ' dark' : '';
  switch (scene.type) {
    case 'text':
      return `<article class="scene-frame text-frame${theme}">${heading(scene)}${prose(scene.body)}</article>`;
    case 'split':
      return `<article class="scene-frame split-frame${theme}"><div class="split-copy">${heading(scene)}${prose(scene.body)}</div><img class="scene-image" src="${escape(asset(scene.image))}" alt="${escape(scene.alt)}"></article>`;
    case 'image':
      return `<article class="scene-frame image-frame"><img class="scene-image" src="${escape(asset(scene.image))}" alt="${escape(scene.alt)}">${scene.caption ? `<p class="image-caption">${escape(scene.caption)}</p>` : ''}</article>`;
    case 'video':
      return `<article class="scene-frame video-frame"><video class="scene-video" data-cinematic playsinline preload="metadata" src="${escape(asset(scene.src))}" aria-label="${escape(scene.title)}"${scene.poster ? ` poster="${escape(asset(scene.poster))}"` : ''}>${scene.captions ? `<track kind="captions" src="${escape(asset(scene.captions.src))}" srclang="${escape(scene.captions.language)}" label="${escape(scene.captions.label)}" default>` : ''}<a href="${escape(asset(scene.src))}">Open video</a></video>${scene.caption ? `<p class="video-caption">${escape(scene.caption)}</p>` : ''}</article>`;
    case 'quote':
      return `<article class="scene-frame quote-frame${theme}"><blockquote>${escape(scene.quote)}</blockquote>${scene.attribution ? `<p class="attribution">${escape(scene.attribution)}</p>` : ''}</article>`;
    case 'custom':
      return `<article class="scene-frame custom-frame${scene.fullBleed ? ' full-bleed' : ''}${theme}">${scene.fullBleed ? '' : heading(scene)}<div class="custom-mount"></div></article>`;
    default:
      throw new Error(`Unsupported scene type: ${scene.type}`);
  }
}
