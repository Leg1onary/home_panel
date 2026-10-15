// server/index.js
import http from "node:http";
import { readFile, stat, mkdir } from "node:fs/promises";
import { resolve, extname } from "node:path";
import { spawn } from "node:child_process";
import { isIP } from "node:net";
import { randomBytes as randomBytes2, createHash, timingSafeEqual } from "node:crypto";
import Database from "better-sqlite3";

// config/house.json
var house_default = {
  version: 1,
  name: "\u0414\u043E\u043C",
  location: "\u041D\u043E\u0432\u043E\u0436\u0438\u0432\u043E\u0442\u0438\u043D\u043D\u043E\u0435",
  rooms: [
    { id: "living", name: "\u0413\u043E\u0441\u0442\u0438\u043D\u0430\u044F / \u043A\u0443\u0445\u043D\u044F", short: "\u0413\u043E\u0441\u0442\u0438\u043D\u0430\u044F", icon: "sofa", description: "\u0414\u0432\u0435 \u0437\u043E\u043D\u044B \u043E\u0434\u043D\u043E\u0433\u043E \u043F\u0440\u043E\u0441\u0442\u0440\u0430\u043D\u0441\u0442\u0432\u0430", channels: [{ name: "\u0417\u043E\u043D\u0430 \u0433\u043E\u0441\u0442\u0438\u043D\u043E\u0439", note: "\u0411\u043B\u0438\u0436\u0435 \u043A \u0442\u0435\u0440\u0440\u0430\u0441\u0435", demoOn: true }, { name: "\u0417\u043E\u043D\u0430 \u043A\u0443\u0445\u043D\u0438", note: "\u041A\u0443\u0445\u043E\u043D\u043D\u044B\u0439 \u0441\u0432\u0435\u0442", demoOn: true }], climate: true },
    { id: "hall", name: "\u041F\u0440\u0438\u0445\u043E\u0436\u0430\u044F", short: "\u041F\u0440\u0438\u0445\u043E\u0436\u0430\u044F", icon: "door-open", description: "\u041F\u0440\u0430\u0432\u044B\u0439 \u043A\u0430\u043D\u0430\u043B \u0432\u044B\u043A\u043B\u044E\u0447\u0430\u0442\u0435\u043B\u044F \u0443\u043F\u0440\u0430\u0432\u043B\u044F\u0435\u0442 \u0441\u0432\u0435\u0442\u043E\u043C \u0442\u0435\u0440\u0440\u0430\u0441\u044B", channels: [{ name: "\u041F\u0440\u0438\u0445\u043E\u0436\u0430\u044F", note: "\u041B\u0435\u0432\u0430\u044F \u043A\u043B\u0430\u0432\u0438\u0448\u0430", demoOn: false }, { name: "\u0422\u0435\u0440\u0440\u0430\u0441\u0430", note: "\u041F\u0440\u0430\u0432\u0430\u044F \u043A\u043B\u0430\u0432\u0438\u0448\u0430 \xB7 \u043E\u0442\u0434\u0435\u043B\u044C\u043D\u0430\u044F \u0437\u043E\u043D\u0430", demoOn: false }], rgb: true },
    { id: "office", name: "\u041A\u0430\u0431\u0438\u043D\u0435\u0442", short: "\u041A\u0430\u0431\u0438\u043D\u0435\u0442", icon: "armchair", description: "\u041D\u0430\u0437\u0432\u0430\u043D\u0438\u044F \u0434\u0432\u0443\u0445 \u043B\u0438\u043D\u0438\u0439 \u0443\u0442\u043E\u0447\u043D\u0438\u043C \u043F\u0440\u0438 \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u0438", channels: [{ name: "\u041B\u0438\u043D\u0438\u044F \u0441\u0432\u0435\u0442\u0430 1", demoOn: true }, { name: "\u041B\u0438\u043D\u0438\u044F \u0441\u0432\u0435\u0442\u0430 2", demoOn: false }] },
    { id: "bedroom", name: "\u0421\u043F\u0430\u043B\u044C\u043D\u044F", short: "\u0421\u043F\u0430\u043B\u044C\u043D\u044F", icon: "bed-double", channels: [{ name: "\u041B\u0438\u043D\u0438\u044F \u0441\u0432\u0435\u0442\u0430 1", demoOn: false }, { name: "\u041B\u0438\u043D\u0438\u044F \u0441\u0432\u0435\u0442\u0430 2", demoOn: false }] },
    { id: "children", name: "\u0414\u0435\u0442\u0441\u043A\u0430\u044F", short: "\u0414\u0435\u0442\u0441\u043A\u0430\u044F", icon: "blocks", channels: [{ name: "\u041B\u0438\u043D\u0438\u044F \u0441\u0432\u0435\u0442\u0430 1", demoOn: false }, { name: "\u041B\u0438\u043D\u0438\u044F \u0441\u0432\u0435\u0442\u0430 2", demoOn: false }] },
    { id: "bath", name: "\u0412\u0430\u043D\u043D\u0430\u044F", short: "\u0412\u0430\u043D\u043D\u0430\u044F", icon: "bath", channels: [{ name: "\u041E\u0441\u043D\u043E\u0432\u043D\u043E\u0439 \u0441\u0432\u0435\u0442", note: "\u041B\u0435\u0432\u0430\u044F \u043A\u043B\u0430\u0432\u0438\u0448\u0430 \xB7 \u0441\u043F\u043E\u0442\u044B", demoOn: false }, { name: "\u041F\u043E\u0442\u043E\u043B\u043E\u0447\u043D\u0430\u044F \u043B\u0435\u043D\u0442\u0430", note: "\u041F\u0440\u0430\u0432\u0430\u044F \u043A\u043B\u0430\u0432\u0438\u0448\u0430 \xB7 \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u0430", demoOn: false }] },
    { id: "utility", name: "\u0422\u0443\u0430\u043B\u0435\u0442 / \u043A\u043E\u0442\u0435\u043B\u044C\u043D\u0430\u044F", short: "\u041A\u043E\u0442\u0435\u043B\u044C\u043D\u0430\u044F", icon: "heater", description: "\u041E\u0434\u043D\u043E \u043F\u043E\u043C\u0435\u0449\u0435\u043D\u0438\u0435, \u0434\u0432\u0435 \u0444\u0443\u043D\u043A\u0446\u0438\u043E\u043D\u0430\u043B\u044C\u043D\u044B\u0435 \u0437\u043E\u043D\u044B", channels: [{ name: "\u0421\u0432\u0435\u0442 \u0442\u0443\u0430\u043B\u0435\u0442\u0430", demoOn: false }], pump: true },
    { id: "pantry", name: "\u041A\u043B\u0430\u0434\u043E\u0432\u0430\u044F", short: "\u041A\u043B\u0430\u0434\u043E\u0432\u0430\u044F", icon: "archive", channels: [{ name: "\u041E\u0441\u043D\u043E\u0432\u043D\u043E\u0439 \u0441\u0432\u0435\u0442", demoOn: false }] },
    { id: "corridor", name: "\u041A\u043E\u0440\u0438\u0434\u043E\u0440", short: "\u041A\u043E\u0440\u0438\u0434\u043E\u0440", icon: "move-up-right", description: "\u0423\u043C\u043D\u044B\u0445 \u0443\u0441\u0442\u0440\u043E\u0439\u0441\u0442\u0432 \u043F\u043E\u043A\u0430 \u043D\u0435\u0442", channels: [] },
    { id: "terrace", name: "\u0422\u0435\u0440\u0440\u0430\u0441\u0430", short: "\u0422\u0435\u0440\u0440\u0430\u0441\u0430", icon: "trees", description: "\u0421\u0432\u0435\u0442 \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0451\u043D \u043A \u043F\u0440\u0430\u0432\u043E\u0439 \u043A\u043B\u0430\u0432\u0438\u0448\u0435 \u0432 \u043F\u0440\u0438\u0445\u043E\u0436\u0435\u0439", channels: [], terrace: true }
  ]
};

// src/compat.js
if (!Array.prototype.flat) {
  Object.defineProperty(Array.prototype, "flat", { configurable: true, writable: true, value: function(depth = 1) {
    const out = [];
    const walk = (list, n) => {
      list.forEach((value) => {
        if (Array.isArray(value) && n > 0) walk(value, n - 1);
        else out.push(value);
      });
    };
    walk(this, depth);
    return out;
  } });
}
if (!Array.prototype.flatMap) {
  Object.defineProperty(Array.prototype, "flatMap", { configurable: true, writable: true, value: function(fn, thisArg) {
    return this.map(fn, thisArg).flat();
  } });
}
if (!Object.fromEntries) {
  Object.fromEntries = (entries) => {
    const out = {};
    for (const [key, value] of entries) Object.defineProperty(out, key, { value, writable: true, enumerable: true, configurable: true });
    return out;
  };
}

