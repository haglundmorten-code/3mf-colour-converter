import json, zipfile, sys, os
here = os.path.dirname(os.path.abspath(__file__))
sp = os.path.dirname(here)
B = json.loads(zipfile.ZipFile(os.path.join(sp, 'in/benchy.3mf')).read('Metadata/project_settings.config'))  # H2C, 7 filaments
F = json.loads(zipfile.ZipFile(os.path.join(sp, 'in/fox.3mf')).read('Metadata/project_settings.config'))    # P1S, 5 filaments
nb, nf = len(B['filament_colour']), len(F['filament_colour'])
# Keys with one value per filament (or per filament and extruder variant) in projects saved by the Bambu Studio GUI.
fkeys = sorted(k for k in set(B) & set(F)
               if isinstance(B[k], list) and isinstance(F[k], list) and len(F[k]) > 0
               and len(B[k]) * nf == len(F[k]) * nb and len(F[k]) % nf == 0 and len(F[k]) // nf in (1, 2, 4))
fkeys = [k for k in fkeys if k not in ('flush_volumes_vector', 'different_settings_to_system')]

profiles = [
    ('p1s', 'Bambu Lab P1S', 't_p1s', [256, 256]),
    ('x1c', 'Bambu Lab X1 Carbon', 't_x1c', [256, 256]),
    ('a1', 'Bambu Lab A1', 't_a1', [256, 256]),
    ('a1m', 'Bambu Lab A1 mini', 't_a1m', [180, 180]),
]
out = []
for pid, name, fn, bed in profiles:
    s = json.loads(zipfile.ZipFile(os.path.join(here, fn + '.3mf')).read('Metadata/project_settings.config'))
    s.pop('extruder_ams_count', None)
    s['curr_bed_type'] = 'Textured PEI Plate'
    s['filament_ids'] = ['GFA00']  # Bambu PLA Basic
    s['filament_colour'] = ['#FFFFFF']
    for k in fkeys:
        if isinstance(s.get(k), list) and len(s[k]) > 1:
            s[k] = s[k][:1]
    out.append({'id': pid, 'name': name, 'bed': bed, 'settings': s})
data = {'version': out[0]['settings']['version'], 'filamentKeys': fkeys, 'printers': out}
js = ('/*\n * Bambu Studio-oppsett som legges i konverterte filer (Metadata/project_settings.config), så Bambu Studio\n'
      ' * åpner filen med riktig printer, antall filamenter og farger. Laget av Bambu Studio ' + data['version'] + ' fra\n'
      ' * systemprofilene (printer + "0.20mm Standard" + "Bambu PLA Basic") for ett filament; konverteren utvider\n'
      ' * filamentlistene (filamentKeys) til riktig antall. Bambu Studio henter alle verdier fra systemprofilene\n'
      ' * når different_settings_to_system er tom, så bare navn, antall og farger betyr noe.\n */\n'
      '(function (root) {\n  const BAMBU = ' + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ';\n'
      "  if (typeof module === 'object' && module.exports) module.exports = BAMBU; else root.BAMBU_PROFILES = BAMBU;\n"
      "})(typeof self !== 'undefined' ? self : this);\n")
open(sys.argv[1], 'w', encoding='utf-8', newline='\n').write(js)
print(len(fkeys), 'filament keys;', [(p['id'], p['settings']['printer_settings_id'], p['settings']['print_settings_id']) for p in out], len(js))
