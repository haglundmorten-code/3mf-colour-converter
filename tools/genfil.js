// Builds filaments.js: every PrusaSlicer filament profile the supported printers can use.
//  p29[name]: PrusaSlicer 2.9 per-extruder config values (vendor bundle, resolved through "inherits"), only where they
//             differ from the printer template's PLA value. Lists per printer come from --query-print-filament-profiles.
//  p3[name]:  PrusaSlicer 3.0 per-tool values from real 3.0 exports (8 filaments per INDX 8T export), only where they
//             differ from the template; plus the material preset and the material the tool reports.
// Each Prusa profile in prusa-profiles.js gets filaments29 / filaments3: display name -> key in p29 / p3.
const fs = require('fs');
const { execSync } = require('child_process');
const SP = 'C:/Users/Morten/AppData/Local/Temp/claude/E--Bambu-fix/a09e335c-06b9-486b-9c7d-e4b8b813340b/scratchpad';
const SITE = 'E:/Bambu fix';
const { loadBundle, filamentValues } = require('./ini29.js');
const PRUSA = require(SITE + '/prusa-profiles.js');

const display = (n) => n.replace(/\s*@.*$/, '').trim();
function splitQ(v) {
  const out = []; let cur = '', q = false;
  for (let i = 0; i < v.length; i++) {
    const c = v[i];
    if (c === '"' && v[i - 1] !== '\\') q = !q;
    if (c === ';' && !q) { out.push(cur); cur = ''; } else cur += c;
  }
  out.push(cur);
  return out;
}
const configValue = (config, key) => { const m = new RegExp(`^${key} = (.*)$`, 'm').exec(config); return m ? m[1] : null; };
const SKIP29 = new Set(['filament_colour', 'extruder_colour', 'filament_settings_id']);

// ---------------------------------------------------------------- 2.9
const bundle = loadBundle(SP + '/dd2/vendor/PrusaResearch.ini');
const PRINT29 = { core1mmu3: '0.20mm BALANCED @COREONE HF0.4', core1lmmu3: '0.20mm BALANCED @COREONEL HF0.4', core1indx4t: '0.20mm Balanced ★ @COREONEINDX HF0.4', core1indx8t: '0.20mm Balanced ★ @COREONEINDX HF0.4' };
const p29 = {};
for (const p of PRUSA) {
  const q = JSON.parse(fs.readFileSync(`${__dirname}/q29_${p.id}.json`, 'utf8'));
  const names = q.print_profiles.find((x) => x.name === PRINT29[p.id]).filament_profiles.map((f) => f.name || f);
  p.filaments29 = {};
  for (const name of names) {
    let vals;
    try { vals = filamentValues(bundle, name); } catch (e) { console.log('skip 2.9', name, e.message); continue; }
    const out = {};
    for (const [k, raw] of Object.entries(vals)) {
      if (SKIP29.has(k)) continue;
      const cur = configValue(p.config, k);
      if (cur == null) continue;
      let items = splitQ(cur), sep = ';';
      if (items.length !== p.extruders) { items = cur.split(','); sep = ','; }
      if (items.length !== p.extruders) continue;
      let v = raw.trim();
      if (sep === ';' && items[0].startsWith('"') && !v.startsWith('"')) v = `"${v}"`;
      if (sep === ',' && v.includes(',')) continue;
      if (v !== items[0]) out[k] = v;
    }
    out.filament_settings_id = `"${name}"`;
    const type = (vals.filament_type || '').trim();
    if (p29[name] && JSON.stringify(p29[name].values) !== JSON.stringify(out)) throw new Error('2.9 values differ between printers for ' + name);
    p29[name] = { type, values: out };
    p.filaments29[display(name)] = name;
  }
  console.log('2.9', p.id, Object.keys(p.filaments29).length);
}

// ---------------------------------------------------------------- 3.0
const p3 = {};
const tmpl = PRUSA.find((p) => p.project3).project3.configuration.filament_settings;
const b3 = SP + '/ft/b3';
for (const f of fs.readdirSync(b3).filter((x) => /^b\d+\.txt$/.test(x))) {
  const clis = fs.readFileSync(`${b3}/${f}`, 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean);
  const g = JSON.parse(execSync(`unzip -p "${b3}/${f.replace('.txt', '.3mf')}" Metadata/PrusaSlicer3_project.json`, { maxBuffer: 1 << 26 }).toString()).config_containers[0];
  const tools = g.preset.hw_config.tools;
  clis.forEach((cli, i) => {
    const mat = g.preset.materials[i];
    const name = mat.root_id;
    if (display(cli.replace(/@COREONEINDX.*$/, '')) !== name) throw new Error(`tool ${i} of ${f}: ${name} vs ${cli}`);
    const filament = {};
    for (const [k, arr] of Object.entries(g.configuration.filament_settings)) {
      if (JSON.stringify(arr[i]) !== JSON.stringify(tmpl[k] && tmpl[k][0])) filament[k] = arr[i];
    }
    p3[name] = { type: g.configuration.filament_settings.filament_type[i], filament, material: mat, slicerMaterial: tools[String(i)].slicer_material };
  });
}
for (const p of PRUSA) if (p.project3) {
  p.filaments3 = {};
  for (const name of Object.keys(p3).sort()) p.filaments3[name] = name;
  console.log('3.0', p.id, Object.keys(p.filaments3).length);
}
// Material condition lists repeat a lot; keep each once.
const conds = [];
const condIndex = new Map();
for (const v of Object.values(p3)) {
  const key = JSON.stringify(v.material.conditions || []);
  if (!condIndex.has(key)) { condIndex.set(key, conds.length); conds.push(v.material.conditions || []); }
  v.material = Object.assign({}, v.material, { conditions: condIndex.get(key) });
}

// ---------------------------------------------------------------- write
const data = { p29, p3, conditions: conds };
const js = `/*
 * Every PrusaSlicer filament profile the converter can write (see prusa-profiles.js for which printer has which).
 * p29: PrusaSlicer 2.9 per-extruder config values, resolved from the 2.9 vendor bundle; only values that differ from the
 * printer's PLA template. p3: PrusaSlicer 3.0 per-tool values from 3.0 exports (also only the differences), the material
 * preset (conditions: index into conditions) and the material the tool reports.
 */
(function (root) {
  const FILAMENTS = ${JSON.stringify(data)};
  if (typeof module === 'object' && module.exports) module.exports = FILAMENTS; else root.PRUSA_FILAMENTS = FILAMENTS;
})(typeof self !== 'undefined' ? self : this);
`;
fs.writeFileSync(SITE + '/filaments.js', js);
console.log('filaments.js', js.length, 'bytes;', Object.keys(p29).length, '2.9 and', Object.keys(p3).length, '3.0 profiles,', conds.length, 'condition lists');

const pjs = fs.readFileSync(SITE + '/prusa-profiles.js', 'utf8');
const head = pjs.slice(0, pjs.indexOf('(function (root)'));
fs.writeFileSync(SITE + '/prusa-profiles.js', head + '(function (root) {\n  const PROFILES = ' + JSON.stringify(PRUSA) + ";\n  if (typeof module === 'object' && module.exports) module.exports = PROFILES; else root.PRUSA_PROFILES = PROFILES;\n})(typeof self !== 'undefined' ? self : this);\n");
console.log('prusa-profiles.js updated');
