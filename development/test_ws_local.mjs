import WebSocket from 'ws';
const token = process.env.TOK;
const ws = new WebSocket('ws://192.168.8.182/api/websocket');
const t = setTimeout(() => { console.log('TIMEOUT'); process.exit(1); }, 12000);
ws.on('open', () => console.log('OPEN'));
ws.on('message', d => {
  const m = JSON.parse(d);
  console.log('MSG:', m.type);
  if (m.type === 'auth_required') ws.send(JSON.stringify({type: 'auth', access_token: token}));
  if (m.type === 'auth_ok') {
    const payload = JSON.parse(process.env.WS_PAYLOAD);
    const msg = {id: 1, ...payload};
    console.log('SENT:', JSON.stringify(msg));
    ws.send(JSON.stringify(msg));
  }
  if (m.type === 'result') {
    console.log('RESULT success:', m.success);
    console.log('FULL:', JSON.stringify(m).slice(0, 600));
    clearTimeout(t); ws.close(); process.exit(0);
  }
});
ws.on('error', e => { console.log('ERR:', e.message); clearTimeout(t); process.exit(1); });
