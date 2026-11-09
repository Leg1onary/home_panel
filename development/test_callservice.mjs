import {HomeAssistant} from './server/ha.js';
const ha = new HomeAssistant({url: process.env.HA_URL, token: process.env.TOK});
try {
  const asked = '';
  const entityId = /^weather\.[a-z0-9_]+$/.test(asked) ? asked : (await ha.states()).find(e => e.entity_id.startsWith('weather.'))?.entity_id || '';
  console.log('entityId:', entityId);
  const answer = await ha.callService('weather', 'get_forecasts', {type: 'daily', entity_id: [entityId]}, 15000);
  const raw = answer?.[entityId]?.forecast;
  console.log('ANSWER OK, items:', raw?.length, raw?.[0]?.datetime, raw?.[0]?.temperature);
} catch (e) {
  console.log('FAIL:', e.message);
}
process.exit(0);
