const mix = (a, b, t) => a + (b - a) * t;

// Framing is in the displayed orientation. x/y run from left/top (0) to
// right/bottom (1), like object-position. Originals never need to be rewritten.
export function mediaFrame(sourceWidth, sourceHeight, shot, progress, width = 1280, height = 720) {
  const rotation = shot.rotation ?? 0;
  const sideways = Math.abs(rotation % 180) === 90;
  const orientedWidth = sideways ? sourceHeight : sourceWidth;
  const orientedHeight = sideways ? sourceWidth : sourceHeight;
  const cover = shot.fit !== 'contain';
  const zoom = mix(shot.zoom ?? 1, shot.motion?.zoom ?? (shot.type === 'image' && cover ? 1.025 : shot.zoom ?? 1), progress);
  const scale = (cover ? Math.max : Math.min)(width / orientedWidth, height / orientedHeight) * zoom;
  const framedWidth = orientedWidth * scale, framedHeight = orientedHeight * scale;
  return {
    rotation, width: framedWidth, height: framedHeight,
    drawWidth: sourceWidth * scale, drawHeight: sourceHeight * scale,
    x: (width - framedWidth) * mix(shot.x ?? .5, shot.motion?.x ?? shot.x ?? .5, progress),
    y: (height - framedHeight) * mix(shot.y ?? .5, shot.motion?.y ?? shot.y ?? .5, progress),
  };
}

export function drawMedia(context, source, shot, progress, width, height) {
  const sourceWidth = source.videoWidth || source.naturalWidth;
  const sourceHeight = source.videoHeight || source.naturalHeight;
  if (!sourceWidth || !sourceHeight) return;
  const frame = mediaFrame(sourceWidth, sourceHeight, shot, progress, width, height);
  context.save();
  context.translate(frame.x + frame.width / 2, frame.y + frame.height / 2);
  context.rotate(frame.rotation * Math.PI / 180);
  context.drawImage(source, -frame.drawWidth / 2, -frame.drawHeight / 2, frame.drawWidth, frame.drawHeight);
  context.restore();
}

// Decode the clip once. Its soft, dark projection fills the edges while the
// original portrait frame remains sharp and complete in front of it.
export function createBackdropRenderer() {
  const buffer = document.createElement('canvas');
  const background = buffer.getContext('2d', { alpha: false });
  return (context, source, shot, width, height) => {
    if (!(source.videoWidth || source.naturalWidth)) return;
    const bufferHeight = Math.round(320 * height / width);
    if (buffer.width !== 320 || buffer.height !== bufferHeight) { buffer.width = 320; buffer.height = bufferHeight; }
    background.filter = 'none'; background.fillStyle = '#080d12'; background.fillRect(0, 0, buffer.width, buffer.height);
    background.filter = 'blur(12px)';
    drawMedia(background, source, { rotation: shot.rotation, fit: 'cover', zoom: 1.25 }, 0, buffer.width, buffer.height);
    background.filter = 'none';
    context.drawImage(buffer, 0, 0, width, height);
    context.fillStyle = '#03080c80'; context.fillRect(0, 0, width, height);
    const shade = context.createRadialGradient(width / 2, height / 2, height * .15, width / 2, height / 2, width * .65);
    shade.addColorStop(0, '#03080c00'); shade.addColorStop(1, '#03080c99');
    context.fillStyle = shade; context.fillRect(0, 0, width, height);
  };
}