// src/catalog.js
var deviceTypes = {
  light: { label: "\u041B\u0438\u043D\u0438\u044F \u0441\u0432\u0435\u0442\u0430", icon: "lightbulb", module: "lights", domains: ["light", "switch"], controllable: true },
  rgb: { label: "RGB-\u043B\u0430\u043C\u043F\u0430", icon: "lightbulb", module: "lights", domains: ["light"], controllable: true },
  temperature: { label: "\u0422\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u0430", icon: "thermometer", module: "sensors", domains: ["sensor"], unit: "\xB0C" },
  humidity: { label: "\u0412\u043B\u0430\u0436\u043D\u043E\u0441\u0442\u044C", icon: "droplets", module: "sensors", domains: ["sensor"], unit: "%" },
  illuminance: { label: "\u041E\u0441\u0432\u0435\u0449\u0451\u043D\u043D\u043E\u0441\u0442\u044C", icon: "sun", module: "sensors", domains: ["sensor"], unit: "lx" },
  door: { label: "\u041E\u0442\u043A\u0440\u044B\u0442\u0438\u0435", icon: "door-open", module: "sensors", domains: ["binary_sensor"], classes: ["door", "opening", "window", "garage_door"] },
  smoke: { label: "\u0414\u044B\u043C", icon: "radio", module: "sensors", domains: ["binary_sensor"], classes: ["smoke"] },
  motion: { label: "\u0414\u0432\u0438\u0436\u0435\u043D\u0438\u0435", icon: "scan-eye", module: "sensors", domains: ["binary_sensor", "sensor"], classes: ["motion", "occupancy", "enum"] },
  battery: { label: "\u0411\u0430\u0442\u0430\u0440\u0435\u0439\u043A\u0430", icon: "radio", module: "sensors", domains: ["sensor"], unit: "%" },
  button_event: { label: "\u041C\u0430\u0441\u0442\u0435\u0440-\u043A\u043D\u043E\u043F\u043A\u0430 \xB7 \u0441\u043E\u0431\u044B\u0442\u0438\u0435", icon: "power", module: "sensors", domains: ["sensor"], classes: ["enum"] },
  station: { label: "\u042F\u043D\u0434\u0435\u043A\u0441 \u0414\u0443\u043E \u041C\u0430\u043A\u0441", icon: "audio-lines", module: "media", domains: ["media_player"], controllable: true },
  leak: { label: "\u041F\u0440\u043E\u0442\u0435\u0447\u043A\u0430", icon: "droplets", module: "sensors", domains: ["binary_sensor"], classes: ["moisture"] },
  camera: { label: "\u041A\u0430\u043C\u0435\u0440\u0430", icon: "camera", module: "cameras", domains: ["camera"] },
  gate: { label: "\u041E\u0442\u043A\u0430\u0442\u043D\u044B\u0435 \u0432\u043E\u0440\u043E\u0442\u0430", icon: "door-open", module: "engineering", domains: ["cover"], locked: true },
  heating: { label: "\u041E\u0442\u043E\u043F\u043B\u0435\u043D\u0438\u0435 / \u043A\u043E\u0442\u0451\u043B", icon: "heater", module: "engineering", domains: ["climate"], locked: true },
  pump: { label: "\u041F\u0438\u0442\u0430\u043D\u0438\u0435 \u043D\u0430\u0441\u043E\u0441\u0430", icon: "heater", module: "engineering", domains: ["switch"], locked: true }
};
var areas = [
  ...house_default.rooms.map((r) => ({ id: r.id, name: r.name })),
  { id: "attic", name: "\u0427\u0435\u0440\u0434\u0430\u043A" },
  { id: "well", name: "\u0421\u043A\u0432\u0430\u0436\u0438\u043D\u0430" },
  { id: "yard", name: "\u0414\u0432\u043E\u0440" }
];
var areaName = (id) => areas.find((a) => a.id === id)?.name || id;
var lightIDs = {
  living: ["living:0", "living:1"],
  hall: ["hall:0", "hall:1"],
  office: ["office:0", "office:1"],
  bedroom: ["bedroom:0", "bedroom:1"],
  children: ["children:0", "children:1"],
  bath: ["bath:0", "bath:1"],
  utility: ["utility:0"],
  pantry: ["pantry:0"]
};
var make = (id, type, room, name, extra2 = {}) => ({ id, type, room, name, status: "installed", masterOff: type === "light", note: "", ...extra2 });
function defaultDevices() {
  return [
    ...house_default.rooms.flatMap((r) => r.channels.map((c, i) => make(lightIDs[r.id][i], "light", r.id === "hall" && i === 1 ? "terrace" : r.id, c.name, { status: c.planned ? "planned" : "installed", note: c.note || "", demoOn: c.demoOn }))),
    ...[["living", 20.4, 53], ["attic", 40, 24], ["well", 16.5, 86]].flatMap(([id, t, h]) => [
      make(`temperature:${id}`, "temperature", id, `\u0422\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u0430 \xB7 ${areaName(id)}`, { note: "miaomiaoce.sensor_ht.t2 \xB7 BLE; \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u0435 \u043A HA \u0435\u0449\u0451 \u043D\u0435 \u043F\u0440\u043E\u0432\u0435\u0440\u0435\u043D\u043E", demoValue: t, demoStale: id === "attic" }),
      make(`humidity:${id}`, "humidity", id, `\u0412\u043B\u0430\u0436\u043D\u043E\u0441\u0442\u044C \xB7 ${areaName(id)}`, { note: "miaomiaoce.sensor_ht.t2 \xB7 BLE; \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u0435 \u043A HA \u0435\u0449\u0451 \u043D\u0435 \u043F\u0440\u043E\u0432\u0435\u0440\u0435\u043D\u043E", demoValue: h, demoStale: id === "attic" })
    ]),
    make("door", "door", "hall", "\u0412\u0445\u043E\u0434\u043D\u0430\u044F \u0434\u0432\u0435\u0440\u044C", { note: "isa.magnet.dw2hl \xB7 BLE; \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u0435 \u043A HA \u0435\u0449\u0451 \u043D\u0435 \u043F\u0440\u043E\u0432\u0435\u0440\u0435\u043D\u043E", demoValue: "off" }),
    make("smoke", "smoke", "living", "\u0414\u0430\u0442\u0447\u0438\u043A \u0434\u044B\u043C\u0430 \u043D\u0430\u0434 \u043A\u0443\u0445\u043D\u0435\u0439", { note: "DIGMA SmartLife \xB7 \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u0435 \u043E\u0442\u043B\u043E\u0436\u0435\u043D\u043E", demoValue: "off" }),
    make("terrace-motion", "motion", "terrace", "\u0414\u0432\u0438\u0436\u0435\u043D\u0438\u0435 \u043D\u0430 \u0442\u0435\u0440\u0440\u0430\u0441\u0435", { note: "lumi.motion.agl02 \xB7 Zigbee; \u0441\u0446\u0435\u043D\u0430\u0440\u0438\u0439 \u043F\u043E\u043A\u0430 \u043E\u0441\u0442\u0430\u0451\u0442\u0441\u044F \u0432 \u0410\u043B\u0438\u0441\u0435" }),
    make("terrace-lux", "illuminance", "terrace", "\u041E\u0441\u0432\u0435\u0449\u0451\u043D\u043D\u043E\u0441\u0442\u044C \u0442\u0435\u0440\u0440\u0430\u0441\u044B", { note: "lumi.motion.agl02 \xB7 Zigbee; \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u0435 \u043A HA \u0435\u0449\u0451 \u043D\u0435 \u043F\u0440\u043E\u0432\u0435\u0440\u0435\u043D\u043E" }),
    make("camera-yard", "camera", "yard", "\u0414\u0432\u043E\u0440 \xB7 Tapo C320WS", { note: "\u0423\u0447\u0451\u0442\u043D\u0430\u044F \u0437\u0430\u043F\u0438\u0441\u044C \u043A\u0430\u043C\u0435\u0440\u044B \u0441\u043E\u0437\u0434\u0430\u043D\u0430; ONVIF \u0432 HA \u0435\u0449\u0451 \u043D\u0435 \u043F\u0440\u043E\u0432\u0435\u0440\u0435\u043D" }),
    make("corridor-main", "light", "corridor", "\u0411\u0443\u0434\u0443\u0449\u0438\u0439 \u0432\u044B\u043A\u043B\u044E\u0447\u0430\u0442\u0435\u043B\u044C 1", { status: "planned", note: "\u041A\u043E\u043B\u0438\u0447\u0435\u0441\u0442\u0432\u043E \u043A\u043B\u0430\u0432\u0438\u0448 \u0438 \u043B\u0438\u043D\u0438\u0438 \u0443\u0442\u043E\u0447\u043D\u0438\u043C" }),
    make("corridor-extra", "light", "corridor", "\u0411\u0443\u0434\u0443\u0449\u0438\u0439 \u0432\u044B\u043A\u043B\u044E\u0447\u0430\u0442\u0435\u043B\u044C 2", { status: "planned", note: "\u041A\u043E\u043B\u0438\u0447\u0435\u0441\u0442\u0432\u043E \u043A\u043B\u0430\u0432\u0438\u0448 \u0438 \u043B\u0438\u043D\u0438\u0438 \u0443\u0442\u043E\u0447\u043D\u0438\u043C" }),
    make("camera-extra-1", "camera", "yard", "\u041A\u0430\u043C\u0435\u0440\u0430 2 \xB7 \u043F\u043B\u0430\u043D\u0438\u0440\u0443\u0435\u0442\u0441\u044F", { status: "planned", note: "\u041C\u0435\u0441\u0442\u043E \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0438 \u0435\u0449\u0451 \u043D\u0435 \u0432\u044B\u0431\u0440\u0430\u043D\u043E" }),
    make("camera-extra-2", "camera", "yard", "\u041A\u0430\u043C\u0435\u0440\u0430 3 \xB7 \u0440\u0435\u0437\u0435\u0440\u0432", { status: "planned", note: "\u041D\u0435 \u043A\u0443\u043F\u043B\u0435\u043D\u0430; \u043D\u0435\u043E\u0431\u044F\u0437\u0430\u0442\u0435\u043B\u044C\u043D\u043E\u0435 \u0440\u0430\u0441\u0448\u0438\u0440\u0435\u043D\u0438\u0435" }),
    make("sliding-gate", "gate", "yard", "\u041E\u0442\u043A\u0430\u0442\u043D\u044B\u0435 \u0432\u043E\u0440\u043E\u0442\u0430", { status: "planned", note: "\u041C\u043E\u0434\u0435\u043B\u044C \u043F\u0440\u0438\u0432\u043E\u0434\u0430, \u0438\u043D\u0442\u0435\u0440\u0444\u0435\u0439\u0441 \u0438 \u0434\u0430\u0442\u0447\u0438\u043A\u0438 \u043F\u043E\u043B\u043E\u0436\u0435\u043D\u0438\u044F \u043D\u0435 \u043F\u0440\u043E\u0432\u0435\u0440\u0435\u043D\u044B" }),
    make("boiler", "heating", "utility", "\u0413\u0430\u0437\u043E\u0432\u044B\u0439 \u043A\u043E\u0442\u0451\u043B Kentatsu", { note: "\u0412\u043D\u0435\u0448\u043D\u0435\u0435 \u0443\u043F\u0440\u0430\u0432\u043B\u0435\u043D\u0438\u0435 \u0438 \u0441\u043E\u0432\u043C\u0435\u0441\u0442\u0438\u043C\u043E\u0441\u0442\u044C \u043D\u0435 \u043F\u0440\u043E\u0432\u0435\u0440\u0435\u043D\u044B" }),
    make("pump", "pump", "utility", "\u041D\u0430\u0441\u043E\u0441 \u0442\u0451\u043F\u043B\u043E\u0433\u043E \u043F\u043E\u043B\u0430", { note: "yeelink.switch.sw1 \xB7 \u043A\u0430\u043D\u0430\u043B \u0435\u0449\u0451 \u043D\u0435 \u043F\u0440\u043E\u0432\u0435\u0440\u0435\u043D; \u043F\u0438\u0442\u0430\u043D\u0438\u0435 \u043D\u0435 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0430\u0435\u0442 \u0440\u0430\u0431\u043E\u0442\u0443 \u043D\u0430\u0441\u043E\u0441\u0430" })
  ];
}
var bindingDefinitions = (devices = defaultDevices()) => devices.map((d) => ({
  id: d.id,
  type: d.type,
  name: `${areaName(d.room)} \xB7 ${d.name}`,
  domains: deviceTypes[d.type].domains,
  device: d
}));
var findDevice = (devices, id) => devices.find((d) => d.id === id);
var sensorTypes = Object.keys(deviceTypes).filter((t) => deviceTypes[t].module === "sensors");
function resolveAction(id, devices) {
  const normalized = id.startsWith("rgb:") ? "rgb/" + id.slice(4) : id;
  const slash = normalized.lastIndexOf("/");
  const key = slash < 0 ? normalized : normalized.slice(0, slash), action = slash < 0 ? "on" : normalized.slice(slash + 1);
  return { device: findDevice(devices, key), key, action };
}
function validateDevices(input) {
  if (!Array.isArray(input) || input.length > 128) throw new Error("\u0412 \u043A\u0430\u0442\u0430\u043B\u043E\u0433\u0435 \u043C\u043E\u0436\u0435\u0442 \u0431\u044B\u0442\u044C \u043D\u0435 \u0431\u043E\u043B\u0435\u0435 128 \u0443\u0441\u0442\u0440\u043E\u0439\u0441\u0442\u0432.");
  const defaults = defaultDevices(), used = /* @__PURE__ */ new Set();
  return input.map((raw) => {
    if (!raw || typeof raw !== "object" || !deviceTypes[raw.type] || !areas.some((a) => a.id === raw.room)) throw new Error("\u041D\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043D\u044B\u0439 \u0442\u0438\u043F \u0438\u043B\u0438 \u0437\u043E\u043D\u0430 \u0443\u0441\u0442\u0440\u043E\u0439\u0441\u0442\u0432\u0430.");
    if (typeof raw.id !== "string" || !/^[a-z][a-z0-9:_-]{1,63}$/.test(raw.id) || used.has(raw.id)) throw new Error("ID \u0443\u0441\u0442\u0440\u043E\u0439\u0441\u0442\u0432\u0430 \u043D\u0435\u0432\u0435\u0440\u043D\u044B\u0439 \u0438\u043B\u0438 \u043F\u043E\u0432\u0442\u043E\u0440\u044F\u0435\u0442\u0441\u044F.");
    used.add(raw.id);
    const seed = defaults.find((d) => d.id === raw.id);
    if (seed && seed.type !== raw.type) throw new Error("\u0422\u0438\u043F \u0438\u0441\u0445\u043E\u0434\u043D\u043E\u0433\u043E \u0443\u0441\u0442\u0440\u043E\u0439\u0441\u0442\u0432\u0430 \u043D\u0435\u043B\u044C\u0437\u044F \u043F\u043E\u0434\u043C\u0435\u043D\u044F\u0442\u044C.");
    if (!["installed", "planned"].includes(raw.status)) throw new Error("\u041D\u0435\u0432\u0435\u0440\u043D\u044B\u0439 \u0441\u0442\u0430\u0442\u0443\u0441 \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0438.");
    if (typeof raw.name !== "string" || !raw.name.trim() || raw.name.trim().length > 64) throw new Error("\u041D\u0430\u0437\u0432\u0430\u043D\u0438\u0435 \u0443\u0441\u0442\u0440\u043E\u0439\u0441\u0442\u0432\u0430: \u043E\u0442 1 \u0434\u043E 64 \u0441\u0438\u043C\u0432\u043E\u043B\u043E\u0432.");
    if (raw.note !== void 0 && (typeof raw.note !== "string" || raw.note.length > 240)) throw new Error("\u041F\u0440\u0438\u043C\u0435\u0447\u0430\u043D\u0438\u0435: \u0434\u043E 240 \u0441\u0438\u043C\u0432\u043E\u043B\u043E\u0432.");
    return {
      id: raw.id,
      type: raw.type,
      room: raw.room,
      name: raw.name.trim(),
      status: raw.status,
      note: raw.note || "",
      masterOff: ["light", "rgb"].includes(raw.type) && raw.masterOff === true && !seed?.powerId,
      ...seed?.powerId ? { powerId: seed.powerId } : {},
      ...seed?.demoOn !== void 0 ? { demoOn: seed.demoOn } : {},
      ...seed?.demoValue !== void 0 ? { demoValue: seed.demoValue } : {},
      ...seed?.demoStale ? { demoStale: true } : {}
    };
  });
}
function samePhysicalDevice(a, b) {
  return !!a && !!b && a.type === b.type && a.room === b.room && a.status === b.status && a.powerId === b.powerId;
}

