// Pruebas de la corrección de instrumentos. Ejecutar con:
//   deno run supabase/functions/_shared/instruments.test.ts

import assert from "node:assert/strict"
import { PHQ9, GAD7, scoreInstrument, validateAnswers, getInstrument } from "./instruments.ts"

const phq = (arr: number[], extra?: number) => scoreInstrument(PHQ9, { items: arr, extra })
// PHQ-9 bands at every boundary
const cases: [number, string][] = [[0,"minimal"],[4,"minimal"],[5,"mild"],[9,"mild"],[10,"moderate"],[14,"moderate"],[15,"moderately_severe"],[19,"moderately_severe"],[20,"severe"],[27,"severe"]]
for (const [total, level] of cases) {
  const items = Array(9).fill(0); let r = total
  for (let i = 0; i < 8 && r > 0; i++) { const v = Math.min(3, r); items[i] = v; r -= v }
  items[8] = r // remainder only possible at 27
  const s = phq(items)
  assert.equal(s.total, total); assert.equal(s.severity, level, `phq ${total}`); assert.equal(s.max, 27)
}
// item 9 flag
assert.equal(phq([0,0,0,0,0,0,0,0,0]).flags.length, 0)
const f = phq([0,0,0,0,0,0,0,0,1]); assert.equal(f.flags.length, 1); assert.equal(f.flags[0].code, "suicidal_ideation"); assert.equal(f.total, 1)
assert.equal(phq([3,0,0,0,0,0,0,0,0]).flags.length, 0)
// GAD-7 bands
for (const [total, level] of [[0,"minimal"],[4,"minimal"],[5,"mild"],[9,"mild"],[10,"moderate"],[14,"moderate"],[15,"severe"],[21,"severe"]] as [number,string][]) {
  const items = Array(7).fill(0); let r = total
  for (let i = 0; i < 7 && r > 0; i++) { const v = Math.min(3, r); items[i] = v; r -= v }
  const s = scoreInstrument(GAD7, { items }); assert.equal(s.total, total); assert.equal(s.severity, level, `gad ${total}`); assert.equal(s.max, 21)
}
// validation
assert.equal(validateAnswers(PHQ9, { items: Array(9).fill(1) }), null)
assert.equal(validateAnswers(PHQ9, { items: Array(9).fill(1), extra: 2 }), null)
assert.notEqual(validateAnswers(PHQ9, { items: Array(8).fill(1) }), null)
assert.notEqual(validateAnswers(PHQ9, { items: [...Array(8).fill(1), 4] }), null)
assert.notEqual(validateAnswers(PHQ9, { items: [...Array(8).fill(1), "1"] }), null)
assert.notEqual(validateAnswers(PHQ9, { items: [...Array(8).fill(1), 1.5] }), null)
assert.notEqual(validateAnswers(PHQ9, { items: Array(9).fill(1), extra: 7 }), null)
assert.notEqual(validateAnswers(GAD7, null), null)
assert.equal(getInstrument("toString"), null); assert.equal(getInstrument("nope"), null); assert.equal(getInstrument("gad7"), GAD7)
// bands contiguous and cover full range
for (const ins of [PHQ9, GAD7]) {
  const max = 3 * ins.items.length
  assert.equal(ins.bands[0].min, 0); assert.equal(ins.bands.at(-1)!.max, max)
  for (let i = 1; i < ins.bands.length; i++) assert.equal(ins.bands[i].min, ins.bands[i-1].max + 1)
}
console.log("ALL INSTRUMENT TESTS PASSED")
