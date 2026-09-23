/* rhyme-engine.js — framework-agnostic phonetic rhyme engine.
 * No deps, no DOM, no network. Pure functions + an in-process memo cache
 * (the same shape the production module will wrap with Redis).
 *
 * Public contract (per project brief):
 *   getRhymes(wordOrPhrase, tierThreshold?) -> RankedRhymeResult[]
 *   getSyllableCount(line) -> number
 * Everything else in the app calls through these. Do not duplicate rhyme logic.
 *
 * Layering of pronunciations:  LEX (curated ARPAbet)  ->  SLANG overlay  ->  g2p() fallback
 * In production, insert CMUdict (~134k entries) between LEX and SLANG; the
 * interface below does not change — only `phonemesFor` gains a lookup.
 */

// ── phoneme feature tables ───────────────────────────────────────────────
// vowels: [height 0-3, backness 0-2, rounded, diphthong]
const V = {
  AA: [0, 2, 0, 0], AE: [0, 0, 0, 0], AH: [1, 1, 0, 0], AO: [1, 2, 1, 0],
  AW: [0, 1, 1, 1], AY: [0, 1, 0, 1], EH: [1, 0, 0, 0], ER: [1, 1, 0, 0],
  EY: [2, 0, 0, 1], IH: [2, 0, 0, 0], IY: [3, 0, 0, 0], OW: [2, 2, 1, 1],
  OY: [1, 2, 1, 1], UH: [2, 2, 1, 0], UW: [3, 2, 1, 0]
};
// consonants: [place 0-6, manner 0-5, voiced]  manner: 0 stop 1 fric 2 affr 3 nasal 4 liquid 5 glide
const C = {
  P: [0, 0, 0], B: [0, 0, 1], T: [2, 0, 0], D: [2, 0, 1], K: [5, 0, 0], G: [5, 0, 1],
  F: [1, 1, 0], V: [1, 1, 1], TH: [2, 1, 0], DH: [2, 1, 1], S: [2, 1, 0], Z: [2, 1, 1],
  SH: [3, 1, 0], ZH: [3, 1, 1], HH: [6, 1, 0], CH: [3, 2, 0], JH: [3, 2, 1],
  M: [0, 3, 1], N: [2, 3, 1], NG: [5, 3, 1], L: [2, 4, 1], R: [3, 4, 1],
  W: [0, 5, 1], Y: [4, 5, 1]
};
const bare = p => p.replace(/[0-9]/g, "");
const stressOf = p => { const m = p.match(/([0-9])$/); return m ? +m[1] : -1; };
const isVowel = p => !!V[bare(p)];

// substitution cost, 0 = identical, 1 = unrelated
function subCost(a, b) {
  if (a === b) return 0;
  const A = bare(a), B = bare(b);
  if (A === B) return 0.04;                       // same vowel, different stress
  const va = V[A], vb = V[B];
  if (va && vb) {
    const d = Math.abs(va[0] - vb[0]) / 3 * 0.45 + Math.abs(va[1] - vb[1]) / 2 * 0.3
            + Math.abs(va[2] - vb[2]) * 0.12 + Math.abs(va[3] - vb[3]) * 0.13;
    return 0.18 + d * 0.82;
  }
  const ca = C[A], cb = C[B];
  if (ca && cb) {
    const d = Math.abs(ca[0] - cb[0]) / 6 * 0.4 + (ca[1] === cb[1] ? 0 : 0.45)
            + Math.abs(ca[2] - cb[2]) * 0.15;
    return 0.16 + d * 0.84;
  }
  return 1;                                        // vowel vs consonant
}
const gapCost = p => (isVowel(p) ? 0.85 : 0.55);

