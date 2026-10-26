// A self-contained optional scene. The player knows nothing about batching.
// mount() may return cleanup; state persists while visiting other scenes.
export function mount(root, { state }) {
  root.innerHTML = `<style>
    .batching { height:100%; min-height:0; display:flex; flex-direction:column; justify-content:center; gap:clamp(14px,4cqh,35px); color:#505b40; }
    .batching p { font-size:clamp(14px,1.65cqw,20px); line-height:1.4; }
    .batching-settings { display:flex; align-items:center; gap:16px; font-size:12px; }
    .batching-settings input { accent-color:#5d6e45; flex:1; min-width:40px; max-width:280px; height:28px; }
    .batching-settings output { font:13px var(--mono); width:14px; }
    .batching-requests { display:flex; gap:5px; width:100%; }
    .batching-group { display:flex; flex:1; gap:3px; padding:5px 3px; border:1px solid #9b9e8077; border-radius:3px; min-width:0; }
    .batching-request { flex:1; min-width:0; height:16px; background:#707d58; border-radius:1px; }
    .batching-metrics { display:grid; grid-template-columns:1fr 1fr; gap:20px; padding-top:15px; border-top:1px solid #a8ad9166; }
    .batching-metric { display:flex; align-items:baseline; gap:12px; }
    .batching-metric strong { font:clamp(26px,4cqw,46px)/1.1 var(--serif); color:#39472f; letter-spacing:-.04em; white-space:nowrap; }
    .batching-metric span { font-size:12px; }
    .batching .batching-model { font-size:11px; color:#6a7158; }
    @media(max-width:600px) and (orientation:portrait) {
      .batching { gap:clamp(16px,4cqh,30px); }.batching-settings { gap:8px; font-size:11px; }.batching-metric { flex-direction:column; gap:8px; }.batching-metric strong { font-size:32px; }.batching-metric span { font-size:11px; }.batching-request { height:14px; }.batching-group { gap:2px; padding:4px 2px; }.batching-requests { gap:3px; }.batching .batching-model { font-size:10px; }
    }
    @media(max-height:500px) { .batching { gap:10px; }.batching p { font-size:13px; }.batching-settings { font-size:10px; }.batching-metrics { padding-top:8px; }.batching-metric strong { font-size:25px; }.batching-metric span { font-size:10px; }.batching-request { height:10px; }.batching-group { padding:3px 2px; }.batching .batching-model { font-size:9px; } }
  </style><div class="batching"><p>Less sending. More waiting.</p><div class="batching-settings"><label for="batch-size">Batch size</label><input id="batch-size" type="range" min="0" max="3" step="1" value="0" aria-describedby="batching-model"><output id="batch-value" for="batch-size">1</output></div><div class="batching-requests" id="requests" role="img"></div><div class="batching-metrics" aria-live="polite" aria-atomic="true"><div class="batching-metric"><strong id="wait-value"></strong><span>average wait</span></div><div class="batching-metric"><strong id="dispatch-value"></strong><span>dispatches</span></div></div><p class="batching-model" id="batching-model">Toy model · 16 requests, 100 ms apart. Full batches dispatch immediately.</p></div>`;
  const sizes = [1, 2, 4, 8];
  const slider = root.querySelector('input');
  slider.value = sizes.indexOf(state.batchSize ?? 1);
  const update = () => {
    const batch = sizes[Number(slider.value)];
    state.batchSize = batch;
    const dispatches = 16 / batch;
    const wait = (batch - 1) * 50;
    slider.setAttribute('aria-valuetext', `${batch} requests per batch`);
    root.querySelector('#batch-value').value = batch;
    root.querySelector('#wait-value').textContent = `${wait} ms`;
    root.querySelector('#dispatch-value').textContent = String(dispatches);
    const requests = root.querySelector('#requests');
    requests.setAttribute('aria-label', `16 requests in ${dispatches} batches. Average wait ${wait} milliseconds.`);
    requests.innerHTML = Array.from({ length: dispatches }, () => `<span class="batching-group" aria-hidden="true">${'<span class="batching-request"></span>'.repeat(batch)}</span>`).join('');
  };
  slider.addEventListener('input', update);
  update();
  return () => slider.removeEventListener('input', update);
}
