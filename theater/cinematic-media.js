// A clip is part of the screening, rather than an embedded video player.
let soundEnabled = true;

export function mountCinematicMedia(root, { soundButton, onEnded }) {
  const video = root.querySelector('video[data-cinematic]');
  soundButton.hidden = !video;
  if (!video) return () => {};
  let disposed = false;
  const updateSound = () => {
    video.muted = !soundEnabled;
    soundButton.setAttribute('aria-pressed', String(soundEnabled));
    soundButton.setAttribute('aria-label', soundEnabled ? 'Mute sound' : 'Enable sound');
    soundButton.title = `${soundEnabled ? 'Mute' : 'Enable sound'} (M)`;
    soundButton.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4z"/>${soundEnabled ? '<path d="M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>' : '<path d="m16 9 5 6m0-6-5 6"/>'}</svg>`;
  };
  const play = () => {
    video.play().catch((error) => {
      if (disposed || error.name !== 'NotAllowedError' || video.muted) return;
      soundEnabled = false;
      updateSound();
      video.play().catch(() => {});
    });
  };
  const toggleSound = () => { soundEnabled = !soundEnabled; updateSound(); if (video.paused) play(); };
  const togglePlayback = () => { if (video.paused) play(); else video.pause(); };
  const ended = () => { if (!disposed) onEnded(); };
  video.controls = false;
  video.tabIndex = 0;
  video.title = 'Click to pause or resume · Space';
  video.addEventListener('click', togglePlayback);
  video.addEventListener('ended', ended);
  soundButton.addEventListener('click', toggleSound);
  updateSound();
  play();
  return () => {
    disposed = true;
    video.pause();
    video.removeEventListener('click', togglePlayback);
    video.removeEventListener('ended', ended);
    soundButton.removeEventListener('click', toggleSound);
    soundButton.hidden = true;
  };
}