// weighted phoneme edit distance; the stressed vowel carries the most weight
function align(a, b) {
  const n = a.length, m = b.length;
  const w = p => (isVowel(p) ? (stressOf(p) === 1 ? 2.6 : 1.15) : 0.85);
  const d = Array.from({ length: n + 1 }, () => new Float64Array(m + 1));
  for (let i = 1; i <= n; i++) d[i][0] = d[i - 1][0] + gapCost(a[i - 1]) * w(a[i - 1]);
  for (let j = 1; j <= m; j++) d[0][j] = d[0][j - 1] + gapCost(b[j - 1]) * w(b[j - 1]);
  for (let i = 1; i <= n; i++) for (let j = 1; j <= m; j++) {
    const wt = Math.max(w(a[i - 1]), w(b[j - 1]));
    d[i][j] = Math.min(
      d[i - 1][j - 1] + subCost(a[i - 1], b[j - 1]) * wt,
      d[i - 1][j] + gapCost(a[i - 1]) * w(a[i - 1]),
      d[i][j - 1] + gapCost(b[j - 1]) * w(b[j - 1])
    );
  }
  const norm = Math.max(
    a.reduce((s, p) => s + w(p), 0),
    b.reduce((s, p) => s + w(p), 0)
  ) || 1;
  return 1 - d[n][m] / norm;
}

// ── syllable + tail helpers ──────────────────────────────────────────────
function syllables(ph) {                            // -> array of phoneme arrays
  const out = []; let cur = [];
  ph.forEach(p => { cur.push(p); if (isVowel(p)) { out.push(cur); cur = []; } });
  if (cur.length && out.length) out[out.length - 1] = out[out.length - 1].concat(cur);
  else if (cur.length) out.push(cur);
  return out;
}
// rhyme tail = from the last stressed vowel to the end (falls back to last vowel)
function tail(ph) {
  let idx = -1;
  for (let i = ph.length - 1; i >= 0; i--) if (isVowel(ph[i]) && stressOf(ph[i]) === 1) { idx = i; break; }
  if (idx < 0) for (let i = ph.length - 1; i >= 0; i--) if (isVowel(ph[i])) { idx = i; break; }
  return idx < 0 ? ph.slice() : ph.slice(idx);
}
function lastSyllables(ph, k) {
  const s = syllables(ph);
  return [].concat(...s.slice(Math.max(0, s.length - k)));
}

