# The cinema

`/theater/` opens into a spacious, warmly lit cinema foyer with numbered
entrances, illuminated posters, street windows, and a ticket counter. Click a
poster or its doors, or walk to an active entrance. Poster hover and keyboard
focus reveal a play symbol and a brighter frame. Aiming at the poster with
mouse look gives the same feedback on the physical poster.
The camera travels through that entrance into a seat,
house lights dim, and curtains open onto a **timed NYC film**. The
side sconces stay on; house lights return when the film finishes.

You can get up and explore during playback. WASD automatically leaves the fixed
view, or use the walking icon / R. Click any of the 50 chairs to watch from that
seat; R returns to the seat you last chose. Walk through the center aisle, row
gaps, side aisles, and rear doors without restarting the film. Sound gets quieter
as you move out into the lobby. The foyer and auditorium share camera coordinates
and depth, so open doors reveal the playing film and the new lobby in either
direction. The back arrow walks out through those same doors, preserving playback. Clicking the poster there takes you back to your
seat at the same playback position.

`/theater/#lobby` resets playback and returns to the foyer.
`/theater/#nyc` enters the screening directly. The original, longer presentation
with interactive work scenes remains at `/theater/screening.html#nyc` and is
linked after the film as “Explore this screening.” The personal homepage is unchanged.

## Moving and watching

| Action | Control |
| --- | --- |
| Walk anywhere | WASD or up/down arrows; joystick on touchscreens |
| Mouse look without holding a button | L, crosshair icon, or click empty space |
| Release cursor | Esc or L |
| Drag to pan | Drag right to look right; drag down to look down. Also works on touch |
| Stand / return to your seat | R or the walking icon |
| Pick a different seat | Click a chair |
| Enter | Click a poster/door, or look at it and press E |
| Pause/play the whole film | Space, transport button, or click the physical screen |
| Seek | Timeline, or left/right arrows while seated |
| Sound | Speaker icon or M |
| Focus on film / return to room | F |
| Walk back into lobby, keeping the film running | Rear doorway |
| Return to lobby, keeping playback | Back arrow or Escape with cursor released |

Transport controls fade while watching and reappear on movement, touch, or
pause. Clips have no embedded player UI. Sound is on by default. The timed film uses the supplied
footage's audio; there is no generated voice-over. Reduced motion skips the
camera journey and curtain movement. A direct canvas playback view is available
if WebGL cannot initialize. The page never needs vertical scrolling.

Preview from the repository root:

```sh
node theater/scripts/preview.mjs
```

Open <http://localhost:8000/theater/>. Pass a different port as an argument if needed.
The preview server supports byte ranges for accurate video seeking. Use a server
rather than opening the HTML file directly. No installation or build is required to view the theater. Three.js
0.180.0 is vendored locally with its MIT license; there are no runtime CDN or
external-font dependencies.

## Editing the timed film

`screenings/nyc/film.json` contains ordered shots and durations in seconds.
Media fills the projection by default. Each shot can set `x` and `y` from 0 to 1
(left/top through right/bottom), `rotation` in 90-degree steps, and `zoom` (1 or
greater). An optional `motion` object sets the ending `x`, `y`, and `zoom`; photos
otherwise have a subtle default push. `fit: "contain"` is available when preserving
the entire original matters. Clips also accept `trimStart`. `transition` sets the
incoming dissolve in seconds; use 0 for a cut. Reduced motion holds framing still.

For portrait footage, use `"fit": "contain", "backdrop": "ambient"`. The full
clip stays visible with a blurred, dim extension of that same video filling the
projection edges. One decoded video drives both layers; there is no duplicate
audio or second player. NYC uses this for all clips. The player advances
on a continuous clock, pauses during video buffering, supports seeking, and
pauses when the tab is hidden. The editable detailed screening is separate.

```json
{
  "id": "july-fourth",
  "type": "image",
  "src": "media/july-fourth.jpg",
  "duration": 4,
  "title": "July 4th."
}
```