// src/preferences.js
var defaultPreferences = () => ({
  version: 3,
  theme: "dark",
  favorites: ["living", "hall", "terrace", "bedroom", "office", "bath"],
  nightMode: "auto",
  idleSeconds: 90,
  kiosk: false,
  mode: "demo",
  devices: defaultDevices(),
  bindings: Object.fromEntries(defaultDevices().map((d) => [d.id, { entityId: "", verified: false }]))
});
function validatePreferences(input, { importing = false } = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("\u041D\u0443\u0436\u0435\u043D \u043E\u0431\u044A\u0435\u043A\u0442 \u043D\u0430\u0441\u0442\u0440\u043E\u0435\u043A.");
  if (input.version !== 3) throw new Error("\u0412\u0435\u0440\u0441\u0438\u044F \u043D\u0430\u0441\u0442\u0440\u043E\u0435\u043A \u043D\u0435 \u043F\u043E\u0434\u0434\u0435\u0440\u0436\u0438\u0432\u0430\u0435\u0442\u0441\u044F. \u041D\u0443\u0436\u043D\u0430 \u043A\u043E\u043F\u0438\u044F v3.");
  const raw = input, p = defaultPreferences();
  if (Number.isInteger(raw.housePresetVersion) && raw.housePresetVersion >= 0 && raw.housePresetVersion <= 1) p.housePresetVersion = raw.housePresetVersion;
  if (!["dark", "light"].includes(raw.theme)) throw new Error("\u041D\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043D\u0430\u044F \u0442\u0435\u043C\u0430.");
  if (!["auto", "on", "off"].includes(raw.nightMode)) throw new Error("\u041D\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043D\u044B\u0439 \u043D\u043E\u0447\u043D\u043E\u0439 \u0440\u0435\u0436\u0438\u043C.");
  if (![0, 10, 60, 90, 180].includes(raw.idleSeconds)) throw new Error("\u041D\u0435\u0432\u0435\u0440\u043D\u0430\u044F \u0437\u0430\u0434\u0435\u0440\u0436\u043A\u0430 \u043E\u0436\u0438\u0434\u0430\u043D\u0438\u044F.");
  if (!Array.isArray(raw.favorites) || raw.favorites.length > 6 || new Set(raw.favorites).size !== raw.favorites.length || raw.favorites.some((id) => !areas.some((r) => r.id === id))) throw new Error("\u041F\u0440\u043E\u0432\u0435\u0440\u044C \u0441\u043F\u0438\u0441\u043E\u043A \u0438\u0437\u0431\u0440\u0430\u043D\u043D\u044B\u0445 \u043A\u043E\u043C\u043D\u0430\u0442.");
  if (!["demo", "live"].includes(raw.mode)) throw new Error("\u041D\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043D\u044B\u0439 \u0438\u0441\u0442\u043E\u0447\u043D\u0438\u043A \u0434\u0430\u043D\u043D\u044B\u0445.");
  Object.assign(p, { theme: raw.theme, nightMode: raw.nightMode, idleSeconds: raw.idleSeconds, favorites: [...raw.favorites], kiosk: raw.kiosk === true, mode: importing ? "demo" : raw.mode, devices: validateDevices(raw.devices) });
  const used = /* @__PURE__ */ new Set();
  p.bindings = {};
  for (const definition of bindingDefinitions(p.devices)) {
    const b = raw.bindings?.[definition.id] || {}, entityId = typeof b.entityId === "string" ? b.entityId.trim() : "";
    if (entityId && (!/^[a-z_]+\.[a-z0-9_]+$/.test(entityId) || !definition.domains.includes(entityId.split(".")[0]))) throw new Error(`\u041D\u0435\u0432\u0435\u0440\u043D\u0430\u044F \u0441\u0443\u0449\u043D\u043E\u0441\u0442\u044C: ${definition.name}`);
    if (entityId && used.has(entityId)) throw new Error("\u041E\u0434\u043D\u0430 \u0441\u0443\u0449\u043D\u043E\u0441\u0442\u044C \u043D\u0435 \u043C\u043E\u0436\u0435\u0442 \u0431\u044B\u0442\u044C \u043F\u0440\u0438\u0432\u044F\u0437\u0430\u043D\u0430 \u043A \u0434\u0432\u0443\u043C \u0443\u0441\u0442\u0440\u043E\u0439\u0441\u0442\u0432\u0430\u043C.");
    if (entityId) used.add(entityId);
    if (definition.device.status === "planned" && b.verified && !importing) throw new Error("\u041F\u043B\u0430\u043D\u0438\u0440\u0443\u0435\u043C\u043E\u0435 \u0443\u0441\u0442\u0440\u043E\u0439\u0441\u0442\u0432\u043E \u043D\u0435\u043B\u044C\u0437\u044F \u043E\u0442\u043C\u0435\u0447\u0430\u0442\u044C \u043F\u0440\u043E\u0432\u0435\u0440\u0435\u043D\u043D\u044B\u043C.");
    p.bindings[definition.id] = { entityId, verified: !importing && definition.device.status === "installed" && !!entityId && b.verified === true };
  }
  return p;
}

// src/station.js
var mediaFeatures = { PAUSE: 1, VOLUME_SET: 4, PLAY: 16384 };
function stationAvailable(e) {
  return !!e && ["playing", "paused", "idle", "on", "buffering"].includes(e.state);
}
function stationSupports(e, action, value) {
  if (!stationAvailable(e)) return false;
  const mask = Number(e.attributes?.supported_features) || 0;
  if (action === "volume") return !!(mask & mediaFeatures.VOLUME_SET) && Number.isFinite(e.attributes?.volume_level);
  if (action === "playing") return typeof value === "boolean" && !!(mask & (value ? mediaFeatures.PLAY : mediaFeatures.PAUSE));
  return false;
}