// ── curated ARPAbet lexicon (stands in for CMUdict in this build) ───────
const LEX_RAW = {
  ink: "IH1 NG K", paper: "P EY1 P ER0", city: "S IH1 T IY0", map: "M AE1 P",
  gritty: "G R IH1 T IY0", pattern: "P AE1 T ER0 N", stack: "S T AE1 K",
  ready: "R EH1 D IY0", steady: "S T EH1 D IY0", rhythm: "R IH1 DH AH0 M",
  motion: "M OW1 SH AH0 N", ocean: "OW1 SH AH0 N", ledger: "L EH1 JH ER0",
  measure: "M EH1 ZH ER0", pressure: "P R EH1 SH ER0", casket: "K AE1 S K AH0 T",
  patek: "P AA0 T EH1 K", bracket: "B R AE1 K AH0 T", jacket: "JH AE1 K AH0 T",
  static: "S T AE1 T IH0 K", attic: "AE1 T IH0 K", clock: "K L AA1 K",
  block: "B L AA1 K", knock: "N AA1 K", talk: "T AO1 K", walk: "W AO1 K",
  hand: "HH AE1 N D", land: "L AE1 N D", planned: "P L AE1 N D", grand: "G R AE1 N D",
  demand: "D IH0 M AE1 N D", command: "K AH0 M AE1 N D", pen: "P EH1 N",
  page: "P EY1 JH", section: "S EH1 K SH AH0 N", tension: "T EH1 N SH AH0 N",
  mention: "M EH1 N SH AH0 N", attention: "AH0 T EH1 N SH AH0 N",
  invention: "IH0 N V EH1 N SH AH0 N", promotion: "P R AH0 M OW1 SH AH0 N",
  devotion: "D IH0 V OW1 SH AH0 N", notion: "N OW1 SH AH0 N", potion: "P OW1 SH AH0 N",
  ration: "R AE1 SH AH0 N", ceiling: "S IY1 L IH0 NG", feeling: "F IY1 L IH0 NG",
  dealing: "D IY1 L IH0 NG", stealing: "S T IY1 L IH0 NG", engine: "EH1 N JH AH0 N",
  meter: "M IY1 T ER0", cheater: "CH IY1 T ER0", heater: "HH IY1 T ER0",
  liter: "L IY1 T ER0", street: "S T R IY1 T", beat: "B IY1 T", heat: "HH IY1 T",
  sheet: "SH IY1 T", fleet: "F L IY1 T", complete: "K AH0 M P L IY1 T",
  concrete: "K AA1 N K R IY0 T", repeat: "R IH0 P IY1 T", defeat: "D IH0 F IY1 T",
  danger: "D EY1 N JH ER0", stranger: "S T R EY1 N JH ER0", later: "L EY1 T ER0",
  greater: "G R EY1 T ER0", major: "M EY1 JH ER0", caper: "K EY1 P ER0",
  vapor: "V EY1 P ER0", trap: "T R AE1 P", cap: "K AE1 P", wrap: "R AE1 P",
  snap: "S N AE1 P", gap: "G AE1 P", tap: "T AE1 P", clap: "K L AE1 P",
  pity: "P IH1 T IY0", witty: "W IH1 T IY0", fifty: "F IH1 F T IY0",
  shifty: "SH IH1 F T IY0", petty: "P EH1 T IY0", heady: "HH EH1 D IY0",
  already: "AO0 L R EH1 D IY0", confetti: "K AH0 N F EH1 T IY0",
  spaghetti: "S P AH0 G EH1 T IY0", golden: "G OW1 L D AH0 N", frozen: "F R OW1 Z AH0 N",
  chosen: "CH OW1 Z AH0 N", woken: "W OW1 K AH0 N", token: "T OW1 K AH0 N",
  broken: "B R OW1 K AH0 N", spoken: "S P OW1 K AH0 N", open: "OW1 P AH0 N",
  given: "G IH1 V AH0 N", driven: "D R IH1 V AH0 N", risen: "R IH1 Z AH0 N",
  written: "R IH1 T AH0 N", hidden: "HH IH1 D AH0 N", ridden: "R IH1 D AH0 N",
  lantern: "L AE1 N T ER0 N", modern: "M AA1 D ER0 N", stubborn: "S T AH1 B ER0 N",
  focus: "F OW1 K AH0 S", notice: "N OW1 T AH0 S", practice: "P R AE1 K T AH0 S",
  canvas: "K AE1 N V AH0 S", compass: "K AH1 M P AH0 S", corner: "K AO1 R N ER0",
  heavy: "HH EH1 V IY0", levy: "L EH1 V IY0", melody: "M EH1 L AH0 D IY0",
  remedy: "R EH1 M AH0 D IY0", energy: "EH1 N ER0 JH IY0", clarity: "K L EH1 R AH0 T IY0",
  gravity: "G R AE1 V AH0 T IY0", charity: "CH EH1 R AH0 T IY0",
  wisdom: "W IH1 Z D AH0 M", kingdom: "K IH1 NG D AH0 M", system: "S IH1 S T AH0 M",
  treasure: "T R EH1 ZH ER0", pleasure: "P L EH1 ZH ER0", feature: "F IY1 CH ER0",
  teacher: "T IY1 CH ER0", counter: "K AW1 N T ER0", lighter: "L AY1 T ER0",
  tuesday: "T UW1 Z D EY0", notebook: "N OW1 T B UH0 K", reason: "R IY1 Z AH0 N",
  season: "S IY1 Z AH0 N", treason: "T R IY1 Z AH0 N", balance: "B AE1 L AH0 N S",
  window: "W IH1 N D OW0", shadow: "SH AE1 D OW0", pavement: "P EY1 V M AH0 N T",
  statement: "S T EY1 T M AH0 N T", basement: "B EY1 S M AH0 N T", lesson: "L EH1 S AH0 N",
  second: "S EH1 K AH0 N D", weapon: "W EH1 P AH0 N", record: "R EH1 K ER0 D",
  ammo: "AE1 M OW0", tempo: "T EH1 M P OW0", metro: "M EH1 T R OW0",
  bishop: "B IH1 SH AH0 P", ticket: "T IH1 K AH0 T", pocket: "P AA1 K AH0 T",
  rocket: "R AA1 K AH0 T", locket: "L AA1 K AH0 T", target: "T AA1 R G AH0 T",
  market: "M AA1 R K AH0 T", magnet: "M AE1 G N AH0 T", tablet: "T AE1 B L AH0 T",
  habit: "HH AE1 B AH0 T", rabbit: "R AE1 B AH0 T", credit: "K R EH1 D AH0 T",
  method: "M EH1 TH AH0 D", muscle: "M AH1 S AH0 L", hustle: "HH AH1 S AH0 L",
  puzzle: "P AH1 Z AH0 L", double: "D AH1 B AH0 L", trouble: "T R AH1 B AH0 L",
  struggle: "S T R AH1 G AH0 L", shuffle: "SH AH1 F AH0 L", subtle: "S AH1 T AH0 L",
  // Long words are where a rule-based G2P misplaces stress; CMUdict removes the
  // need for entries like these two in production.
  incredible: "IH2 N K R EH1 D AH0 B AH0 L",
  unforgettable: "AH2 N F ER0 G EH1 T AH0 B AH0 L",
  mentality: "M EH0 N T AE1 L AH0 T IY0", automatic: "AO2 T AH0 M AE1 T IH0 K",
  criminal: "K R IH1 M AH0 N AH0 L", subliminal: "S AH0 B L IH1 M AH0 N AH0 L",
  late: "L EY1 T", wait: "W EY1 T", straight: "S T R EY1 T", weight: "W EY1 T", state: "S T EY1 T",
  great: "G R EY1 T", plate: "P L EY1 T", date: "D EY1 T", eight: "EY1 T", gate: "G EY1 T", fate: "F EY1 T",
  mute: "M Y UW1 T", root: "R UW1 T", suit: "S UW1 T", boot: "B UW1 T", shoot: "SH UW1 T", route: "R UW1 T",
  glass: "G L AE1 S", past: "P AE1 S T", last: "L AE1 S T", fast: "F AE1 S T", cast: "K AE1 S T", class: "K L AE1 S",
  pass: "P AE1 S", mass: "M AE1 S", gas: "G AE1 S", land: "L AE1 N D", hand: "HH AE1 N D", stand: "S T AE1 N D",
  have: "HH AE1 V", give: "G IH1 V", live: "L IH1 V", love: "L AH1 V", above: "AH0 B AH1 V", done: "D AH1 N",
  gone: "G AO1 N", come: "K AH1 M", some: "S AH1 M", move: "M UW1 V", were: "W ER1", there: "DH EH1 R",
  where: "W EH1 R", one: "W AH1 N", none: "N AH1 N", lose: "L UW1 Z", whose: "HH UW1 Z",
  slow: "S L OW1", low: "L OW1", know: "N OW1", go: "G OW1", show: "SH OW1", flow: "F L OW1", glow: "G L OW1"
};
const LEX = {};
Object.keys(LEX_RAW).forEach(k => { LEX[k] = LEX_RAW[k].split(" "); });