A film accepts `image`, `video`, and `custom` shots. Custom drawing lives in the
screening folder's `film-scenes.js`; it exports `draw(context, shot, frame)`.
The NYC module draws the two timed work explanations; the final shot is an image. Add
`"film": "film.json"` to a screening's `screening.json`, then rebuild the catalog.
The catalog command validates the film timeline, framing, and its local assets too.

NYC’s crop and rotation settings live entirely in `nyc/film.json`. Its extended
scenes use the same framing calculation in `framing.mjs`. Published photos live in `nyc/media/`, converted to standard sRGB with optional
metadata removed. There are no source photo-library folders in the repository. Videos are derived at 720 × 1280 / 30 fps from the originals,
rather than enlarging the earlier 540-pixel copies.

“Explore this screening” opens the extended view. Its visible “Return to theater”
link restores the same film and playback position, including its finished state.

`world.js` owns the auditorium geometry, seat selection, camera journey,
curtains, and lighting. `foyer.js` renders the separate foyer scene with its own
lighting; both scenes render into the same depth buffer, so neither disappears at
the threshold. `foyer-layout.mjs` defines its bays, collisions, and movement speed.
Walking in the foyer is 6 units/second; the auditorium stays at 2.7. `film-player.js` owns the timed projection. `cinema.js`
connects the room, playback controls, navigation, and accessibility. Every timed film gets its own poster and numbered foyer entrance automatically.
There are at least three bays, with unused entrances marked Coming soon. More
stories expand the foyer. Each entrance has enough physical space behind it for the auditorium design,
playing its corresponding film; choosing another story swaps films without
reloading. The cinema’s frosted windows are independent of all screening artwork.
Shared player and room files contain no NYC media paths or story copy.

`navigation.mjs` defines the walkable layout, row gaps, doorways, floor levels,
and safe paths from seats into the aisles. Standing/walking/seating is independent
of film playback. Focused playback and the controls dialog suspend movement so
hidden key/joystick input cannot move the camera accidentally.

Run the dependency-free timeline, framing, and navigation checks with:

```sh
node --test theater/tests/*.test.mjs
```

## Editing the detailed screening

The sections below describe `screening.html`, the original scene-based player.
It uses arrows/dots to advance; longer prose paginates. `P` opens its program.

## Add a screening

Each screening is one self-contained folder. Copy the starter:

```sh
cp -R theater/templates/screening theater/screenings/my-story
```

The copied folder already contains a playable `film.json`, an extended
`screening.json`, and a placeholder illustration. Replace the illustration with
your media and edit those two JSON files, then refresh the catalog:

```sh
node theater/scripts/catalog.mjs
```

Its film opens at `/theater/#my-story`, and its extended view opens at
`/theater/screening.html#my-story`. Its cover becomes a new physical foyer
poster beside its numbered entrance. When there is more than one timed film, a
Screenings button also appears automatically. No player, renderer,
CSS, HTML, or manual registry edits are needed. Folder names and scene IDs use
lowercase words separated by hyphens. The catalog command checks story structure
and referenced files before writing `screenings/catalog.json`. Commit that
generated catalog with your screening when publishing. Static hosting cannot
discover folders at runtime, so rerun the command after adding/removing folders
or changing a title or cover.

```text
screenings/
  catalog.json           ← generated index
  nyc/
    screening.json       ← all copy and scene order
    media/                ← only the images and clips used by the screening
    batching.js          ← optional custom interaction
  my-story/
    screening.json
    photograph.jpg
```

## Scene types

A screening needs a `title`, a `cover` with a `title`, and a `scenes` array.
Scenes can appear in any order and use any IDs; no narrative structure is forced.

| Type | Content |
| --- | --- |
| `text` | Optional `title`, `body` as text or an array of paragraphs |
| `split` | Optional `title` and `body`, plus `image` and `alt` |
| `image` | `image`, `alt`, optional `caption` |
| `video` | `src`, descriptive `title`, optional `poster`, `caption`, `captions` |
| `quote` | `quote`, optional `attribution` |
| `custom` | Optional `title`, plus a local JS `module` |

