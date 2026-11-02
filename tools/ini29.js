// Resolves [filament:...] presets from a PrusaSlicer 2.x vendor bundle, following "inherits" like PrusaSlicer does.
const fs = require('fs');
const META = new Set(['inherits', 'compatible_printers', 'compatible_printers_condition', 'compatible_prints', 'compatible_prints_condition', 'renamed_from', 'alias', 'filament_settings_id']);

function loadBundle(path) {
  const sections = new Map();
  let cur = null;
  for (const line of fs.readFileSync(path, 'utf8').split(/\r?\n/)) {
    const h = /^\[filament:(.+)\]\s*$/.exec(line);
    if (h) { cur = new Map(); sections.set(h[1], cur); continue; }
    if (/^\[/.test(line)) { cur = null; continue; }
    const m = cur && /^([a-z0-9_]+)\s*=\s*(.*)$/.exec(line);
    if (m) cur.set(m[1], m[2]);
  }
  return sections;
}

function resolve(sections, name, seen = new Set()) {
  const s = sections.get(name);
  if (!s) throw new Error('No filament preset ' + name);
  if (seen.has(name)) throw new Error('Inheritance loop at ' + name);
  seen.add(name);
  const out = new Map();
  const inh = s.get('inherits');
  if (inh) for (const p of inh.split(';').map((x) => x.trim()).filter(Boolean)) for (const [k, v] of resolve(sections, p, new Set(seen))) out.set(k, v);
  for (const [k, v] of s) out.set(k, v);
  return out;
}

// The preset's own values, without keys that only describe the preset.
function filamentValues(sections, name) {
  const r = resolve(sections, name);
  const o = {};
  for (const [k, v] of r) if (!META.has(k)) o[k] = v;
  return o;
}

module.exports = { loadBundle, resolve, filamentValues };
if (require.main === module) {
  const b = loadBundle(process.argv[2]);
  for (const n of process.argv.slice(3)) {
    const v = filamentValues(b, n);
    console.log(n, '->', Object.keys(v).length, 'keys', ['filament_type', 'temperature', 'first_layer_temperature', 'bed_temperature', 'filament_max_volumetric_speed', 'filament_vendor'].map((k) => `${k}=${v[k]}`).join(' '));
  }
}
