// Adds filament types (materials) to prusa-profiles.js and bambu-profiles.js.
//  PrusaSlicer 2.9: values resolved from the vendor bundle, formatted like the profile's own config lines.
//  PrusaSlicer 3.0: per-tool values from a real 3.0 export with a different material on each tool.
//  Bambu Studio: system preset name, filament id and type, plus its values for the per-filament keys.
const fs = require('fs');
const { execSync } = require('child_process');
const SP = 'C:/Users/Morten/AppData/Local/Temp/claude/E--Bambu-fix/a09e335c-06b9-486b-9c7d-e4b8b813340b/scratchpad';
const SITE = 'E:/Bambu fix';
const { loadBundle, filamentValues } = require('./ini29.js');
const bbl = require('./bbl.js');

const PRUSA = require(SITE + '/prusa-profiles.js');
const BAMBU = require(SITE + '/bambu-profiles.js');

// ---------------------------------------------------------------- PrusaSlicer 2.9
const bundle = loadBundle(SP + '/dd2/vendor/PrusaResearch.ini');
const NAMES29 = {
  COREONE: { PLA: 'Generic PLA @COREONE HF0.4', PETG: 'Generic PETG @COREONE HF0.4', ASA: 'Prusament ASA @COREONE HF0.4', PC: 'Prusament PC Blend @COREONE HF0.4' },
  COREONEINDX: {
    PLA: 'Generic PLA @COREONEINDX HF0.4', PETG: 'Generic PETG @COREONEINDX HF0.4', ABS: 'Generic ABS @COREONEINDX HF0.4',
    ASA: 'Prusament ASA @COREONEINDX HF0.4', PC: 'Prusament PC Blend @COREONEINDX HF0.4', TPU: 'Generic FLEX @COREONEINDX HF0.4',
  },
};
const SKIP29 = new Set(['filament_colour', 'extruder_colour', 'filament_settings_id']);
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
function configValue(config, key) { const m = new RegExp(`^${key} = (.*)$`, 'm').exec(config); return m ? m[1] : null; }

for (const p of PRUSA) {
  const fam = /INDX/.test(p.printer) ? 'COREONEINDX' : 'COREONE';
  const n = p.extruders;
  p.materials = {};
  for (const [type, name] of Object.entries(NAMES29[fam])) {
    const vals = filamentValues(bundle, name);
    const out = {};
    for (const [k, raw] of Object.entries(vals)) {
      if (SKIP29.has(k)) continue;
      const cur = configValue(p.config, k);
      if (cur == null) continue;
      let sep = null;
      if (splitQ(cur).length === n) sep = ';';
      else if (cur.split(',').length === n) sep = ',';
      if (!sep) continue; // not one value per extruder
      let v = raw.trim();
      if (sep === ';' && splitQ(cur)[0].startsWith('"') && !v.startsWith('"')) v = `"${v}"`;
      if (sep === ',' && v.includes(',')) continue;
      out[k] = v;
    }
    out.filament_settings_id = `"${name}"`;
    p.materials[type] = out;
  }
  console.log('2.9', p.id, Object.entries(p.materials).map(([t, o]) => `${t}:${Object.keys(o).length}`).join(' '));
}

// ---------------------------------------------------------------- PrusaSlicer 3.0
const mix = JSON.parse(execSync(`unzip -p "${SP}/ft/mixA.3mf" Metadata/PrusaSlicer3_project.json`, { maxBuffer: 1 << 26 }).toString()).config_containers[0];
const TOOLS3 = { PLA: 0, PETG: 1, ASA: 2, PC: 3 };
const mat3 = {};
for (const [type, i] of Object.entries(TOOLS3)) {
  const filament = {};
  for (const [k, arr] of Object.entries(mix.configuration.filament_settings)) filament[k] = arr[i];
  const tool = mix.preset.hw_config.tools[i];
  mat3[type] = { filament, material: mix.preset.materials[i], slicerMaterial: tool.slicer_material };
  if (filament.filament_type !== type) throw new Error(`3.0 tool ${i} is ${filament.filament_type}, expected ${type}`);
}
for (const p of PRUSA) if (p.project3) {
  // Every key of the template must be covered, or tools would mix materials.
  for (const k of Object.keys(p.project3.configuration.filament_settings)) if (!(k in mat3.PLA.filament)) throw new Error('3.0 key missing ' + k);
  p.materials3 = mat3;
  console.log('3.0', p.id, Object.keys(mat3).join(' '), Object.keys(mat3.PLA.filament).length, 'keys');
}