// server/ha.js
var HomeAssistant = class {
  constructor({ url = "", token = "", preview: preview2 = false } = {}) {
    this.enabled = !!url && !!token && !preview2;
    this.token = token;
    this.url = null;
    this.pending = /* @__PURE__ */ new Set();
    if (this.enabled) {
      let u;
      try {
        u = new URL(url);
      } catch {
        throw new Error("HA_URL \u0438\u043C\u0435\u0435\u0442 \u043D\u0435\u0432\u0435\u0440\u043D\u044B\u0439 \u0444\u043E\u0440\u043C\u0430\u0442.");
      }
      if (!["http:", "https:"].includes(u.protocol) || u.username || u.password || u.search || u.hash) throw new Error("HA_URL \u0434\u043E\u043B\u0436\u0435\u043D \u0431\u044B\u0442\u044C HTTP(S)-\u0430\u0434\u0440\u0435\u0441\u043E\u043C \u0431\u0435\u0437 \u043F\u0430\u0440\u043E\u043B\u044F, query \u0438 fragment.");
      this.url = u.href.replace(/\/$/, "");
    }
  }
  async request(path, body2) {
    if (!this.enabled) throw new Error("Home Assistant \u043D\u0435 \u043D\u0430\u0441\u0442\u0440\u043E\u0435\u043D. \u041D\u0430 \u043C\u0435\u0441\u0442\u0435 \u0434\u043E\u0431\u0430\u0432\u0438\u043C HA_URL \u0438 HA_TOKEN \u0432 .env \u043B\u043E\u043A\u0430\u043B\u044C\u043D\u043E\u0433\u043E \u0441\u0435\u0440\u0432\u0435\u0440\u0430.");
    let response;
    try {
      response = await fetch(this.url + path, {
        method: body2 === void 0 ? "GET" : "POST",
        redirect: "error",
        headers: { Authorization: `Bearer ${this.token}`, "Content-Type": "application/json" },
        ...body2 === void 0 ? {} : { body: JSON.stringify(body2) },
        signal: AbortSignal.timeout(6e3)
      });
    } catch {
      throw new Error("\u041D\u0435\u0442 \u0441\u0432\u044F\u0437\u0438 \u0441 Home Assistant. \u041F\u0440\u043E\u0432\u0435\u0440\u044C \u0441\u0435\u0442\u044C \u0438 \u0430\u0434\u0440\u0435\u0441 \u043B\u043E\u043A\u0430\u043B\u044C\u043D\u043E\u0433\u043E \u0441\u0435\u0440\u0432\u0435\u0440\u0430.");
    }
    if (response.status === 401 || response.status === 403) throw new Error("Home Assistant \u043E\u0442\u043A\u043B\u043E\u043D\u0438\u043B \u0430\u0432\u0442\u043E\u0440\u0438\u0437\u0430\u0446\u0438\u044E. \u041F\u0440\u043E\u0432\u0435\u0440\u044C \u043B\u043E\u043A\u0430\u043B\u044C\u043D\u044B\u0439 \u0442\u043E\u043A\u0435\u043D.");
    if (!response.ok) throw new Error(`Home Assistant: \u0437\u0430\u043F\u0440\u043E\u0441 \u043E\u0442\u043A\u043B\u043E\u043D\u0451\u043D (${response.status}).`);
    try {
      return await response.json();
    } catch {
      throw new Error("\u041D\u0435\u043A\u043E\u0440\u0440\u0435\u043A\u0442\u043D\u044B\u0439 \u043E\u0442\u0432\u0435\u0442 Home Assistant.");
    }
  }
  sanitize(e) {
    const keys = ["friendly_name", "device_class", "unit_of_measurement", "temperature_unit", "brightness", "rgb_color", "supported_color_modes", "current_position", "current_temperature", "temperature", "hvac_action", "supported_features", "volume_level", "media_title", "media_artist"];
    return {
      entity_id: e.entity_id,
      state: e.state,
      last_updated: e.last_updated,
      last_reported: e.last_reported,
      attributes: Object.fromEntries(keys.filter((k) => e.attributes?.[k] !== void 0).map((k) => [k, e.attributes[k]]))
    };
  }
  async states() {
    const all = await this.request("/api/states");
    if (!Array.isArray(all)) throw new Error("\u041D\u0435\u043A\u043E\u0440\u0440\u0435\u043A\u0442\u043D\u044B\u0439 \u0441\u043F\u0438\u0441\u043E\u043A \u0441\u0443\u0449\u043D\u043E\u0441\u0442\u0435\u0439.");
    return all.filter((e) => /^(light|switch|sensor|binary_sensor|camera|cover|climate|media_player)\.[a-z0-9_]+$/.test(e.entity_id)).map((e) => this.sanitize(e));
  }
  cameraEntity(id, p) {
    const d = p.devices.find((d2) => d2.id === id), b = p.bindings[id];
    if (p.mode !== "live" || d?.type !== "camera" || d.status !== "installed" || !b?.verified || !/^camera\.[a-z0-9_]+$/.test(b.entityId)) throw new Error("\u041A\u0430\u043C\u0435\u0440\u0430 \u043D\u0435 \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0435\u043D\u0430 \u0438\u043B\u0438 \u043D\u0435 \u043F\u0440\u043E\u0432\u0435\u0440\u0435\u043D\u0430.");
    if (!this.enabled) throw new Error("\u041A\u0430\u043C\u0435\u0440\u0430 \u043D\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u043D\u0430 \u0432 \u0434\u0435\u043C\u043E\u043F\u0440\u0435\u0432\u044C\u044E.");
    return b.entityId;
  }
  async camera(id, p) {
    const entity = this.cameraEntity(id, p);
    let response;
    try {
      response = await fetch(this.url + "/api/camera_proxy/" + entity, { headers: { Authorization: `Bearer ${this.token}` }, redirect: "error", signal: AbortSignal.timeout(1e4) });
    } catch {
      throw new Error("\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043F\u043E\u043B\u0443\u0447\u0438\u0442\u044C \u043A\u0430\u0434\u0440 \u043A\u0430\u043C\u0435\u0440\u044B.");
    }
    const type = response.headers.get("content-type")?.split(";")[0];
    if (!response.ok || !["image/jpeg", "image/png", "image/webp"].includes(type)) throw new Error("Home Assistant \u043D\u0435 \u0432\u0435\u0440\u043D\u0443\u043B \u0438\u0437\u043E\u0431\u0440\u0430\u0436\u0435\u043D\u0438\u0435 \u043A\u0430\u043C\u0435\u0440\u044B.");
    const reader = response.body.getReader(), parts = [];
    let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > 5 * 1024 * 1024) throw new Error("\u041A\u0430\u0434\u0440 \u043F\u0440\u0435\u0432\u044B\u0448\u0430\u0435\u0442 5 \u041C\u0411.");
        parts.push(Buffer.from(value));
      }
    } finally {
      await reader.cancel();
    }
    return { type, bytes: Buffer.concat(parts) };
  }
  async command(request, p) {
    if (p.mode !== "live") throw new Error("\u041A\u043E\u043C\u0430\u043D\u0434\u044B Home Assistant \u0434\u043E\u0441\u0442\u0443\u043F\u043D\u044B \u0442\u043E\u043B\u044C\u043A\u043E \u0432 \u0440\u0430\u0431\u043E\u0447\u0435\u043C \u0440\u0435\u0436\u0438\u043C\u0435.");
    if (!request || typeof request.id !== "string") throw new Error("\u041D\u0435\u0432\u0435\u0440\u043D\u0430\u044F \u043A\u043E\u043C\u0430\u043D\u0434\u0430.");
    if (request.id.startsWith("station:")) return this.stationCommand(request, p);
    const { key, action, device } = resolveAction(request.id, p.devices);
    const def = bindingDefinitions(p.devices).find((b) => b.id === key), binding = p.bindings[key];
    if (!def || device.status !== "installed" || !["light", "rgb"].includes(def.type) || !binding?.verified || !binding.entityId) throw new Error("\u0423\u043F\u0440\u0430\u0432\u043B\u0435\u043D\u0438\u0435 \u044D\u0442\u0438\u043C \u043A\u0430\u043D\u0430\u043B\u043E\u043C \u0437\u0430\u0431\u043B\u043E\u043A\u0438\u0440\u043E\u0432\u0430\u043D\u043E.");
    const entity = binding.entityId, domain = entity.split(".")[0];
    if (!def.domains.includes(domain) || this.pending.has(entity)) throw new Error("\u041A\u0430\u043D\u0430\u043B \u0437\u0430\u043D\u044F\u0442 \u0438\u043B\u0438 \u0434\u043E\u043C\u0435\u043D \u0437\u0430\u043F\u0440\u0435\u0449\u0451\u043D.");
    let service, data2, target;
    if (action === "brightness" && def.type === "rgb") {
      if (!Number.isInteger(request.value) || request.value < 1 || request.value > 100) throw new Error("\u041D\u0435\u0432\u0435\u0440\u043D\u0430\u044F \u044F\u0440\u043A\u043E\u0441\u0442\u044C.");
      service = "turn_on";
      data2 = { brightness: Math.round(request.value * 255 / 100) };
      target = (e) => e.state === "on" && Math.abs((e.attributes.brightness ?? -999) - data2.brightness) <= 2;
    } else if (action === "color" && def.type === "rgb") {
      if (!/^#[a-fA-F0-9]{6}$/.test(request.value)) throw new Error("\u041D\u0435\u0432\u0435\u0440\u043D\u044B\u0439 RGB-\u0446\u0432\u0435\u0442.");
      const rgb = [1, 3, 5].map((i) => parseInt(request.value.slice(i, i + 2), 16));
      service = "turn_on";
      data2 = { rgb_color: rgb };
      target = (e) => e.state === "on" && e.attributes.rgb_color?.length === 3 && e.attributes.rgb_color.every((n, i) => Math.abs(n - rgb[i]) <= 3);
    } else {
      if (action !== "on" || typeof request.value !== "boolean") throw new Error("\u041D\u0435\u0432\u0435\u0440\u043D\u043E\u0435 \u0437\u043D\u0430\u0447\u0435\u043D\u0438\u0435 \u0432\u044B\u043A\u043B\u044E\u0447\u0430\u0442\u0435\u043B\u044F.");
      service = request.value ? "turn_on" : "turn_off";
      data2 = {};
      target = (e) => e.state === (request.value ? "on" : "off");
    }
    this.pending.add(entity);
    try {
      const before = await this.request("/api/states/" + entity);
      if (!["on", "off"].includes(before.state)) throw new Error("\u0421\u0443\u0449\u043D\u043E\u0441\u0442\u044C \u043D\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u043D\u0430. \u041A\u043E\u043C\u0430\u043D\u0434\u0430 \u043D\u0435 \u043E\u0442\u043F\u0440\u0430\u0432\u043B\u0435\u043D\u0430.");
      if (action === "brightness" && !before.attributes.supported_color_modes?.some((m) => m !== "onoff")) throw new Error("\u042F\u0440\u043A\u043E\u0441\u0442\u044C \u043D\u0435 \u043F\u043E\u0434\u0434\u0435\u0440\u0436\u0438\u0432\u0430\u0435\u0442\u0441\u044F \u0441\u0443\u0449\u043D\u043E\u0441\u0442\u044C\u044E.");
      if (action === "color" && !before.attributes.supported_color_modes?.includes("rgb")) throw new Error("RGB-\u0446\u0432\u0435\u0442 \u043D\u0435 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0451\u043D \u043A\u0430\u043A \u043F\u043E\u0434\u0434\u0435\u0440\u0436\u0438\u0432\u0430\u0435\u043C\u044B\u0439.");
      if (device.powerId) {
        const power = p.bindings[device.powerId];
        if (!power?.verified || !power.entityId) throw new Error("\u0421\u043D\u0430\u0447\u0430\u043B\u0430 \u043F\u0440\u043E\u0432\u0435\u0440\u044C \u043A\u0430\u043D\u0430\u043B \u043F\u0438\u0442\u0430\u043D\u0438\u044F \u043F\u0440\u0438\u0445\u043E\u0436\u0435\u0439.");
        const e = await this.request("/api/states/" + power.entityId);
        if (e.state !== "on") throw new Error("\u0423 RGB-\u043B\u0430\u043C\u043F\u044B \u043D\u0435\u0442 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0451\u043D\u043D\u043E\u0433\u043E \u043F\u0438\u0442\u0430\u043D\u0438\u044F.");
      }
      if (target(before)) return { id: request.id, value: request.value, confirmedAt: Date.now() };
      await this.request(`/api/services/${domain}/${service}`, { entity_id: entity, ...data2 });
      const deadline = Date.now() + 1e4;
      do {
        const e = await this.request("/api/states/" + entity);
        if (target(e)) return { id: request.id, value: request.value, confirmedAt: Date.now() };
        await new Promise((r) => setTimeout(r, 350));
      } while (Date.now() < deadline);
      throw new Error("\u0421\u043E\u0441\u0442\u043E\u044F\u043D\u0438\u0435 \u043D\u0435 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D\u043E. \u041A\u043E\u043C\u0430\u043D\u0434\u0430 \u043C\u043E\u0433\u043B\u0430 \u0432\u044B\u043F\u043E\u043B\u043D\u0438\u0442\u044C\u0441\u044F; \u043F\u0440\u043E\u0432\u0435\u0440\u044C \u0443\u0441\u0442\u0440\u043E\u0439\u0441\u0442\u0432\u043E \u043F\u0435\u0440\u0435\u0434 \u043F\u043E\u0432\u0442\u043E\u0440\u043E\u043C.");
    } finally {
      this.pending.delete(entity);
    }
  }
  async stationCommand(request, p) {
    const d = p.devices.find((d2) => d2.id === "station"), b = p.bindings.station, action = request.id.slice(8);
    if (d?.type !== "station" || d.status !== "installed" || !b?.verified || !/^media_player\.[a-z0-9_]+$/.test(b.entityId)) throw new Error("\u0421\u0442\u0430\u043D\u0446\u0438\u044F \u043D\u0435 \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0435\u043D\u0430 \u0438\u043B\u0438 \u043D\u0435 \u043F\u0440\u043E\u0432\u0435\u0440\u0435\u043D\u0430.");
    if (action === "volume") {
      if (!Number.isInteger(request.value) || request.value < 0 || request.value > 100) throw new Error("\u0413\u0440\u043E\u043C\u043A\u043E\u0441\u0442\u044C \u0434\u043E\u043B\u0436\u043D\u0430 \u0431\u044B\u0442\u044C \u043E\u0442 0 \u0434\u043E 100.");
    } else if (action !== "playing" || typeof request.value !== "boolean") throw new Error("\u041A\u043E\u043C\u0430\u043D\u0434\u0430 \u0441\u0442\u0430\u043D\u0446\u0438\u0438 \u0437\u0430\u043F\u0440\u0435\u0449\u0435\u043D\u0430.");
    const entity = b.entityId;
    if (this.pending.has(entity)) throw new Error("\u0421\u0442\u0430\u043D\u0446\u0438\u044F \u0437\u0430\u043D\u044F\u0442\u0430 \u043F\u0440\u0435\u0434\u044B\u0434\u0443\u0449\u0435\u0439 \u043A\u043E\u043C\u0430\u043D\u0434\u043E\u0439.");
    this.pending.add(entity);
    try {
      const before = await this.request("/api/states/" + entity);
      if (!stationSupports(before, action, request.value)) throw new Error("\u0424\u0443\u043D\u043A\u0446\u0438\u044F \u0441\u0442\u0430\u043D\u0446\u0438\u0438 \u043D\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u043D\u0430 \u0438\u043B\u0438 \u043D\u0435 \u043F\u043E\u0434\u0434\u0435\u0440\u0436\u0438\u0432\u0430\u0435\u0442\u0441\u044F \u0438\u043D\u0442\u0435\u0433\u0440\u0430\u0446\u0438\u0435\u0439.");
      const target = action === "volume" ? (e) => Number.isFinite(e.attributes?.volume_level) && Math.abs(e.attributes.volume_level - request.value / 100) <= 0.015 : (e) => e.state === (request.value ? "playing" : "paused");
      if (target(before)) return { id: request.id, value: request.value, confirmedAt: Date.now() };
      const service = action === "volume" ? "volume_set" : request.value ? "media_play" : "media_pause";
      await this.request("/api/services/media_player/" + service, { entity_id: entity, ...action === "volume" ? { volume_level: request.value / 100 } : {} });
      const deadline = Date.now() + 1e4;
      do {
        if (target(await this.request("/api/states/" + entity))) return { id: request.id, value: request.value, confirmedAt: Date.now() };
        await new Promise((r) => setTimeout(r, 350));
      } while (Date.now() < deadline);
      throw new Error("\u0421\u0442\u0430\u043D\u0446\u0438\u044F \u043D\u0435 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u043B\u0430 \u0441\u043E\u0441\u0442\u043E\u044F\u043D\u0438\u0435. \u041A\u043E\u043C\u0430\u043D\u0434\u0430 \u043C\u043E\u0433\u043B\u0430 \u0432\u044B\u043F\u043E\u043B\u043D\u0438\u0442\u044C\u0441\u044F; \u0430\u0432\u0442\u043E\u043C\u0430\u0442\u0438\u0447\u0435\u0441\u043A\u043E\u0433\u043E \u043F\u043E\u0432\u0442\u043E\u0440\u0430 \u043D\u0435\u0442.");
    } finally {
      this.pending.delete(entity);
    }
  }
};