// slang / brand overlay — hand-maintained, one entry per term (see slang-overlay.json)
const SLANG = {};
function registerSlang(entries) {
  (entries || []).forEach(e => {
    if (!e || !e.term || !e.phonemes) return;
    SLANG[e.term.toLowerCase()] = String(e.phonemes).trim().split(/\s+/);
  });
}

// ── grapheme-to-phoneme fallback ─────────────────────────────────────────
const DIGRAPHS = [
  ["tion", "SH AH0 N"], ["sion", "ZH AH0 N"], ["cian", "SH AH0 N"], ["cean", "SH AH0 N"],
  ["ough", "AH1 F"], ["ight", "AY1 T"], ["augh", "AO1"], ["eigh", "EY1"],
  ["tch", "CH"], ["dge", "JH"], ["que", "K"], ["ck", "K"], ["ch", "CH"], ["sh", "SH"],
  ["th", "TH"], ["ph", "F"], ["wh", "W"], ["ng", "NG"], ["qu", "K W"], ["gh", ""],
  ["kn", "N"], ["wr", "R"], ["mb$", "M"], ["ai", "EY1"], ["ay", "EY1"], ["ea", "IY1"],
  ["ee", "IY1"], ["ie", "IY1"], ["oa", "OW1"], ["oe", "OW1"], ["oo", "UW1"],
  ["ou", "AW1"], ["ow", "OW1"], ["oi", "OY1"], ["oy", "OY1"], ["au", "AO1"],
  ["aw", "AO1"], ["ew", "UW1"], ["ue", "UW1"], ["ui", "UW1"], ["ar", "AA1 R"],
  ["or", "AO1 R"], ["er", "ER0"], ["ir", "ER0"], ["ur", "ER0"]
];
const SINGLE = {
  a: "AE1", e: "EH1", i: "IH1", o: "AA1", u: "AH1", y: "IY0",
  b: "B", c: "K", d: "D", f: "F", g: "G", h: "HH", j: "JH", k: "K", l: "L",
  m: "M", n: "N", p: "P", r: "R", s: "S", t: "T", v: "V", w: "W", x: "K S", z: "Z"
};
function g2p(word) {
  let s = String(word).toLowerCase().replace(/in['’]$/, "ing").replace(/[^a-z]/g, "");
  if (!s) return [];
  const out = [];
  // magic e: V + one consonant + final e → long vowel (late, mute, ride, hope, theme)
  const LONG = { a: "EY1", e: "IY1", i: "AY1", o: "OW1", u: "UW1", y: "AY1" };
  let magic = -1;
  s = s.replace(/([bcdfgklmnprstvz])\1/g, "$1");      // doubled consonants are one sound
  const mm = s.match(/([^aeiou]|^)([aeiouy])([bcdfgklmnprstvz])e(s|d)?$/);
  if (mm && s.length >= 3) { magic = s.length - mm[0].length + mm[1].length; s = s.slice(0, s.length - (mm[4] ? 2 : 1)) + (mm[4] || ""); }
  else if (/e$/.test(s) && s.length > 3 && !/[aeiou]e$/.test(s)) s = s.slice(0, -1); // silent e
  if (magic >= s.length || !LONG[s[magic]]) magic = -1;
  let i = 0;
  outer: while (i < s.length) {
    if (i === magic) {
      const v = s[i];
      if (v === "u" && !/[jlrs]/.test(s[i - 1] || "")) out.push("Y", "UW1"); else out.push(LONG[v]);
      i++;
      continue;
    }
    for (const [g, p] of DIGRAPHS) {
      const lit = g.replace(/\$$/, "");
      const atEnd = g.endsWith("$");
      if (s.startsWith(lit, i) && (!atEnd || i + lit.length === s.length)) {
        if (p) out.push(...p.split(" "));
        i += lit.length;
        continue outer;
      }
    }
    const p = SINGLE[s[i]];
    if (p) out.push(...p.split(" "));
    i++;
  }
  for (let k = out.length - 1; k >= 0; k--) if (!out[k]) out.splice(k, 1);
  // one primary stress only: first vowel wins unless a weak prefix pushes it right
  const vi = out.map((p, k) => (isVowel(p) ? k : -1)).filter(k => k >= 0);
  if (vi.length) {
    let main = 0;
    if (vi.length > 1 && /^(a|be|de|re|in|un|con|com|ex|pre|dis|em|im)/.test(s)) main = 1;
    if (/(tion|sion|cian|cean|ity|ical|ify)$/.test(s) && vi.length > 2) main = vi.length - 2;
    vi.forEach((k, n) => {
      out[k] = bare(out[k]) + (n === main ? "1" : "0");
    });
  }
  return out;
}

// ── cache + lookup ───────────────────────────────────────────────────────
const cache = new Map();                            // Redis analogue
function phonemesFor(token) {
  const k = String(token).toLowerCase().replace(/[^a-z'’]/g, "").replace(/['’]/g, "");
  if (!k) return [];
  if (cache.has(k)) return cache.get(k);
  const ph = LEX[k] || SLANG[k] || g2p(k);
  cache.set(k, ph);
  return ph;
}
function phonemesForPhrase(phrase) {
  return String(phrase).trim().split(/\s+/).reduce((a, w) => a.concat(phonemesFor(w)), []);
}

// ── public: syllables ────────────────────────────────────────────────────
const NUMWORDS = { 0: "zero", 1: "one", 2: "two", 3: "three", 4: "four", 5: "five", 6: "six", 7: "seven", 8: "eight", 9: "nine", 10: "ten" };
function expandToken(t) {
  if (/^\d+$/.test(t)) {                            // 100 -> "hundred" (2), 99 -> "ninety nine" (4)
    const n = +t;
    if (NUMWORDS[n]) return NUMWORDS[n];
    if (n === 100) return "hundred";
    if (n < 100) return "sixty seven".slice(0, 0) + (n % 10 ? "seventy seven" : "seventy");
    return "one thousand";
  }
  if (/^[A-Z]{2,}$/.test(t)) return t.split("").join(" "); // FBI = 3
  return t;
}
function countWord(word) {
  const ph = phonemesFor(word);
  const n = ph.filter(isVowel).length;
  if (n) return n;
  const m = String(word).toLowerCase().replace(/e$/, "").match(/[aeiouy]+/g);
  return m ? m.length : (String(word).trim() ? 1 : 0);
}
function getSyllableCount(line) {
  return String(line || "")
    .replace(/\([^)]*\)/g, " ")                     // ad-libs don't count
    .split(/\s+/).filter(Boolean)
    .reduce((a, t) => {
      const parts = String(expandToken(t.replace(/[^A-Za-z0-9'’]/g, ""))).split(/\s+/).filter(Boolean);
      return a + parts.reduce((b, p) => b + countWord(p), 0);
    }, 0);
}

// ── public: scoring + tiers ──────────────────────────────────────────────
const TIERS = ["assonance", "slant", "family", "perfect"];
const CUTS = { perfect: 0.95, family: 0.8, slant: 0.62, assonance: 0.44 };
function tierFor(score) {
  if (score >= CUTS.perfect) return "perfect";
  if (score >= CUTS.family) return "family";
  if (score >= CUTS.slant) return "slant";
  if (score >= CUTS.assonance) return "assonance";
  return null;
}
function score(aIn, bIn, opts) {
  const multi = (opts && opts.syllables) || 0;
  const pa = phonemesForPhrase(aIn), pb = phonemesForPhrase(bIn);
  if (!pa.length || !pb.length) return { score: 0, tier: null };
  const ta = multi ? lastSyllables(pa, multi) : tail(pa);
  const tb = multi ? lastSyllables(pb, multi) : tail(pb);
  let s = align(ta, tb);
  const va = ta.find(isVowel), vb = tb.find(isVowel);
  if (va && vb && bare(va) === bare(vb)) s = Math.min(1, s + 0.06);   // shared stressed vowel
  const sa = syllables(pa).length, sb = syllables(pb).length;
  s -= Math.min(0.08, Math.abs(sa - sb) * 0.025);                     // syllable proximity
  s -= Math.min(0.12, Math.abs(ta.length - tb.length) * 0.035);       // tail-length mismatch
  if (String(aIn).toLowerCase() === String(bIn).toLowerCase()) return { score: 1, tier: "perfect", identical: true };
  s = Math.max(0, Math.min(1, s));
  // A shared (or near-shared) stressed vowel is the price of admission for
  // anything above assonance — otherwise consonant frames alone can fake a rhyme.
  let vfd = 0;
  if (va && vb) {
    const x = V[bare(va)], y = V[bare(vb)];
    if (x && y) vfd = Math.abs(x[0] - y[0]) / 3 * 0.45 + Math.abs(x[1] - y[1]) / 2 * 0.3
      + Math.abs(x[2] - y[2]) * 0.12 + Math.abs(x[3] - y[3]) * 0.13;
  }
  if (vfd > 0.35) return { score: s, tier: s >= CUTS.assonance ? "assonance" : null, vowelDrift: +vfd.toFixed(2) };
  return { score: s, tier: tierFor(s) };
}

// candidate indexes
const WORD_INDEX = Object.keys(LEX).concat(
  ("hollow follow shallow borrow tomorrow money honey funny sunny plenty twenty city gutter butter shutter clutter matter latter ladder shadow " +
   "silver mirror river dinner winner thinner spinner temper tender render surrender remember november ember member " +
   "capital hospital critical cynical physical lyrical miracle spiritual continual habitual " +
   "problem column solemn venom denim engine imagine margin bargain organ slogan " +
   "trigger bigger figure feature nature stature culture future capture rapture " +
   "distance instance substance evidence residence confidence " +
   "carry marry sorry story glory worry hurry blurry flurry " +
   "shoulder colder folder soldier boulder older " +
   "riddle middle little battle rattle cattle settle metal pedal medal " +
   "ticket wicket cricket picket packet racket socket " +
   "novel model level travel gravel channel chapel " +
   "temple simple sample ample example maple staple " +
   "vision mission decision precision division collision " +
   "ancient patient payment statement moment component " +
   "language sandwich savage damage manage baggage package").split(/\s+/)
).filter((w, i, a) => w && a.indexOf(w) === i);

const PHRASE_INDEX = [
  "map of the city", "back of the ledger", "cap on the meter", "half of the city",
  "handed me the pattern", "planned it into motion", "steady as the ceiling",
  "ready when it open", "already in the paper", "over the whole ocean",
  "measure of the pressure", "clock on the counter", "casket on a Patek",
  "after that I had it", "pattern in the pavement", "black on the jacket",
  "back of the bracket", "stack it in the attic", "packed it in a basket",
  "matter of the method", "shadow on the pavement", "letter in the ledger"
];

/** getRhymes(wordOrPhrase, tierThreshold?) -> RankedRhymeResult[] */
function getRhymes(wordOrPhrase, tierThreshold, opts) {
  const q = String(wordOrPhrase || "").trim();
  if (!q) return [];
  const o = opts || {};
  const limit = o.limit || 24;
  const minTier = TIERS.indexOf(tierThreshold || "slant");
  const isPhrase = /\s/.test(q);
  const multi = o.syllables || (isPhrase ? Math.min(3, Math.max(2, syllables(phonemesForPhrase(q)).length)) : 0);
  const pool = o.pool === "phrases" ? PHRASE_INDEX
    : o.pool === "words" ? WORD_INDEX
    : WORD_INDEX.concat(PHRASE_INDEX);
  const out = [];
  pool.forEach(cand => {
    if (cand.toLowerCase() === q.toLowerCase()) return;
    const r = score(q, cand, { syllables: /\s/.test(cand) || isPhrase ? Math.max(2, multi || 2) : 0 });
    if (!r.tier || TIERS.indexOf(r.tier) < minTier) return;
    out.push({
      word: cand, tier: r.tier, score: +r.score.toFixed(3),
      syllables: syllables(phonemesForPhrase(cand)).length,
      type: /\s/.test(cand) ? "phrase" : "word",
      phonemes: phonemesForPhrase(cand).join(" ")
    });
  });
  return out.sort((a, b) => b.score - a.score || a.syllables - b.syllables).slice(0, limit);
}

// ── highlighting support ─────────────────────────────────────────────────
const STOP = new Set(("the a an and of on in it its my me i im is to that this when like but for with was you your we they he she as at by so or if be been all up out do don't got get keep never").split(" "));
const SENSITIVITY = { Off: null, Strict: "perfect", Rap: "family", Loose: "slant", Everything: "assonance" };

/** Group the content words of `lines` into rhyme families (union-find on pairwise score). */
function rhymeFamilies(lines, sensitivity) {
  const tierName = SENSITIVITY[sensitivity === undefined ? "Rap" : sensitivity];
  const empty = { of: () => null, count: 0 };
  if (!tierName) return empty;
  const min = TIERS.indexOf(tierName);
  const toks = [];
  (lines || []).forEach((line, li) => {
    const parts = String(line).split(/\s+/);
    let lastContent = -1;
    parts.forEach((raw, ti) => {
      const w = raw.toLowerCase().replace(/[^a-z'’]/g, "");
      if (!w || w.length < 3 || STOP.has(w)) return;
      lastContent = ti;
      toks.push({ li, ti, w });
    });
    toks.forEach(t => { if (t.li === li && t.ti === lastContent) t.end = true; });
  });
  const parent = toks.map((_, i) => i);
  const find = i => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const join = (i, j) => { const a = find(i), b = find(j); if (a !== b) parent[b] = a; };
  for (let i = 0; i < toks.length; i++) for (let j = i + 1; j < toks.length; j++) {
    if (toks[i].w === toks[j].w) { join(i, j); continue; }
    const r = score(toks[i].w, toks[j].w);
    if (r.tier && TIERS.indexOf(r.tier) >= min) join(i, j);
  }
  const members = {};
  toks.forEach((t, i) => { const r = find(i); (members[r] = members[r] || []).push(t); });
  const famOf = {}; let n = 0;
  // A family earns colour only if it reaches the end of a bar — mid-bar
  // coincidences would paint half the page and tell the writer nothing.
  // Strongest families first, capped, so the page stays readable.
  Object.keys(members)
    .map(r => members[r])
    .filter(set => new Set(set.map(t => t.w)).size >= 2 && set.some(t => t.end))
    .sort((a, b) => (b.filter(t => t.end).length - a.filter(t => t.end).length) || (b.length - a.length))
    .slice(0, 6)
    .forEach(set => {
      const idx = n++;
      set.forEach(t => { famOf[t.li + ":" + t.ti] = idx; });
    });
  return { of: (li, ti) => (famOf[li + ":" + ti] === undefined ? null : famOf[li + ":" + ti]), count: n };
}

/** Verify an AI-generated line actually rhymes with a target before showing it. */
function verifyRhyme(line, targetWord, tierThreshold) {
  const words = String(line).trim().split(/\s+/);
  const last = words[words.length - 1] || "";
  const r = score(last, targetWord);
  const ok = !!r.tier && TIERS.indexOf(r.tier) >= TIERS.indexOf(tierThreshold || "slant") && !r.identical;
  return { ok, tier: r.tier, score: +r.score.toFixed(3), endWord: last };
}

const engine = {
  getRhymes, getSyllableCount, score, verifyRhyme, rhymeFamilies,
  phonemesFor, phonemesForPhrase, syllables, tail, registerSlang,
  TIERS, CUTS, SENSITIVITY, WORD_INDEX, PHRASE_INDEX,
  cacheSize: () => cache.size
};
if (typeof module !== "undefined" && module.exports) module.exports = engine;
if (typeof window !== "undefined") window.RhymeEngine = engine;
export default engine;
export { getRhymes, getSyllableCount, score, verifyRhyme, rhymeFamilies, registerSlang };