// ---------------------------------------------------------------- Bambu Studio
const SKIPB = new Set(['filament_colour', 'filament_multi_colour', 'filament_self_index', 'filament_settings_id', 'filament_ids', 'filament_type', 'inherits_group', 'different_settings_to_system']);
for (const p of BAMBU.printers) {
  const s = p.settings;
  p.materials = {};
  // Values as the template stores them (one entry per filament variant).
  const fit = (r, k) => {
    const v = Array.isArray(r.values[k]) ? r.values[k].map(String) : [String(r.values[k])];
    return Array.from({ length: s[k].length }, (_, i) => v[Math.min(i, v.length - 1)]);
  };
  const pla = bbl.pick(s.printer_settings_id, 'PLA');
  if (pla.name !== s.filament_settings_id[0]) throw new Error(`${p.id}: PLA preset ${pla.name} is not the template's ${s.filament_settings_id[0]}`);
  for (const type of Object.keys(bbl.PREFER)) {
    const r = bbl.pick(s.printer_settings_id, type);
    if (!r) continue;
    // Only what differs from the PLA preset: the template (saved by Bambu Studio) stays the base, so values this
    // resolver gets wrong for every preset alike cancel out.
    const values = {};
    for (const k of BAMBU.filamentKeys) {
      if (SKIPB.has(k) || !Array.isArray(s[k]) || !(k in r.values) || !(k in pla.values)) continue;
      const v = fit(r, k);
      if (JSON.stringify(v) !== JSON.stringify(fit(pla, k))) values[k] = v;
    }
    p.materials[type] = { name: r.name, id: String([].concat(r.values.filament_id)[0]), type: String([].concat(r.values.filament_type)[0]), values };
  }
  console.log('bambu', p.id, Object.entries(p.materials).map(([t, o]) => `${t}:${o.name}(${Object.keys(o.values).length})`).join(' | '));
}

// ---------------------------------------------------------------- write
function rewrite(file, head, varName, globalName, data) {
  const js = head + '(function (root) {\n  const ' + varName + ' = ' + JSON.stringify(data) + ';\n'
    + `  if (typeof module === 'object' && module.exports) module.exports = ${varName}; else root.${globalName} = ${varName};\n`
    + "})(typeof self !== 'undefined' ? self : this);\n";
  fs.writeFileSync(file, js);
  console.log('wrote', file, js.length);
}
rewrite(SITE + '/prusa-profiles.js', `/*
 * PrusaSlicer settings written into converted files, so PrusaSlicer opens them with the right multi-material printer,
 * filament types and colours. config: PrusaSlicer 2.9.6 system presets (printer + "0.20mm Balanced"/"0.20mm BALANCED"
 * + "Generic PLA") as saved by PrusaSlicer. project3: the same printer for PrusaSlicer 3.0 (Metadata/PrusaSlicer3_project.json),
 * exported by PrusaSlicer 3.0.0-alpha11. materials: per-extruder config values for each filament type, resolved from the
 * PrusaSlicer 2.9 vendor bundle. materials3: per-tool 3.0 values for each filament type, from a 3.0 export.
 */
`, 'PROFILES', 'PRUSA_PROFILES', PRUSA);
rewrite(SITE + '/bambu-profiles.js', `/*
 * Bambu Studio settings written into converted files (Metadata/project_settings.config), so Bambu Studio opens them with the
 * right printer, number of filaments, filament types and colours. Made by Bambu Studio ${BAMBU.version} from the system presets
 * (printer + "0.20mm Standard" + "Bambu PLA Basic") for one filament; the converter grows the per-filament lists
 * (filamentKeys) to the right length. materials: the system filament preset used for each filament type, with its values.
 */
`, 'BAMBU', 'BAMBU_PROFILES', BAMBU);
