import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { startServer } from '../server.js';

test('client observations cannot manufacture verified authentication', async () => {
  const server = startServer(0);
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = (path, body) => fetch(base + path, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body)});
  try {
    assert.equal((await post('/api/compatibility', {device:'test', message:'AUTH OK', ok:true})).status, 200);
    assert.equal((await post('/api/compatibility', {device:'test', message:'x'.repeat(4097)})).status, 400);
    let result = await (await fetch(base+'/api/compatibility')).json();
    assert.equal(result.observations.at(-1).message, 'AUTH OK');
    assert.deepEqual(result.verifiedEvents, []);
    await post('/api/authenticate/finish', {session_id:'invented', id:'invented'});
    result = await (await fetch(base+'/api/compatibility')).json();
    assert.equal(result.verifiedEvents.at(-1).ok, false);
    assert.equal(result.verifiedEvents.at(-1).operation, 'authenticate');
  } finally { await new Promise(resolve => server.close(resolve)); }
});