Covers accept optional `image`, `alt`, and `subtitle`. Titles support newlines;
copy is plain text. Images are relative to their screening folder. Use
`theme: "dark"` on text, split, quote, or custom scenes for a darker background.
`kicker` is an optional small label. Keep unpublished notes outside the public
screening JSON; every committed file is readable on GitHub. Give each scene one main idea. The player paginates
longer text and split-scene prose at readable type sizes, without vertical scroll.

Direct links use `/theater/screening.html#folder/scene-id`, with an optional page
number such as `/theater/screening.html#folder/scene-id/2`. Browser back/forward also works.

## Videos

Put clips in the screening folder (subfolders are fine), then add a scene:

```json
{
  "id": "a-night-in-the-city",
  "type": "video",
  "title": "A night in the city",
  "src": "videos/night.mp4",
  "poster": "photos/night.jpg"
}
```

Videos play inline as part of the screening, with no native player chrome.
Sound starts enabled; the small speaker icon or `M` toggles it.
A direct link may require a click before the browser allows audio; playback
falls back to muted when necessary. Click the picture
or press Space to pause/resume. A finished clip advances to the next scene.
Leaving a scene pauses its video; opening the program pauses it until dismissal.
Photos and text still advance manually. Only the current scene's media loads.

An optional captions track uses WebVTT:

```json
"captions": { "src": "videos/night.vtt", "language": "en", "label": "English" }
```

## Screening-specific layouts

Set `"stylesheet": "nyc.css"` at the top of a screening's JSON to load its own
CSS. It loads before that screening appears and is removed when switching to
another screening. Assets referenced in CSS resolve relative to the CSS file.
The player exposes the screening folder name and current scene ID as hooks:

```css
#screen[data-screening="nyc"] #scene[data-scene="arrival"] .split-copy {
  padding: 12%;
}
```

Use the stylesheet for typography, colors, text/image placement, and responsive
overrides of built-in scenes. `screenings/nyc/nyc.css` is ready for your layouts.
For a bespoke collage, photo overlay, mixed video/text, or other composition,
use a custom module. Add `"fullBleed": true` to give it the entire screen, with
no built-in padding or heading. Its `title` still labels the navigation. Your
module and CSS can be coupled to that one scene; no generic layout system is
required. Keep the layout responsive so everything fits without scrolling.

## Custom interactions

Keep the module and its assets inside the screening folder. The module exports:

```js
export function mount(root, { scene, screening, asset, state }) {
  // root is beneath the title, or the whole screen with fullBleed: true.
  // asset('photo.jpg') resolves files relative to this screening.
  // state is an object retained when revisiting this scene.
  root.textContent = 'Your interaction';
  return () => {
    // Optional: remove global listeners, timers, or other resources.
  };
}
```

Use the available width/height and keep the interaction responsive. Scope any
styles to your component. The player calls cleanup on scene/screening changes
and ignores module loads from scenes that have already been left. See
`screenings/nyc/batching.js` for an example.

## Current draft

NYC uses selected photos and five clips, with short work explanations for
Heimdall and Caddy. Both the timed film and extended screening use only the
curated files in `screenings/nyc/media/`. Original photo-library exports, unused
clips and stills, archive download artifacts, and unpublished story notes have
been deleted. The homepage is unchanged.

The published JPEGs have standard sRGB colors baked into their pixels and carry
no EXIF, GPS, ICC, editing history, comments, or embedded thumbnails. Clips have
optional metadata and encoder user-data removed, capture/edit dates zeroed,
and no extra data tracks. Technical structure such as dimensions, duration,
codecs, and frame rate is required for playback.

`node --test theater/tests/*.test.mjs` also checks that every published NYC media
file is referenced, that drafts and source folders are absent, and that the
JPEGs and MP4 containers stay free of optional metadata. Apply the same cleanup
before adding new personal media. The existing `/private/` ignore rule excludes
local background files. The theater has `noindex` until publication.
