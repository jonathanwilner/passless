import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

const cwd = new URL('../', import.meta.url);
function probe(code, env = {}) {
  return spawnSync(process.execPath, ['--input-type=module', '-e', code], {
    cwd, env: { ...process.env, RP_ID: 'tv.thewilners.com', RP_ORIGIN: 'https://tv.thewilners.com:8443', LAB_TOKEN: 'synthetic-lab-token', ...env }, encoding: 'utf8', timeout: 10000,
  });
}
test('remote RP requires exact HTTPS origin matching RP ID', () => {
  for (const origin of ['http://tv.thewilners.com:8443', 'https://unrelated.example', '']) {
    const result = probe("await import('./server.js')", { RP_ORIGIN: origin });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /exact matching HTTPS/);
  }
});
test('remote lab access and origin checks protect APIs', () => {
  const result = probe(`
    import assert from 'node:assert/strict';
    const {startServer} = await import('./server.js');
    const server = startServer(0);
    await new Promise(resolve => server.on('listening', resolve));
    const base = 'http://127.0.0.1:' + server.address().port;
    try {
      assert.equal((await fetch(base + '/api/status')).status, 403);
      assert.equal((await fetch(base + '/api/status', {headers:{Authorization:'Bearer synthetic-lab-token', Origin:'https://evil.example'}})).status, 403);
      const allowed = await fetch(base + '/api/status', {headers:{Authorization:'Bearer synthetic-lab-token'}});
      assert.equal(allowed.status, 200);
      assert.equal((await allowed.json()).rp_id, 'tv.thewilners.com');
      const enter = await fetch(base + '/enter?token=synthetic-lab-token', {redirect:'manual'});
      assert.equal(enter.status, 303);
      assert.match(enter.headers.get('set-cookie'), /HttpOnly; Secure; SameSite=Strict/);
    } finally { server.closeAllConnections(); server.close(); }
  `);
  assert.equal(result.status, 0, result.stderr);
});
test('non-loopback startup fails without TLS', () => {
  const result = probe("const {startServer} = await import('./server.js'); startServer(0, '0.0.0.0')");
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /requires LAB_TOKEN and TLS/);
});
