// Picks a Bambu Studio system filament preset per printer and material, and resolves its values through "inherits".
const fs = require('fs');
const path = require('path');
const ROOT = 'C:/Program Files/Bambu Studio/resources/profiles/BBL/filament';

const byName = new Map();
(function walk(d) {
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f);
    if (fs.statSync(p).isDirectory()) walk(p);
    else if (f.endsWith('.json')) {
      try { const j = JSON.parse(fs.readFileSync(p, 'utf8')); if (j.name) byName.set(j.name, j); } catch (_) { /* skip */ }
    }
  }
})(ROOT);

function resolve(name, depth = 0) {
  const j = byName.get(name);
  if (!j) throw new Error('No Bambu preset ' + name);
  const base = j.inherits && depth < 20 ? resolve(j.inherits, depth + 1) : {};
  return Object.assign({}, base, j);
}

// Preferred presets per material, first one compatible with the printer wins.
const PREFER = {
  PLA: ['Bambu PLA Basic', 'Generic PLA'],
  PETG: ['Bambu PETG HF', 'Generic PETG HF', 'Generic PETG'],
  ABS: ['Bambu ABS', 'Generic ABS'],
  ASA: ['Bambu ASA', 'Generic ASA'],
  TPU: ['Bambu TPU 95A HF', 'Generic TPU'],
  PC: ['Bambu PC', 'Generic PC'],
};

function pick(printerSettingsId, mat) {
  for (const base of PREFER[mat]) {
    for (const [name, j] of byName) {
      if (j.instantiation !== 'true') continue;
      if (name !== base && !name.startsWith(base + ' @')) continue;
      const r = resolve(name);
      if ((r.compatible_printers || []).includes(printerSettingsId)) return { name, values: r };
    }
  }
  return null;
}
module.exports = { pick, resolve, PREFER };
if (require.main === module) {
  for (const pr of ['Bambu Lab P1S 0.4 nozzle', 'Bambu Lab X1 Carbon 0.4 nozzle', 'Bambu Lab A1 0.4 nozzle', 'Bambu Lab A1 mini 0.4 nozzle']) {
    console.log('==', pr);
    for (const m of Object.keys(PREFER)) {
      const p = pick(pr, m);
      console.log(' ', m, p ? `${p.name} | id=${p.values.filament_id} type=${p.values.filament_type} nozzle=${p.values.nozzle_temperature} bed(tex)=${p.values.textured_plate_temp}` : '-- none');
    }
  }
}
