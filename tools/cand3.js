// Lists PrusaSlicer 3.0 filament presets that can reach an INDX variant, with the CLI name to try.
const fs = require('fs');
const D = 'C:/Users/Morten/Documents/PrusaSlicer-3.0.0-alpha11/resources/presets/prusa-research-fff/PrusaResearch';
const CR = new RegExp(String.fromCharCode(13), 'g');
const docs = [];
for (const f of fs.readdirSync(D).filter((x) => x.startsWith('preset-filament-'))) {
  for (const d of fs.readFileSync(`${D}/${f}`, 'utf8').replace(CR, '').split(/^---\s*$/m)) {
    const id = (d.match(/^id: '?([^'\n]*)'?$/m) || [])[1];
    if (!id) continue;
    const name = (d.match(/^name: '?([^'\n]*)'?$/m) || [])[1];
    const inh = ((d.match(/^inherits:\n((?:- .*\n)+)/m) || [])[1] || '').trim().split('\n').filter(Boolean).map((s) => s.slice(2).replace(/^'|'$/g, ''));
    const type = (d.match(/^\s+filament_type: '?([A-Z0-9-]+)/m) || [])[1] || (d.match(/^\s+\$\.type: '?([A-Z0-9-]+)/m) || [])[1];
    const cond = (d.match(/^condition: (.*)$/m) || [])[1] || '';
    docs.push({ f, id, name, inh, cond, ownIndx: /COREONEINDX/.test(d) && !/'\*/.test((d.match(/name: .*COREONEINDX.*/) || [''])[0]), indx: /COREONEINDX/.test(d), type });
  }
}
const byId = new Map(docs.map((d) => [d.id, d]));
function chain(d, seen = new Set()) {
  if (seen.has(d.id)) return [];
  seen.add(d.id);
  return [d, ...d.inh.flatMap((i) => (byId.has(i) ? chain(byId.get(i), seen) : []))];
}
const out = [];
for (const d of docs) {
  if (!d.name || d.name.includes('*')) continue;
  const c = chain(d);
  if (!c.some((x) => x.indx)) continue;
  // PrusaSlicer matches base_model=~/(A|B)/ against the whole name, so COREONE does not cover COREONE_INDX.
  if (d.cond && !/COREONE_INDX/.test(d.cond)) continue;
  const type = (c.find((x) => x.type) || {}).type || '';
  const cli = d.ownIndx ? `${d.name} @COREONEINDX HF0.4@COREONEINDX 0.4` : `${d.name}@COREONEINDX HF0.4@COREONEINDX 0.4`;
  out.push({ name: d.name, type, cli, file: d.f });
}
fs.writeFileSync(__dirname + '/cand3.json', JSON.stringify(out, null, 1));
const t = {};
for (const o of out) t[o.type] = (t[o.type] || 0) + 1;
console.log(out.length, 'candidates', JSON.stringify(t));
