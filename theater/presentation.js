// The opening belongs to the room, so every screening gets the same treatment.
const pause = (milliseconds, signal) => new Promise((resolve, reject) => {
  const abort = () => { clearTimeout(timer); reject(signal.reason); };
  const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, milliseconds);
  signal.addEventListener('abort', abort, { once: true });
  if (signal.aborted) abort();
});

export function createPresentation({ screen, curtains, controls }) {
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let session;

  const reset = () => {
    curtains.classList.add('is-resetting');
    curtains.classList.remove('is-closed');
    void curtains.offsetWidth;
    curtains.classList.remove('is-resetting');
    document.body.classList.remove('is-opening', 'is-revealing');
    screen.inert = false;
    controls.inert = false;
    screen.setAttribute('aria-busy', 'false');
  };

  const cancel = () => {
    session?.controller.abort('cancel');
    session = undefined;
    reset();
  };

  const skip = () => session?.controller.abort('skip');
  reducedMotion.addEventListener('change', () => { if (reducedMotion.matches) skip(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) skip(); });

  return {
    get running() { return Boolean(session); },
    cancel,
    skip,
    setPlaying(playing) { document.body.classList.toggle('is-playing', playing); },
    async play(reveal) {
      if (session) return;
      document.body.classList.add('is-playing');
      if (reducedMotion.matches) { await reveal(); return; }
      const opening = { controller: new AbortController() };
      const { signal } = opening.controller;
      session = opening;
      let revealed;
      const revealOnce = () => revealed ??= Promise.resolve(reveal());
      document.body.classList.add('is-opening');
      screen.inert = true;
      controls.inert = true;
      screen.setAttribute('aria-busy', 'true');
      curtains.classList.add('is-closed');
      try {
        await pause(650, signal);
        await revealOnce();
        if (signal.aborted) throw signal.reason;
        screen.setAttribute('aria-busy', 'true');
        await pause(180, signal);
        document.body.classList.add('is-revealing');
        curtains.classList.remove('is-closed');
        await pause(1450, signal);
      } catch (reason) {
        if (reason === 'skip') { if (session === opening) await revealOnce(); }
        else if (reason !== 'cancel') throw reason;
      } finally {
        if (session === opening) { session = undefined; reset(); }
      }
    },
  };
}
