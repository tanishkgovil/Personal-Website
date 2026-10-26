// Checked against the internship commit 29e21e9, before the custom-label prototype.
// The HAProxy comparison is Tanishk's description of the project's goal.
const branch = 'https://github.com/tanishkgovil/caddy/blob/hrt-internship/';
export const caddyProject = {
  summary: 'I added monitoring to Caddy, which handles website traffic.',
  overview: 'Engineers can see how busy their servers are, where requests slow down, and what fails.',
  areas: [
    { label: 'Traffic', title: 'Connections and traffic.', body: 'Open connections, transferred bytes, upstream requests, and response status codes.', examples: 'current_connections · upstream_sent_bytes_total', source: branch + 'modules/caddyhttp/reverseproxy/metrics.go' },
    { label: 'Timing', title: 'Where the time goes.', body: 'DNS resolution, connection setup, TLS handshakes, and time to first response byte.', examples: 'upstream_dns_resolution_duration_seconds · upstream_tls_handshake_duration_seconds', source: branch + 'modules/caddyhttp/reverseproxy/reverseproxy.go' },
    { label: 'Failures', title: 'When things fail.', body: 'Health-check failures, retries, redispatches, and client or upstream disconnects.', examples: 'upstream_retries_total · upstream_server_aborts_total', source: branch + 'modules/caddyhttp/reverseproxy/metrics.go' },
    { label: 'More', title: 'Beyond the reverse proxy.', body: 'Certificate lifecycles, compression, storage operations, and event dispatch also got metrics.', examples: 'compression_compressed_bytes_total · cert_failed_total', source: branch + 'modules/caddytls/metrics.go' },
  ],
  phases: [
    ['Traffic.', 'How busy each server is.'],
    ['Speed.', 'Where requests slow down.'],
    ['Failures.', 'Which requests fail, and how often.'],
  ],
  trackerSource: branch + 'metrics_tracker.go',
};
