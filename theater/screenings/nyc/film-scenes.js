// The NYC film owns these explanations; other screenings need no custom code.
import { caddyProject } from './caddy-project.js';
const night = '#0c1218', ink = '#eee5d1', muted = '#b7ad98', gold = '#c6aa76';
function text(ctx, value, x, y, size = 28, color = ink, face = 'Arial, sans-serif') {
  ctx.fillStyle = color; ctx.font = `${size}px ${face}`; ctx.fillText(value, x, y);
}
function wrap(ctx, value, x, y, size, maxWidth, lineHeight, color = ink) {
  ctx.fillStyle = color; ctx.font = `${size}px Arial, sans-serif`;
  let line = '';
  for (const word of value.split(' ')) {
    const candidate = `${line} ${word}`.trim();
    if (line && ctx.measureText(candidate).width > maxWidth) { ctx.fillText(line, x, y); line = word; y += lineHeight; }
    else line = candidate;
  }
  ctx.fillText(line, x, y);
}

export function draw(ctx, shot, { progress, width, height, compact }) {
  ctx.fillStyle = night; ctx.fillRect(0, 0, width, height);
  const light = ctx.createRadialGradient(1040, 0, 0, 1000, 0, 1100);
  light.addColorStop(0, '#9e81531c'); light.addColorStop(1, '#9e815300');
  ctx.fillStyle = light; ctx.fillRect(0, 0, width, height);
  if (shot.key === 'heimdall') {
    const phase = Math.min(3, Math.floor(progress * 4));
    const headings = ['Read the diff.', 'Gather context.', 'Check the fix.', 'Stream feedback.'];
    const details = ['Gerrit patches and review comments.', 'Ten tools for inspecting the repository.', 'Linters and tests in isolated Git worktrees.', 'First visible token in under two seconds.'];
    text(ctx, 'Heimdall', 80, 135, compact ? 84 : 70, ink, 'Georgia, serif');
    text(ctx, 'I built an AI code-review agent for Gerrit.', 84, 205, compact ? 44 : 31, muted);
    for (let index = 0; index < 4; index++) {
      ctx.fillStyle = index <= phase ? gold : '#41403a';
      ctx.fillRect(84 + index * 280, 293, 248, 3);
    }
    text(ctx, `0${phase + 1}`, 84, 380, 30, gold);
    text(ctx, headings[phase], 84, 475, compact ? 69 : 64);
    wrap(ctx, details[phase], 84, 560, compact ? 47 : 36, 1100, 58, muted);
    return;
  }
  if (shot.key === 'caddy') {
    const phase = Math.min(2, Math.floor(progress * 3));
    text(ctx, 'Caddy', 80, 125, compact ? 84 : 70, ink, 'Georgia, serif');
    wrap(ctx, caddyProject.summary, 84, 195, compact ? 43 : 34, 1100, 55, muted);
    const positions = [110, 640, 1160], labels = ['Visitors', 'Caddy', 'Website'];
    ctx.strokeStyle = '#b7ad9855'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(positions[0], 330); ctx.lineTo(positions[2], 330); ctx.stroke();
    positions.forEach((x, index) => {
      ctx.fillStyle = index === 1 ? gold : muted; ctx.beginPath(); ctx.arc(x, 330, index === 1 ? 8 : 5, 0, Math.PI * 2); ctx.fill();
      ctx.textAlign = index === 0 ? 'left' : index === 2 ? 'right' : 'center';
      text(ctx, labels[index], x, 295, compact ? 38 : 26, muted);
    });
    ctx.textAlign = 'left';
    const pulse = positions[0] + (positions[2] - positions[0]) * ((progress * 3) % 1);
    ctx.fillStyle = ink; ctx.beginPath(); ctx.arc(pulse, 330, 5, 0, Math.PI * 2); ctx.fill();
    text(ctx, caddyProject.phases[phase][0], 84, 465, compact ? 62 : 56);
    wrap(ctx, caddyProject.phases[phase][1], 84, 545, compact ? 45 : 33, 1110, 55, muted);
    return;
  }
  throw new Error(`Unknown NYC film scene: ${shot.key}`);
}