// server/stream.js
import WebSocket from "ws";
import { randomBytes } from "node:crypto";
var assetPattern = /^(?:master_playlist\.m3u8|playlist\.m3u8|init\.mp4|segment\/\d+(?:\.\d+)?\.m4s)$/;
var CameraStreams = class {
  constructor(ha2) {
    this.ha = ha2;
    this.sessions = /* @__PURE__ */ new Map();
  }
  prune() {
    for (const [key, s] of this.sessions) if (s.expires < Date.now()) this.close(key);
  }
  close(key) {
    const s = this.sessions.get(key);
    if (s) for (const c of s.pending) c.abort();
    this.sessions.delete(key);
  }
  async start(id, preferences, owner) {
    this.prune();
    const entity = this.ha.cameraEntity(id, preferences);
    if (this.sessions.size >= 12) throw new Error("\u0421\u043B\u0438\u0448\u043A\u043E\u043C \u043C\u043D\u043E\u0433\u043E \u043E\u0442\u043A\u0440\u044B\u0442\u044B\u0445 \u043F\u0440\u043E\u0441\u043C\u043E\u0442\u0440\u043E\u0432. \u0417\u0430\u043A\u0440\u043E\u0439 \u0434\u0440\u0443\u0433\u043E\u0435 \u043E\u043A\u043D\u043E \u043A\u0430\u043C\u0435\u0440\u044B.");
    const url = await this.streamURL(entity);
    const match = /^\/api\/hls\/([a-f0-9]+)\/master_playlist\.m3u8$/.exec(url);
    if (!match) throw new Error("Home Assistant \u0432\u0435\u0440\u043D\u0443\u043B \u043D\u0435\u043F\u043E\u0434\u0434\u0435\u0440\u0436\u0438\u0432\u0430\u0435\u043C\u044B\u0439 \u0430\u0434\u0440\u0435\u0441 HLS.");
    const key = randomBytes(24).toString("hex");
    this.sessions.set(key, { owner, id, entity, token: match[1], expires: Date.now() + 9e4, pending: /* @__PURE__ */ new Set() });
    return { key, url: `ha/stream/${key}/master_playlist.m3u8` };
  }
  streamURL(entity) {
    const endpoint = new URL(this.ha.url);
    endpoint.protocol = endpoint.protocol === "https:" ? "wss:" : "ws:";
    endpoint.pathname = endpoint.hostname === "supervisor" ? "/core/websocket" : endpoint.pathname.replace(/\/$/, "") + "/api/websocket";
    return new Promise((resolve2, reject) => {
      let settled = false;
      const ws = new WebSocket(endpoint, { headers: { Authorization: `Bearer ${this.ha.token}` }, maxPayload: 1024 * 1024, followRedirects: false });
      const finish = (error, url) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        ws.close();
        error ? reject(error) : resolve2(url);
      };
      const timer = setTimeout(() => {
        finish(new Error("Home Assistant \u043D\u0435 \u043F\u043E\u0434\u0433\u043E\u0442\u043E\u0432\u0438\u043B \u043F\u043E\u0442\u043E\u043A \u0437\u0430 25 \u0441\u0435\u043A\u0443\u043D\u0434. \u041F\u0440\u043E\u0432\u0435\u0440\u044C \u0432\u0438\u0434\u0435\u043E \u0432 HA."));
        ws.terminate();
      }, 25e3);
      ws.on("error", () => finish(new Error("\u041D\u0435\u0442 \u0441\u043E\u0435\u0434\u0438\u043D\u0435\u043D\u0438\u044F \u0441 \u0432\u0438\u0434\u0435\u043E API Home Assistant.")));
      ws.on("close", () => {
        if (!settled) finish(new Error("\u0421\u043E\u0435\u0434\u0438\u043D\u0435\u043D\u0438\u0435 \u0441 \u0432\u0438\u0434\u0435\u043E API Home Assistant \u0437\u0430\u043A\u0440\u044B\u0442\u043E."));
      });
      ws.on("message", (bytes) => {
        try {
          const message = JSON.parse(bytes.toString());
          if (message.type === "auth_required") ws.send(JSON.stringify({ type: "auth", access_token: this.ha.token }));
          else if (message.type === "auth_invalid") finish(new Error("Home Assistant \u043E\u0442\u043A\u043B\u043E\u043D\u0438\u043B \u0430\u0432\u0442\u043E\u0440\u0438\u0437\u0430\u0446\u0438\u044E \u0432\u0438\u0434\u0435\u043E."));
          else if (message.type === "auth_ok") ws.send(JSON.stringify({ id: 1, type: "camera/stream", entity_id: entity, format: "hls" }));
          else if (message.type === "result" && message.id === 1) {
            if (message.success && typeof message.result?.url === "string") finish(null, message.result.url);
            else finish(new Error("\u041A\u0430\u043C\u0435\u0440\u0430 \u043D\u0435 \u043E\u0442\u0434\u0430\u043B\u0430 HLS-\u043F\u043E\u0442\u043E\u043A. \u041F\u0440\u043E\u0432\u0435\u0440\u044C \u0432\u043E\u0441\u043F\u0440\u043E\u0438\u0437\u0432\u0435\u0434\u0435\u043D\u0438\u0435 \u044D\u0442\u043E\u0439 \u0441\u0443\u0449\u043D\u043E\u0441\u0442\u0438 \u0432 Home Assistant \u0438 \u0438\u043D\u0442\u0435\u0433\u0440\u0430\u0446\u0438\u044E Stream."));
          }
        } catch {
          finish(new Error("\u041D\u0435\u043A\u043E\u0440\u0440\u0435\u043A\u0442\u043D\u044B\u0439 \u043E\u0442\u0432\u0435\u0442 \u0432\u0438\u0434\u0435\u043E API Home Assistant."));
        }
      });
    });
  }
  get(key, owner, p) {
    this.prune();
    const s = this.sessions.get(key);
    if (!s || s.owner !== owner) throw new Error("\u041F\u0440\u043E\u0441\u043C\u043E\u0442\u0440 \u0437\u0430\u0432\u0435\u0440\u0448\u0451\u043D. \u041E\u0442\u043A\u0440\u043E\u0439 \u043A\u0430\u043C\u0435\u0440\u0443 \u0437\u0430\u043D\u043E\u0432\u043E.");
    if (this.ha.cameraEntity(s.id, p) !== s.entity) {
      this.close(key);
      throw new Error("\u041F\u0440\u0438\u0432\u044F\u0437\u043A\u0430 \u043A\u0430\u043C\u0435\u0440\u044B \u0438\u0437\u043C\u0435\u043D\u0438\u043B\u0430\u0441\u044C. \u041E\u0442\u043A\u0440\u043E\u0439 \u0435\u0451 \u0437\u0430\u043D\u043E\u0432\u043E.");
    }
    s.expires = Date.now() + 9e4;
    return s;
  }
  async proxy(key, asset, query, owner, p, req, res) {
    if (!assetPattern.test(asset)) throw new Error("\u041D\u0435\u0434\u043E\u043F\u0443\u0441\u0442\u0438\u043C\u044B\u0439 \u0444\u0430\u0439\u043B \u043F\u043E\u0442\u043E\u043A\u0430.");
    const s = this.get(key, owner, p), params = new URLSearchParams();
    for (const [name, value] of query) {
      if (!["_HLS_msn", "_HLS_part", "_HLS_skip"].includes(name) || !(/^\d{1,12}$/.test(value) || name === "_HLS_skip" && ["YES", "v2"].includes(value))) throw new Error("\u041D\u0435\u0434\u043E\u043F\u0443\u0441\u0442\u0438\u043C\u044B\u0439 \u043F\u0430\u0440\u0430\u043C\u0435\u0442\u0440 \u043F\u043E\u0442\u043E\u043A\u0430.");
      params.set(name, value);
    }
    const controller = new AbortController();
    s.pending.add(controller);
    const abort = () => controller.abort(), timer = setTimeout(abort, 3e4);
    res.once("close", abort);
    try {
      const upstream = await fetch(`${this.ha.url}/api/hls/${s.token}/${asset}${params.size ? "?" + params : ""}`, {
        headers: { Authorization: `Bearer ${this.ha.token}` },
        redirect: "error",
        signal: controller.signal
      });
      if (!upstream.ok) {
        await upstream.body?.cancel();
        throw new Error(`\u041F\u043E\u0442\u043E\u043A Home Assistant \u043D\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u0435\u043D (${upstream.status}).`);
      }
      const playlist = asset.endsWith(".m3u8"), limit = playlist ? 512 * 1024 : 24 * 1024 * 1024;
      const reader = upstream.body.getReader(), parts = [];
      let size = 0;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.length;
          if (size > limit) throw new Error("\u0421\u043B\u0438\u0448\u043A\u043E\u043C \u0431\u043E\u043B\u044C\u0448\u043E\u0439 \u0444\u0440\u0430\u0433\u043C\u0435\u043D\u0442 \u0432\u0438\u0434\u0435\u043E.");
          parts.push(Buffer.from(value));
        }
      } finally {
        await reader.cancel();
      }
      let bytes = Buffer.concat(parts);
      if (playlist) {
        const text = bytes.toString("utf8");
        if (!text.startsWith("#EXTM3U")) throw new Error("\u041D\u0435\u043A\u043E\u0440\u0440\u0435\u043A\u0442\u043D\u044B\u0439 HLS-\u043F\u043B\u0435\u0439\u043B\u0438\u0441\u0442.");
        const rewrite = (value) => {
          const u = new URL(value, `http://stream/api/hls/${s.token}/${asset}`);
          const prefix = `/api/hls/${s.token}/`, relative = u.pathname.slice(prefix.length);
          if (u.origin !== "http://stream" || !u.pathname.startsWith(prefix) || !assetPattern.test(relative) || u.search || u.hash) throw new Error("\u041D\u0435\u043F\u043E\u0434\u0434\u0435\u0440\u0436\u0438\u0432\u0430\u0435\u043C\u044B\u0439 \u0440\u0435\u0441\u0443\u0440\u0441 HLS.");
          return `/api/panel/ha/stream/${key}/${relative}`;
        };
        bytes = Buffer.from(text.split("\n").map((line) => line.startsWith("#") ? line.replace(/URI="([^"]+)"/g, (_, value) => `URI="${rewrite(value)}"`) : line.trim() ? rewrite(line.trim()) : line).join("\n"));
      }
      if (!res.destroyed) {
        res.writeHead(200, { "Content-Type": playlist ? "application/vnd.apple.mpegurl" : asset === "init.mp4" ? "video/mp4" : "video/iso.segment", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer" });
        res.end(bytes);
      }
    } finally {
      clearTimeout(timer);
      res.removeListener("close", abort);
      s.pending.delete(controller);
    }
  }
};

