// Supervisor injects this secret when homeassistant_api is enabled.
if (!process.env.SUPERVISOR_TOKEN) {
  console.error('Home Panel: SUPERVISOR_TOKEN is missing. Install and start this package as a Home Assistant app with homeassistant_api enabled.');
  process.exit(1);
}
process.env.PANEL_ADDON = '1';
process.env.PANEL_PREVIEW = '0';
process.env.PORT ||= '8090';
process.env.PANEL_DATA ||= '/data/homepanel';
process.env.PANEL_ROOT ||= '/app/dist';
process.env.HA_URL ||= 'http://supervisor/core';
process.env.HA_TOKEN = process.env.SUPERVISOR_TOKEN;
await import('./server.mjs');
