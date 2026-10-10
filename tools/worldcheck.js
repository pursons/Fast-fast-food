global.window = global;
const fs = require('fs'), vm = require('vm');
let src = ['util', 'data', 'world'].map(f => fs.readFileSync('js/' + f + '.js', 'utf8')).join('\n');
src += `
generateWorld();
const cnt = {}; for (const b of W.buildings) cnt[b.kind] = (cnt[b.kind]||0)+1;
console.log(JSON.stringify(cnt));
let bad = 0;
for (const b of W.buildings) {
  const f = b.front; const t = tileAt(f.x, f.y);
  if (t !== T.SIDE) { bad++; console.log('front not sidewalk', b.kind, b.id, f, t); }
  if (W.bi[tIdx(b.door.x,b.door.y)] !== b.id) console.log('door not in building', b.kind);
}
for (const k of Object.keys(INT)) { const S = INT[k](); for (const f of S.furn) { if (f.x<0||f.y<0||f.x+f.w>S.w||f.y+f.h>S.h) console.log('furn out', k, f.t, f.x,f.y,f.w,f.h);
  } for (const s of [...S.staff,...S.cust]) { if (blockedIn(S,(s.x+.5)*TS,(s.y+.5)*TS,6)) console.log('spot blocked', k, s); } }
console.log('bad', bad);
`;
vm.runInThisContext(src);