// src/house-profile.js
var houseBindings = {
  "living:0": "light.gostinaia_levyi_vykliuchatel",
  "living:1": "light.gostinaia_pravyi_vykliuchatel",
  "hall:0": "light.prikhozhaia_levyi_vykliuchatel",
  "hall:1": "light.prikhozhaia_pravyi_vykliuchatel",
  "office:0": "light.kabinet_levyi_vykliuchatel",
  "office:1": "light.kabinet_pravyi_vykliuchatel",
  "bedroom:0": "light.spalnia_levyi_vykliuchatel",
  "bedroom:1": "light.spalnia_pravyi_vykliuchatel",
  "children:0": "light.detskaia_levyi_vykliuchatel",
  "children:1": "light.detskaia_pravyi_vykliuchatel",
  "bath:0": "light.vannaia_levyi_vykliuchatel",
  "bath:1": "light.vannaia_pravyi_vykliuchatel",
  "utility:0": "light.tualet_vykliuchatel",
  "pantry:0": "light.kladovaia_vykliuchatel",
  "temperature:living": "sensor.a4c1383cc159_temperature",
  "humidity:living": "sensor.a4c1383cc159_humidity",
  "temperature:well": "sensor.a4c1386265b5_temperature",
  "humidity:well": "sensor.a4c1386265b5_humidity",
  "temperature:attic": "sensor.cherdak_datchik_temperatury_temperatura",
  "humidity:attic": "sensor.cherdak_datchik_temperatury_vlazhnost",
  door: "binary_sensor.e4aaec90027a_contact",
  "terrace-motion": "sensor.terrasa_datchik_dvizheniia_dvizhenie",
  "terrace-lux": "sensor.terrasa_datchik_dvizheniia_osveshchennost",
  "camera-yard": "camera.c320ws_mainstream",
  "yard-motion": "binary_sensor.dvor_c320ws_motion_alarm",
  "master-event": "sensor.prikhozhaia_master_svet_knopka",
  "station": "media_player.yandex_station_c00mp0000t4w0z",
  "battery:living": "sensor.a4c1383cc159_battery",
  "battery:well": "sensor.a4c1386265b5_battery",
  "battery:attic": "sensor.cherdak_datchik_temperatury_uroven_zariada",
  "battery:door": "sensor.e4aaec90027a_battery",
  "battery:terrace": "sensor.terrasa_datchik_dvizheniia_uroven_zariada",
  "battery:master": "sensor.prikhozhaia_master_svet_uroven_zariada"
};
var extra = (id, type, room, name) => ({ id, type, room, name, status: "installed", masterOff: false, note: "\u041F\u043E \u0432\u044B\u0433\u0440\u0443\u0437\u043A\u0435 HA \xB7 \u0442\u043E\u043B\u044C\u043A\u043E \u043D\u0430\u0431\u043B\u044E\u0434\u0435\u043D\u0438\u0435" });
var houseExtras = [
  extra("station", "station", "living", "\u042F\u043D\u0434\u0435\u043A\u0441 \u0421\u0442\u0430\u043D\u0446\u0438\u044F \u0414\u0443\u043E \u041C\u0430\u043A\u0441"),
  extra("yard-motion", "motion", "yard", "\u0414\u0432\u0438\u0436\u0435\u043D\u0438\u0435 \xB7 \u043A\u0430\u043C\u0435\u0440\u0430 \u0434\u0432\u043E\u0440\u0430"),
  extra("master-event", "button_event", "hall", "\u041C\u0430\u0441\u0442\u0435\u0440-\u0441\u0432\u0435\u0442 \xB7 \u043F\u043E\u0441\u043B\u0435\u0434\u043D\u0435\u0435 \u0441\u043E\u0431\u044B\u0442\u0438\u0435"),
  ...[
    ["living", "living", "\u0411\u0430\u0442\u0430\u0440\u0435\u0439\u043A\u0430 \xB7 \u0433\u043E\u0441\u0442\u0438\u043D\u0430\u044F"],
    ["well", "well", "\u0411\u0430\u0442\u0430\u0440\u0435\u0439\u043A\u0430 \xB7 \u0441\u043A\u0432\u0430\u0436\u0438\u043D\u0430"],
    ["attic", "attic", "\u0411\u0430\u0442\u0430\u0440\u0435\u0439\u043A\u0430 \xB7 \u0447\u0435\u0440\u0434\u0430\u043A"],
    ["door", "hall", "\u0411\u0430\u0442\u0430\u0440\u0435\u0439\u043A\u0430 \xB7 \u0432\u0445\u043E\u0434\u043D\u0430\u044F \u0434\u0432\u0435\u0440\u044C"],
    ["terrace", "terrace", "\u0411\u0430\u0442\u0430\u0440\u0435\u0439\u043A\u0430 \xB7 \u0434\u0432\u0438\u0436\u0435\u043D\u0438\u0435 \u0442\u0435\u0440\u0440\u0430\u0441\u044B"],
    ["master", "hall", "\u0411\u0430\u0442\u0430\u0440\u0435\u0439\u043A\u0430 \xB7 \u043C\u0430\u0441\u0442\u0435\u0440-\u043A\u043D\u043E\u043F\u043A\u0430"]
  ].map(([id, room, name]) => extra("battery:" + id, "battery", room, name))
];
function migrateHouseProfile(input) {
  if (input.housePresetVersion === 1) return input;
  const p = JSON.parse(JSON.stringify(input));
  for (const d of houseExtras) if (!p.devices.some((x) => x.id === d.id)) p.devices.push({ ...d });
  const bath = p.devices.find((d) => d.id === "bath:1");
  if (bath?.status === "planned" && !p.bindings["bath:1"]?.entityId) {
    bath.status = "installed";
    bath.note = "\u041F\u0440\u0430\u0432\u0430\u044F \u043A\u043B\u0430\u0432\u0438\u0448\u0430 \xB7 \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u0430";
  }
  p.devices = p.devices.filter((d) => d.id !== "pump" || p.bindings.pump?.entityId);
  for (const d of p.devices) {
    const entityId = houseBindings[d.id], old = p.bindings[d.id];
    if (entityId && !old?.entityId && d.status === "installed") {
      p.bindings[d.id] = { entityId, verified: false };
      if (d.type !== "light") d.note = d.type === "station" ? "Yandex Station \xB7 \u043A\u043E\u043C\u0430\u043D\u0434\u044B \u0438 \u0441\u0442\u0430\u0442\u0443\u0441\u044B \u0447\u0435\u0440\u0435\u0437 HA" : "\u0421\u0443\u0449\u043D\u043E\u0441\u0442\u044C HA \u0438\u0437 \u0432\u044B\u0433\u0440\u0443\u0437\u043A\u0438 \u0434\u043E\u043C\u0430";
    }
    if (d.id === "smoke" && !old?.entityId) d.status = "planned";
  }
  p.housePresetVersion = 1;
  return validatePreferences(p);
}
function bindingProblem(d, e) {
  const t = deviceTypes[d.type];
  if (!e || ["unknown", "unavailable", ""].includes(e.state)) return "\u043D\u0435\u0442 \u0434\u043E\u0441\u0442\u0443\u043F\u043D\u043E\u0433\u043E \u0441\u043E\u0441\u0442\u043E\u044F\u043D\u0438\u044F";
  if (!t.domains.includes(e.entity_id.split(".")[0])) return "\u043D\u0435\u0432\u0435\u0440\u043D\u044B\u0439 \u0434\u043E\u043C\u0435\u043D";
  if (t.controllable && d.type !== "station" && !["on", "off"].includes(e.state)) return "\u043D\u0435\u0442 \u0441\u043E\u0441\u0442\u043E\u044F\u043D\u0438\u044F on/off";
  if (t.classes) {
    if (!t.classes.includes(e.attributes?.device_class)) return "\u043D\u0435\u0432\u0435\u0440\u043D\u044B\u0439 \u043A\u043B\u0430\u0441\u0441 \u0434\u0430\u0442\u0447\u0438\u043A\u0430";
    if (e.entity_id.startsWith("binary_sensor.") && !["on", "off"].includes(e.state)) return "\u043D\u0435\u0442 \u0441\u043E\u0441\u0442\u043E\u044F\u043D\u0438\u044F on/off";
  }
  if (t.unit && (e.attributes?.unit_of_measurement !== t.unit || !Number.isFinite(Number(e.state)))) return "\u043D\u0435\u0432\u0435\u0440\u043D\u0430\u044F \u0435\u0434\u0438\u043D\u0438\u0446\u0430 \u0438\u043B\u0438 \u0437\u043D\u0430\u0447\u0435\u043D\u0438\u0435";
  if (d.type === "battery" && (Number(e.state) < 0 || Number(e.state) > 100)) return "\u0437\u0430\u0440\u044F\u0434 \u0432\u043D\u0435 \u0434\u0438\u0430\u043F\u0430\u0437\u043E\u043D\u0430 0\u2013100";
  return "";
}
function activateHouseProfile(input, states) {
  const p = validatePreferences(input), byEntity = new Map(states.map((e) => [e.entity_id, e])), report = [];
  for (const d of p.devices) {
    const b = p.bindings[d.id];
    if (d.status !== "installed" || !houseBindings[d.id] || b.entityId !== houseBindings[d.id]) continue;
    const problem = bindingProblem(d, byEntity.get(b.entityId));
    b.verified = !problem;
    report.push({ id: d.id, name: d.name, entityId: b.entityId, ok: !problem, problem });
  }
  p.mode = "live";
  return { preferences: validatePreferences(p), report };
}

