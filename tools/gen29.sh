#!/bin/bash
# Saves one PrusaSlicer 2.9 config per printer and material (all extruders the same material).
S="C:/Users/Morten/AppData/Local/Temp/claude/E--Bambu-fix/a09e335c-06b9-486b-9c7d-e4b8b813340b/scratchpad"
EXE="/c/Program Files/Prusa3D/PrusaSlicer/prusa-slicer-console.exe"
cd "$S/ft"; mkdir -p ini29
run() { # id printer print material-key material-name
  local out="ini29/$1_$4.ini"
  "$EXE" --datadir "$S/dd2" --printer-profile "$2" --print-profile "$3" --material-profile "$5" --save "$out" > "$out.log" 2>&1
  if [ -s "$out" ]; then echo "OK   $1 $4"; else echo "FAIL $1 $4: $(grep -v '^\s*$' "$out.log" | tail -1)"; fi
}
for p in "core1mmu3|Prusa CORE One MMU3 HF0.4 nozzle|0.20mm BALANCED @COREONE HF0.4|COREONE" \
         "core1lmmu3|Prusa CORE One L MMU3 HF0.4 nozzle|0.20mm BALANCED @COREONEL HF0.4|COREONE" \
         "core1indx8t|Prusa CORE One INDX 8T HF0.4 nozzle|0.20mm Balanced ★ @COREONEINDX HF0.4|COREONEINDX" \
         "core1indx4t|Prusa CORE One INDX 4T HF0.4 nozzle|0.20mm Balanced ★ @COREONEINDX HF0.4|COREONEINDX"; do
  IFS='|' read -r id pr ps sfx <<< "$p"
  run "$id" "$pr" "$ps" PLA "Generic PLA @$sfx HF0.4"
  run "$id" "$pr" "$ps" PETG "Generic PETG @$sfx HF0.4"
  run "$id" "$pr" "$ps" ABS "Generic ABS @$sfx HF0.4"
  run "$id" "$pr" "$ps" ASA "Prusament ASA @$sfx HF0.4"
  run "$id" "$pr" "$ps" PC "Prusament PC Blend @$sfx HF0.4"
  run "$id" "$pr" "$ps" FLEX "Generic FLEX @$sfx HF0.4"
done