// server/index.js
var port = Number(process.env.PORT || 8080);
var preview = process.env.PANEL_PREVIEW === "1";
var addon = process.env.PANEL_ADDON === "1";
if (addon && preview) throw new Error("Home Panel: add-on must not run in preview mode.");
var root = resolve(process.env.PANEL_ROOT || "dist");
var data = resolve(process.env.PANEL_DATA || "data");
await mkdir(data, { recursive: true });
var db = new Database(resolve(data, "panel.sqlite"));
db.pragma("journal_mode = WAL");
db.exec("CREATE TABLE IF NOT EXISTS profiles (id TEXT PRIMARY KEY, preferences TEXT NOT NULL, photo BLOB);");
var ha = new HomeAssistant({ url: process.env.HA_URL, token: process.env.HA_TOKEN, preview });
var streams = new CameraStreams(ha);
setInterval(() => streams.prune(), 3e4).unref();
var proofs = /* @__PURE__ */ new Map();
var pendingScopes = /* @__PURE__ */ new Map();
var getProfile = (id) => {
  let row = db.prepare("SELECT * FROM profiles WHERE id=?").get(id);
  if (!row) {
    db.prepare("INSERT INTO profiles(id,preferences) VALUES(?,?)").run(id, JSON.stringify(defaultPreferences()));
    row = db.prepare("SELECT * FROM profiles WHERE id=?").get(id);
  }
  const stored = validatePreferences(JSON.parse(row.preferences));
  const preferences = migrateHouseProfile(stored);
  if (preferences !== stored) db.prepare("UPDATE profiles SET preferences=? WHERE id=?").run(JSON.stringify(preferences), id);
  return { preferences, photo: row.photo };
};
var json = (res, code, body2) => {
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
  res.end(JSON.stringify(body2));
};
async function body(req, max = 131072) {
  const chunks = [];
  let n = 0;
  for await (const c of req) {
    n += c.length;
    if (n > max) throw new Error("\u0424\u0430\u0439\u043B \u0438\u043B\u0438 \u0437\u0430\u043F\u0440\u043E\u0441 \u0441\u043B\u0438\u0448\u043A\u043E\u043C \u0431\u043E\u043B\u044C\u0448\u043E\u0439.");
    chunks.push(c);
  }
  return Buffer.concat(chunks);
}
function identify(req) {
  if (addon) {
    const address = (req.socket.remoteAddress || "").replace(/^::ffff:/, "");
    const hostname = new URL("http://" + (req.headers.host || "")).hostname.replace(/^\[|\]$/g, "");
    const privateAddress = (ip) => ip === "::1" || /^f[cd][0-9a-f]*:/i.test(ip) || /^fe80:/i.test(ip) || isIP(ip) === 4 && (ip.startsWith("10.") || ip.startsWith("192.168.") || ip.startsWith("127.") || /^172\.(1[6-9]|2\d|3[01])\./.test(ip));
    if (!privateAddress(address)) throw new Error("Home Panel \u0434\u043E\u0441\u0442\u0443\u043F\u043D\u0430 \u0442\u043E\u043B\u044C\u043A\u043E \u0438\u0437 \u043B\u043E\u043A\u0430\u043B\u044C\u043D\u043E\u0439 \u0441\u0435\u0442\u0438.");
    if (!privateAddress(hostname) && hostname !== "localhost" && !/^[a-z0-9-]+\.local$/i.test(hostname)) throw new Error("\u041E\u0442\u043A\u0440\u043E\u0439 \u043F\u0430\u043D\u0435\u043B\u044C \u043F\u043E \u043B\u043E\u043A\u0430\u043B\u044C\u043D\u043E\u043C\u0443 IP \u0438\u043B\u0438 \u0438\u043C\u0435\u043D\u0438 .local.");
    return "home";
  }
  const host = req.headers.host || "", direct = /^(localhost|127\.0\.0\.1|\[::1\]):\d+$/.test(host);
  const visitor = req.headers["x-visitor-id"];
  if (preview && visitor) return "preview:" + createHash("sha256").update(String(visitor)).digest("hex");
  if (direct && ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(req.socket.remoteAddress)) return "local";
  throw new Error("\u0414\u043E\u0441\u0442\u0443\u043F \u0440\u0430\u0437\u0440\u0435\u0448\u0451\u043D \u0442\u043E\u043B\u044C\u043A\u043E \u0441 \u044D\u0442\u043E\u0433\u043E \u043A\u043E\u043C\u043F\u044C\u044E\u0442\u0435\u0440\u0430 \u0438\u043B\u0438 \u0447\u0435\u0440\u0435\u0437 \u043F\u0440\u0438\u0432\u0430\u0442\u043D\u043E\u0435 \u043F\u0440\u0435\u0432\u044C\u044E.");
}
function authorize(req, id) {
  const expected = proofs.get(id), actual = String(req.headers["x-panel-proof"] || "");
  if (!expected || Buffer.byteLength(actual) !== Buffer.byteLength(expected) || !timingSafeEqual(Buffer.from(actual), Buffer.from(expected))) throw new Error("\u041F\u0435\u0440\u0435\u0437\u0430\u0433\u0440\u0443\u0437\u0438 \u043F\u0430\u043D\u0435\u043B\u044C: \u0437\u0430\u0449\u0438\u0442\u043D\u044B\u0439 \u043A\u043B\u044E\u0447 \u043E\u0442\u0441\u0443\u0442\u0441\u0442\u0432\u0443\u0435\u0442.");
  const origin = req.headers.origin;
  const allowed = addon ? [`http://${req.headers.host}`] : [`http://localhost:${port}`, `http://127.0.0.1:${port}`, `http://[::1]:${port}`];
  if (!preview && origin && !allowed.includes(origin)) throw new Error("\u0417\u0430\u043F\u0440\u043E\u0441 \u0438\u0437 \u0434\u0440\u0443\u0433\u043E\u0439 \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u044B \u0437\u0430\u043F\u0440\u0435\u0449\u0451\u043D.");
  if (!preview && req.headers["sec-fetch-site"] === "cross-site") throw new Error("\u041C\u0435\u0436\u0441\u0430\u0439\u0442\u043E\u0432\u044B\u0439 \u0437\u0430\u043F\u0440\u043E\u0441 \u0437\u0430\u043F\u0440\u0435\u0449\u0451\u043D.");
}
var server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost"), path = decodeURIComponent(url.pathname);
    if (path === "/health" && req.method === "GET") return json(res, 200, { ok: true });
    if (path.startsWith("/api/panel/")) {
      const id = identify(req), p = getProfile(id), route = path.slice("/api/panel/".length);
      if (req.method === "GET" && route === "bootstrap") {
        if (!proofs.has(id)) proofs.set(id, randomBytes2(32).toString("hex"));
        return json(res, 200, { preferences: p.preferences, photo: !!p.photo, proof: proofs.get(id), preview, addon, haConfigured: ha.enabled });
      }
      if (req.method !== "GET") authorize(req, id);
      if (route === "house-profile" && req.method === "POST") {
        if (preview) throw new Error("\u041F\u0440\u043E\u0444\u0438\u043B\u044C \u0434\u043E\u043C\u0430 \u043F\u0440\u0438\u043C\u0435\u043D\u044F\u0435\u0442\u0441\u044F \u0442\u043E\u043B\u044C\u043A\u043E \u043D\u0430 \u043B\u043E\u043A\u0430\u043B\u044C\u043D\u043E\u0439 \u043F\u0430\u043D\u0435\u043B\u0438.");
        if (pendingScopes.has(id)) throw new Error("\u0421\u043D\u0430\u0447\u0430\u043B\u0430 \u0434\u043E\u0436\u0434\u0438\u0441\u044C \u0437\u0430\u0432\u0435\u0440\u0448\u0435\u043D\u0438\u044F \u043A\u043E\u043C\u0430\u043D\u0434\u044B.");
        const result = activateHouseProfile(p.preferences, await ha.states());
        if (!result.report.some((r) => r.ok)) throw new Error("\u041D\u0438 \u043E\u0434\u043D\u0430 \u0441\u0443\u0449\u043D\u043E\u0441\u0442\u044C \u043F\u0440\u043E\u0444\u0438\u043B\u044F \u043D\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u043D\u0430. \u041F\u0440\u043E\u0432\u0435\u0440\u044C \u0438\u043D\u0442\u0435\u0433\u0440\u0430\u0446\u0438\u0438 \u0438 \u043F\u0440\u0438\u0432\u044F\u0437\u043A\u0438.");
        db.prepare("UPDATE profiles SET preferences=? WHERE id=?").run(JSON.stringify(result.preferences), id);
        return json(res, 200, result);
      }
      if (route === "preferences" && req.method === "PUT") {
        if (pendingScopes.has(id)) throw new Error("\u0421\u043D\u0430\u0447\u0430\u043B\u0430 \u0434\u043E\u0436\u0434\u0438\u0441\u044C \u0437\u0430\u0432\u0435\u0440\u0448\u0435\u043D\u0438\u044F \u043A\u043E\u043C\u0430\u043D\u0434\u044B.");
        const next = validatePreferences(JSON.parse((await body(req)).toString()));
        for (const d of next.devices) {
          const old = p.preferences.devices.find((old2) => old2.id === d.id);
          if (old && old.type !== d.type) throw new Error("\u0422\u0438\u043F \u0441\u0443\u0449\u0435\u0441\u0442\u0432\u0443\u044E\u0449\u0435\u0433\u043E \u0443\u0441\u0442\u0440\u043E\u0439\u0441\u0442\u0432\u0430 \u043D\u0435\u043B\u044C\u0437\u044F \u043C\u0435\u043D\u044F\u0442\u044C.");
          if (!samePhysicalDevice(old, d)) next.bindings[d.id].verified = false;
        }
        const newVerified = bindingDefinitions(next.devices).filter((d) => {
          const b = next.bindings[d.id], old = p.preferences.bindings[d.id];
          return b.verified && (!old?.verified || old.entityId !== b.entityId);
        });
        if (newVerified.length) {
          const list = await ha.states(), entities = new Map(list.map((e) => [e.entity_id, e]));
          for (const def of newVerified) {
            const e = entities.get(next.bindings[def.id].entityId);
            if (!e) throw new Error(`\u0421\u0443\u0449\u043D\u043E\u0441\u0442\u044C \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u0430: ${def.name}`);
            const problem = bindingProblem(def.device, e);
            if (problem) throw new Error(`${def.name}: ${problem}.`);
          }
        }
        db.prepare("UPDATE profiles SET preferences=? WHERE id=?").run(JSON.stringify(next), id);
        return json(res, 200, { saved: true, preferences: next });
      }
      if (route === "photo") {
        if (req.method === "GET" && p.photo) {
          res.writeHead(200, { "Content-Type": "image/jpeg", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
          return res.end(p.photo);
        }
        if (req.method === "PUT") {
          if (preview) throw new Error("\u0412 \u043E\u0431\u043B\u0430\u0447\u043D\u043E\u043C \u043F\u0440\u0435\u0432\u044C\u044E \u0444\u043E\u0442\u043E \u043D\u0435 \u0441\u043E\u0445\u0440\u0430\u043D\u044F\u0435\u0442\u0441\u044F. \u0418\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u0439 \u043B\u043E\u043A\u0430\u043B\u044C\u043D\u044B\u0439 \u0437\u0430\u043F\u0443\u0441\u043A.");
          const bytes = await body(req, 2 * 1024 * 1024);
          if (req.headers["content-type"] !== "image/jpeg" || bytes[0] !== 255 || bytes[1] !== 216 || bytes.at(-2) !== 255 || bytes.at(-1) !== 217) throw new Error("\u041D\u0443\u0436\u0435\u043D \u043A\u043E\u0440\u0440\u0435\u043A\u0442\u043D\u044B\u0439 JPEG \u0434\u043E 2 \u041C\u0411.");
          db.prepare("UPDATE profiles SET photo=? WHERE id=?").run(bytes, id);
          return json(res, 200, { saved: true });
        }
        if (req.method === "DELETE") {
          db.prepare("UPDATE profiles SET photo=NULL WHERE id=?").run(id);
          return json(res, 200, { saved: true });
        }
      }
      if (route === "ha/states" && req.method === "GET") return json(res, 200, { states: await ha.states(), receivedAt: Date.now() });
      if (route === "ha/stream/start" && req.method === "POST") {
        const request = JSON.parse((await body(req)).toString());
        return json(res, 200, await streams.start(request.id, p.preferences, id));
      }
      const streamRoute = /^ha\/stream\/([a-f0-9]{48})(?:\/(.+))?$/.exec(route);
      if (streamRoute) {
        const [, key, asset] = streamRoute;
        if (req.method === "DELETE" && !asset) {
          streams.get(key, id, p.preferences);
          streams.close(key);
          return json(res, 200, { stopped: true });
        }
        if (req.method === "GET" && asset) {
          if (req.headers["sec-fetch-site"] === "cross-site") throw new Error("\u041C\u0435\u0436\u0441\u0430\u0439\u0442\u043E\u0432\u044B\u0439 \u0437\u0430\u043F\u0440\u043E\u0441 \u0437\u0430\u043F\u0440\u0435\u0449\u0451\u043D.");
          return await streams.proxy(key, asset, url.searchParams, id, p.preferences, req, res);
        }
      }
      if (route === "ha/camera" && req.method === "POST") {
        const request = JSON.parse((await body(req)).toString()), image = await ha.camera(request.id, p.preferences);
        res.writeHead(200, { "Content-Type": image.type, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
        return res.end(image.bytes);
      }
      if (route === "ha/command" && req.method === "POST") {
        const request = JSON.parse((await body(req)).toString());
        pendingScopes.set(id, (pendingScopes.get(id) || 0) + 1);
        try {
          return json(res, 200, await ha.command(request, p.preferences));
        } finally {
          const n = pendingScopes.get(id) - 1;
          if (n) pendingScopes.set(id, n);
          else pendingScopes.delete(id);
        }
      }
      return json(res, 404, { error: "\u041C\u0430\u0440\u0448\u0440\u0443\u0442 \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D." });
    }
    if (req.method !== "GET" && req.method !== "HEAD") return json(res, 405, { error: "\u041C\u0435\u0442\u043E\u0434 \u0437\u0430\u043F\u0440\u0435\u0449\u0451\u043D." });
    const relative = path === "/" ? "index.html" : path.slice(1);
    if (!/^(index\.html|style\.css|app\.js|model-[A-Za-z0-9_-]+\.js|assets\/[A-Za-z0-9_./-]+\.(webp|woff2|ttf|txt|js))$/.test(relative) || relative.includes("..")) return json(res, 404, { error: "\u0424\u0430\u0439\u043B \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D." });
    const file = resolve(root, relative);
    await stat(file);
    const type = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".webp": "image/webp", ".woff2": "font/woff2", ".ttf": "font/ttf", ".txt": "text/plain; charset=utf-8" }[extname(file)];
    res.writeHead(200, { "Content-Type": type, "Cache-Control": "no-cache", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "same-origin" });
    res.end(req.method === "HEAD" ? void 0 : await readFile(file));
  } catch (error) {
    if (res.headersSent) return res.end();
    const message = error instanceof SyntaxError ? "\u041D\u0435\u043A\u043E\u0440\u0440\u0435\u043A\u0442\u043D\u044B\u0439 JSON." : error.code === "ENOENT" ? "\u0424\u0430\u0439\u043B \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D." : error.message;
    json(res, error.code === "ENOENT" ? 404 : 400, { error: message });
  }
});
server.requestTimeout = 25e3;
server.listen(port, preview || addon ? "0.0.0.0" : "127.0.0.1", () => {
  console.log(`Panel ready: port ${port} \xB7 ${addon ? "Home Assistant add-on" : preview ? "private preview" : "local only"} \xB7 HA ${ha.enabled ? "configured" : "not configured"}`);
  if (process.platform === "win32" && process.argv.includes("--open")) spawn("rundll32.exe", ["url.dll,FileProtocolHandler", `http://127.0.0.1:${port}`], { stdio: "ignore" }).on("error", () => {
  });
});
server.on("error", (error) => {
  console.error(error.code === "EADDRINUSE" ? `Port ${port} is busy. Close the other panel server or set PORT in .env.` : "Panel server could not start.");
  process.exitCode = 1;
});
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => server.close(() => {
  db.close();
  process.exit(0);
}));
