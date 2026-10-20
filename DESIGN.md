# Step Deck: design spec

Beatbox practice MVP. Desktop Chrome on a laptop, headphones on, single-file web app. This spec drives 4 static artboards first, then the real app. Every size is in CSS px. Copy in "quotes" is exact UI text.

---

## 1. Look

**Name:** Step Deck (base: Graphite Step Deck, with grafts from Lane and Needle and Drift Staff).

**Rationale:** Eight fixed hardware pads are both the score and the scoreboard, so "what do I make" and "how did that go" sit in one spot that reads at a glance from 60 cm, with nothing scrolling. Pale blue means on time and orange means off time, nothing else on the page is colored, and the side a letter lands on, a chevron, an aligned verdict word and a lane of past hits tell early from late without hue.

Rules that hold everywhere:

- Blue (`--on`) and orange (`--off`) appear only as timing judgments. Selection, buttons, nav, the playhead, Teach and meters use lightness on neutrals only.
- One ground (`--ground`). Panels are slightly raised neutrals, never gradients, glass or tinted cards.
- No left-border accent cards, no emoji, no top accent rules on panels.
- Every number is Azeret Mono. Every word is Archivo.

---

## 2. Tokens

### 2.1 Color

| Token | Hex | Role |
|---|---|---|
| `--ground` | `#141518` | Page background, the only ground. Also the heard-letter chip face and the rest-pad face. |
| `--panel` | `#1B1D21` | Raised panels: control deck, Teach input strip, sound cards, self-test, Results panels, notices. |
| `--pad` | `#24272C` | Idle pad face, drift-lane on-time band, empty bar tracks. |
| `--pad-lift` | `#30343A` | Face of the pad under the playhead. |
| `--seam` | `#363A41` | Decorative only: header bottom line, lane frame, unlit LED and meter segments. Never the only cue. |
| `--line` | `#7A7F88` | Essential non-text UI (pad outlines, outline buttons, empty slots, slider track, lane center line) and dimmed letters 24px and up (missed, count-in). |
| `--ink-2` | `#9EA2AA` | Secondary text (labels, ms values, sublines, hints), center notches, next-up LED, missed dashed border. |
| `--ink` | `#EEEFF1` | Primary text, light faces (selected tab, selected pattern, primary buttons), playhead LED, filled slots, meter segments, focus ring. |
| `--on-ink` | `#0E1012` | Text and glyphs on any light or colored face (`--ink`, `--on`, `--off`). |
| `--on` | `#BFDEFF` | Accent 1. ON TIME only. The lightest state on a pad. |
| `--off` | `#E06C00` | Accent 2. OFF TIME only (early, late, extra). |

Changes from the base palette: `--on` lightened from `#8CC4FF` to `#BFDEFF` and `--off` deepened from `#F07400` to `#E06C00` (on/off lightness gap now 2.39:1, was 1.59:1). `--edge` and `--ink-faint` merged into `--line #7A7F88` (now 3.72:1 on pad, was 2.67:1). `--lit` merged into `--ink`.

Opacity tints in use: drift-lane rows at 1.0 / 0.9 / 0.8 / 0.7 (oldest checked below). Disabled controls at 0.45 (WCAG exempts disabled controls, and every disabled control has a full-strength text reason next to it).

### 2.2 Contrast, verified

Script: `contrast_check.py` in this folder (WCAG 2.x relative luminance, Machado 2009 color-vision simulation for the state pairs). Run `python3 contrast_check.py`, exit code 0 means every pair passes. Output:

| Foreground | Background | Ratio | Min | Pass | Use |
|---|---|---|---|---|---|
| ink #EEEFF1 | ground #141518 | 15.87:1 | 4.5:1 | yes | Primary text |
| ink #EEEFF1 | panel #1B1D21 | 14.67:1 | 4.5:1 | yes | Primary text on panels |
| ink #EEEFF1 | pad #24272C | 13.02:1 | 4.5:1 | yes | Next-up and residue pad letters, heard text |
| ink #EEEFF1 | pad-lift #30343A | 10.88:1 | 4.5:1 | yes | Playhead pad letter, count-in digit |
| ink-2 #9EA2AA | ground #141518 | 7.13:1 | 4.5:1 | yes | Secondary text, ms values, hints |
| ink-2 #9EA2AA | panel #1B1D21 | 6.59:1 | 4.5:1 | yes | Secondary text on panels, labels |
| ink-2 #9EA2AA | pad #24272C | 5.85:1 | 4.5:1 | yes | Step numbers, resting letters while playing |
| ink-2 #9EA2AA | pad-lift #30343A | 4.89:1 | 4.5:1 | yes | Step number on the playhead pad |
| on-ink #0E1012 | ink #EEEFF1 | 16.57:1 | 4.5:1 | yes | Text on light buttons and selected tabs |
| on-ink #0E1012 | on #BFDEFF | 13.72:1 | 4.5:1 | yes | Letter, step number, % text on on-time fill |
| on-ink #0E1012 | off #E06C00 | 5.73:1 | 4.5:1 | yes | Letter, step number, % text on off-time fill |
| ink #EEEFF1 | ground #141518 | 15.87:1 | 4.5:1 | yes | Heard-letter chip text (chip face is ground) |
| on #BFDEFF | ground #141518 | 13.13:1 | 4.5:1 | yes | ON verdict word (28px) |
| off #E06C00 | ground #141518 | 5.49:1 | 4.5:1 | yes | EARLY / LATE / EXTRA verdict word (28px) |
| off #E06C00 | panel #1B1D21 | 5.07:1 | 4.5:1 | yes | Accent word on panel (28px) |
| line #7A7F88 | pad #24272C | 3.72:1 | 3.0:1 | yes | Dimmed 72px letters (missed, count-in) |
| line #7A7F88 | pad-lift #30343A | 3.11:1 | 3.0:1 | yes | Dimmed 72px letter on the playhead pad |
| line #7A7F88 | ground #141518 | 4.54:1 | 3.0:1 | yes | Pad outlines, rest pad dashes, outline buttons |
| line #7A7F88 | panel #1B1D21 | 4.19:1 | 3.0:1 | yes | Outline buttons, slots, slider track on panels |
| line #7A7F88 | pad #24272C | 3.72:1 | 3.0:1 | yes | Drift lane center line on the on-time band |
| ink-2 #9EA2AA | pad #24272C | 5.85:1 | 3.0:1 | yes | Center notches, missed dashed border |
| ink-2 #9EA2AA | ground #141518 | 7.13:1 | 3.0:1 | yes | Next-up LED bar |
| ink #EEEFF1 | ground #141518 | 15.87:1 | 3.0:1 | yes | Playhead LED, focus ring, light button faces |
| ink #EEEFF1 | panel #1B1D21 | 14.67:1 | 3.0:1 | yes | Mic meter segments, filled slots |
| ink #EEEFF1 | pad #24272C | 13.02:1 | 3.0:1 | yes | Sound match bar fill on its track |
| on #BFDEFF | pad #24272C | 10.78:1 | 3.0:1 | yes | On-time residue border, ticks in the band |
| on #BFDEFF | ground #141518 | 13.13:1 | 3.0:1 | yes | On-time fill against the page |
| off #E06C00 | pad #24272C | 4.51:1 | 3.0:1 | yes | Off-time residue border, chevron, slash |
| off #E06C00 | ground #141518 | 5.49:1 | 3.0:1 | yes | Off-time fill, ticks and diamonds on the page |
| on-ink #0E1012 | on #BFDEFF | 13.72:1 | 3.0:1 | yes | Chevron, slash, notches on on-time fill |
| on-ink #0E1012 | off #E06C00 | 5.73:1 | 3.0:1 | yes | Chevron, slash, notches on off-time fill |
| ground #141518 | on #BFDEFF | 13.13:1 | 3.0:1 | yes | Heard-letter chip edge on on-time fill |
| ground #141518 | off #E06C00 | 5.49:1 | 3.0:1 | yes | Heard-letter chip edge on off-time fill |
| on at 70% (#90A7C0) | pad #24272C | 6.05:1 | 3.0:1 | yes | Oldest drift tick, on time (70% opacity) |
| off at 70% (#A35207) | ground #141518 | 3.28:1 | 3.0:1 | yes | Oldest drift tick, off time (70% opacity) |
| ink-2 at 70% (#797D84) | pad #24272C | 3.62:1 | 3.0:1 | yes | Oldest missed dash (70% opacity) |
| on #BFDEFF | panel #1B1D21 | 12.14:1 | 3.0:1 | yes | Results split bar, on-time segment |
| off #E06C00 | panel #1B1D21 | 5.07:1 | 3.0:1 | yes | Results split bar, early and late segments |
| line #7A7F88 | panel #1B1D21 | 4.19:1 | 3.0:1 | yes | Results split bar, missed segment dashes |

States that must be told apart, lightness ratio (and under simulated deuteranopia and protanopia):

| State A | State B | Lightness ratio | Min | Deuteranopia | Protanopia | Pass | Pair |
|---|---|---|---|---|---|---|---|
| on #BFDEFF | off #E06C00 | 2.39:1 | 2.0:1 | 2.06:1 | 3.10:1 | yes | On-time fill vs off-time fill |
| ink #EEEFF1 | ink-2 #9EA2AA | 2.23:1 | 2.0:1 | 2.23:1 | 2.21:1 | yes | Playhead LED vs next-up LED |
| ink-2 #9EA2AA | seam #363A41 | 4.46:1 | 3.0:1 | 4.47:1 | 4.45:1 | yes | Next-up LED vs unlit LED |
| ink #EEEFF1 | ink-2 #9EA2AA | 2.23:1 | 2.0:1 | 2.23:1 | 2.21:1 | yes | Next-up letter vs resting letter |
| on #BFDEFF | pad #24272C | 10.78:1 | 3.0:1 | 10.56:1 | 11.11:1 | yes | On-time fill vs idle pad |
| off #E06C00 | pad #24272C | 4.51:1 | 3.0:1 | 5.11:1 | 3.59:1 | yes | Off-time fill vs idle pad |
| ink #EEEFF1 | line #7A7F88 | 3.50:1 | 3.0:1 | 3.52:1 | 3.47:1 | yes | Residue letter vs missed letter |

Early vs late share one color on purpose. They never differ by color. They differ by side: the letter lands 20 to 28px left or right of the center notches, a chevron sits in the bottom corner on that side, the verdict word is left- or right-aligned, and the lane tick sits left or right of the line. On vs off is the only judgment told apart by color, and it differs in lightness by 2.39:1.

### 2.3 Type

Google Fonts, 2 families:

```
https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@100..125,400..800&family=Azeret+Mono:wght@400;500;700&display=swap
```

- **Archivo** (variable, width 100 to 125%, weight 400 to 800): every word, pad letters, headings, buttons, labels. Set width with `font-stretch`.
- **Azeret Mono** (400, 500, 700): every number (ms, BPM, %, streak, counts, timers, step numbers), the pattern strings, the count-in digit. Monospaced, so digits never jitter. Also set `font-variant-numeric: tabular-nums` on every Azeret element.
- Signed values use a true minus sign U+2212 ("−64 ms") and a plus sign ("+72 ms").

| Name | Family | Size | Weight | Stretch | Line height | Letter spacing | Case | Used for |
|---|---|---|---|---|---|---|---|---|
| `letter-xl` | Archivo | 120 | 800 | 125% | 120 | 0 | as typed | Teach card letters |
| `letter` | Archivo | 72 | 800 | 125% | 72 | 0 | as typed | Pad letters |
| `digit-count` | Azeret Mono | 72 | 700 | | 72 | 0 | | Count-in digit on a pad |
| `num-streak` | Azeret Mono | 64 | 700 | | 64 | 0 | | Streak value |
| `num-stat` | Azeret Mono | 56 | 700 | | 60 | -0.01em | | Results stat values |
| `letter-l` | Archivo | 56 | 800 | 125% | 56 | 0 | as typed | Self-test lamp letters, heard letter |
| `num-tempo` | Azeret Mono | 40 | 700 | | 44 | 0 | | Tempo value |
| `letter-m` | Archivo | 40 | 800 | 125% | 40 | 0 | as typed | Row letters on Results |
| `title` | Archivo | 32 | 800 | 112% | 40 | 0 | as typed | Page titles |
| `next` | Archivo | 32 | 700 | 100% | 40 | 0 | as typed | Next-step sentence |
| `verdict` | Archivo | 28 | 800 | 112% | 32 | 0.02em | upper | ON, EARLY, LATE, MISS, EXTRA |
| `num-readout` | Azeret Mono | 28 | 500 | | 32 | 0 | | Live readout values (700 for the Teach count and Results match %) |
| `headline` | Archivo | 24 | 700 | 100% | 32 | 0 | as typed | Results panel headlines, mic-blocked title |
| `chip` | Archivo | 24 | 800 | 125% | 24 | 0 | as typed | Heard-letter chip |
| `wordmark` | Archivo | 18 | 800 | 125% | 24 | 0 | as typed | "Beatbox Practice" |
| `button-l` | Archivo | 18 | 800 | 112% | 22 | 0.08em | upper | START, STOP |
| `body` | Archivo | 16 | 400 | 100% | 24 | 0 | as typed | Sentences, notices, captions |
| `num-m` | Azeret Mono | 16 | 500 | | 22 | 0 | | ms values in verdicts, meta lines, averages |
| `button` | Archivo | 15 | 700 | 112% | 20 | 0.08em | upper | Buttons, nav tabs, pattern names (pattern names: as typed, 0 tracking) |
| `body-s` | Archivo | 14 | 400 | 100% | 20 | 0 | as typed | Hints, sublines in words |
| `num-s` | Azeret Mono | 14 | 400 | | 20 | 0 | | Sublines with numbers ("107 of 184 steps") |
| `label` | Archivo | 13 | 600 | 112% | 16 | 0.14em | upper | Silkscreen labels (PATTERN, STREAK) |
| `num-xs` | Azeret Mono | 12 | 500 | | 16 | 0 | | Step numbers, pattern strings, key hints, caret values, count labels use 14 |

Minimum text size anywhere: 12px.

### 2.4 Spacing, radii, borders

- Spacing scale: 4, 8, 12, 16, 24, 32, 48.
- Content column: `max-width: 1188px; margin: 0 auto; padding: 0 16px` (at 1440 the column runs x 126 to 1314). The 1188 comes from the step row: 8 × 132 + 4 × 12 + 3 × 28.
- Radii: 4 (slots, chips, lanes, bar segments), 8 (pads, buttons, notices), 12 (panels).
- Borders: 1px `--seam` decorative hairlines. 2px `--line` essential outlines (idle pads, outline buttons, slots). 3px for emphasis states (dashed missed border, armed card, STOP button). 4px for residue borders (`--on` or `--off`).
- Focus: every interactive element gets `:focus-visible { outline: 3px solid var(--ink); outline-offset: 3px }`.
- Touch targets: every control is at least 44 × 44.

### 2.5 Motion

- Hit flash: 0 ms attack, 180 ms hold, then 400 ms ease-out to residue.
- Playhead and next-up: hard switch, no tween.
- Newest Teach slot: 2px `--ink` ring at 3px offset for 300 ms.
- Listening dot: blinks 500 ms on, 500 ms off.
- TRIGGER marker: `--ink-2`, flashes `--ink` for 150 ms on each detected onset.
- `prefers-reduced-motion: reduce`: no decay tween (fill holds 180 ms, then switches to residue at once), no ring, no blink (dot stays on).

---

## 3. Feedback encoding

Pad geometry used below (pad is 132 × 132, origin top-left): step number at (10, 8). Center notches: 12 × 7 triangles pointing inward at the top and bottom edge centers (x 60 to 72). Letter optical center at (66 + shift, 70). Heard-letter chip 40 × 40 at x 88 to 128, y 4 to 44. Chevron box 16 × 28 at x 6 to 22 (early) or x 110 to 126 (late), y 100 to 128. Wrong-sound slash: 6px round-capped line from (34, 98) to (100, 32), its top end tucked under the chip.

Letter shift for early and late: `shift = 20 + min(|offset| − 50, 80) / 10` px, so 20 to 28px. Negative (left) for early, positive (right) for late. Example: −64 ms shifts 21px left, +72 ms shifts 22px right.

| State | Color token | Shape | Position | Text label |
|---|---|---|---|---|
| **Current step (playhead)** | LED `--ink`, face `--pad-lift`, top notch `--ink` | 132 × 6 LED bar lit above the pad. Top notch grows to 16 × 9 and fills. No border change. | Moves step to step on the beat, hard switch | None. Letter is `--ink` (it was raised by Next up). |
| **Next up** (window open, before the beat) | LED `--ink-2`, letter `--ink` | Same LED bar, half-bright. Rest of the pad idle. | The step whose judging window just opened (half a step before its beat) | None. Resting letters while playing are `--ink-2`, so the next letter is the brightest one. |
| **On time**, right sound (|offset| ≤ 50 ms) | Fill `--on`, letter and notches `--on-ink`. Residue: 4px `--on` border, letter `--ink` | Solid filled square pad, then outlined pad | Letter stays centered on the notches | Verdict "ON" in `--on`, centered. No ms (the clean case stays quiet). |
| **Early** (offset < −50 ms) | Fill `--off`, letter, chevron, notches `--on-ink`. Residue: 4px `--off` border, letter `--ink`, chevron `--off` | Solid filled pad plus a left-pointing chevron in the bottom-left corner | Letter shifted 20 to 28px left of the notches | "EARLY" in `--off`, left-aligned in the verdict block. Line 2: "−64 ms" `--ink-2`, left-aligned. |
| **Late** (offset > +50 ms) | Same as early | Solid filled pad plus a right-pointing chevron in the bottom-right corner | Letter shifted 20 to 28px right | "LATE" in `--off`, right-aligned. Line 2: "+72 ms", right-aligned. |
| **Wrong sound** (combines with any timing state) | Timing fill stays. Slash `--on-ink` on fills, timing color on residue. Chip: face `--ground`, 2px `--ink` border, heard letter `--ink` | Diagonal slash through the letter plus a 40 × 40 heard-letter chip in the top-right corner | Timing shift and chevron still apply | Line 3: 14px x icon + "heard t" in `--ink`, aligned like line 1. Streak resets. |
| **Missed** (no hit by window close) | Border `--ink-2` dashed, letter `--line` | No fill. 3px dashed border (6 on, 4 off). | Letter centered | "MISS" in `--ink`, centered. Line 2: "no hit" `--ink-2`. |
| **Extra on a rest step** | Diamond `--off`, heard letter `--ink` | Rest pad (ground face, 2px dashed `--line`) shows a 48 × 48 diamond outline (3px) with the heard letter at 20px inside. The rest dot hides. | At the rest pad | "EXTRA" in `--off`, centered. Line 2: "heard t" `--ink-2`. |
| **Extra as a second hit** | Badge face `--ground`, border `--off`, plus sign `--ink` | 24 × 24 diamond badge, 2px border, 2px "+" inside, replaces the step number at (6, 6) | On the already-judged pad, which keeps its own state | Line 3: diamond-plus icon + "+1 extra" `--ink`. Further extras count up ("+2 extra"). |
| **Count-in beat** | LEDs `--ink`, digit `--ink`, other letters `--line` | Both LED bars of the beat pair light. The left pad of the pair shows the beat digit (Azeret 700 72px) in place of its letter. No fill. | Pair 1 on beat 1, pair 2 on beat 2, and so on | BAR readout value reads "Count-in". |
| **Rest step** (pattern, not a judgment) | Face `--ground`, border 2px dashed `--line`, dot `--line` | Recessed pad with an 8px dot in the center, no letter, no lane | | None |

Persistence: the flash decays to residue. Residue, chip, slash, chevron, shifted letter and verdict text stay until that step's judging window opens again next bar (half a step before its beat). An early hit is never wiped by the playhead arriving after it.

---

## 4. Components

### 4.1 App header with nav

- Full width, 64 tall, `--ground`, 1px `--seam` line at the bottom. Inner content column 1188.
- Layout: `display:flex; flex-wrap:wrap; align-items:center; gap:12px 24px`. Children in DOM order: wordmark (`flex: 1 1 auto`), mic meter, nav.
- **Wordmark:** logo mark 24 × 24 + 8px gap + "Beatbox Practice" (`wordmark`, `--ink`). Logo mark: eight 4 × 4 squares in two rows of four (x 2, 8, 14, 20, y 7 and 13), 1.5px `--ink` stroke, squares 1 and 6 filled `--ink`.
- **Mic meter:** see 4.10 (header size).
- **Nav:** three links, `display:flex; gap:8px; flex: 0 1 376px`. Each link `flex: 1 1 0; min-width: 96px; height: 44px`, radius 8, `button` style. Text "Teach", "Practice", "Results" (CSS uppercase). Selected (`aria-current="page"`): `--ink` face, `--on-ink` text. Others: 2px `--line` border, `--ink` text. Hover: border `--ink-2`.
- Links: Teach to `Calibrate.dc.html`, Practice to `Main.dc.html`, Results to `Results.dc.html`.
- Behavior in the app: switching screens while playing stops the session first (results are kept). Tabs are never disabled. A screen that cannot work yet explains itself (see 4.13).

### 4.2 Pattern view (step row)

One column per step, 132 wide. Columns in beat groups: `.steps { display:flex; flex-wrap:wrap; column-gap:28px; row-gap:24px }`, each `.beat { display:flex; gap:12px }` holds 2 columns. Column, top to bottom:

1. **Beat band**, 28 tall: count label centered ("1", "&", "2", "&", "3", "&", "4", "&"), Azeret 14px, beat numbers `--ink`, "&" `--ink-2`, 16 tall. 6px gap. LED bar 132 × 6, radius 2: unlit `--seam`, next up `--ink-2`, playhead or count-in `--ink`.
2. 8px gap.
3. **Pad**, 132 × 132, radius 8. Idle: face `--pad`, 2px `--line` border, letter `--ink` (not playing) or `--ink-2` (playing, not next or current), notches `--ink-2`, step number `--ink-2` (`num-xs`). States per section 3.
4. 8px gap.
5. **Verdict block**, 132 × 80, three lines: line 1 (32 tall) `verdict`, line 2 (22 tall) `num-m` in `--ink-2`, line 3 (24 tall) 14px icon + `body` text in `--ink`. Alignment follows the timing: early left, late right, everything else centered. Empty until judged.
6. 8px gap.
7. **Drift lane**, 132 × 88 (see 4.3). Rest steps leave this space empty.

### 4.3 Hit marker: drift lane tick

- Lane box 132 × 88, radius 4, 1px `--seam` frame, transparent (ground) face.
- On-time band: x 46 to 86 (40 wide = ±50 ms), y 4 to 72, `--pad` fill. Center line: 2px `--line`, x 65 to 67, y 4 to 72.
- Scale: 0.4 px per ms. Tick center x = `66 + clamp(offset, −150, 150) × 0.4`.
- Rows: 4, newest on top. Row centers at y 14, 30, 46, 62. Opacity 1.0, 0.9, 0.8, 0.7.
- Tick: 10 × 12, radius 2. `--on` when |offset| ≤ 50, else `--off`. Beyond ±150 ms: the tick pins to the edge and becomes a 10 × 12 triangle pointing outward. Ticks show timing only, never sound.
- Missed: 20 × 3 bar in `--ink-2`, centered on the line.
- Average caret, row y 74 to 86: 10 × 8 `--ink` triangle pointing up at the mean offset of the hits in the visible rows. Shown only with 3 or more hits. Its value (`num-xs`, `--ink-2`, for example "−57") shows only when |mean| > 50, placed on the outer side of the caret, 6px away.

### 4.4 Live readouts (status row)

No boxes, no tiles. `display:flex; flex-wrap:wrap; justify-content:space-between; align-items:flex-end; gap:16px 48px`, 88 tall on desktop.

- **Streak** (left): label "STREAK" (`label`, `--ink-2`), then value (`num-streak`, `--ink`) with "best 12" (`num-s`, `--ink-2`) 12px to its right on the baseline.
- **Readout groups** (right, `display:flex; flex-wrap:wrap; gap:16px 48px`), each: label (`label`, `--ink-2`) above, value (`num-readout`, `--ink`) and subline (`num-s`, `--ink-2`) on one line, 12px apart.
  - "ON TIME": "58%" and "107 of 184 steps".
  - "SOUND MATCH": "71%" and "B 84  t 72  K 55" (letters `--ink`, numbers `--ink-2`). Sounds not in the pattern are omitted (Pulse shows "B 84" only).
  - "BAR": "23" and "01:18".
- Before Start: every value shows "–" (en dash, U+2013), sublines empty. During count-in the BAR value reads "Count-in" (Archivo 700 28px).
- Values swap instantly, no count-up.

### 4.5 Buttons

| Variant | Face | Border | Text | Height | Use |
|---|---|---|---|---|---|
| Primary | `--ink` | none | `--on-ink`, `button` | 48 or 56 | Record, Done, Practice again, Try again, Go to ... |
| Secondary | transparent | 2px `--line` | `--ink`, `button` | 48 or 56 | Redo, Re-teach a sound, tempo minus and plus |
| Start | `--ink` | none | `--on-ink`, `button-l` | 56 | START |
| Stop | `--pad` | 3px `--ink` | `--ink`, `button-l` | 56 | STOP (while running) |

- Radius 8, horizontal padding 20, icon 20px left of the label with an 8px gap.
- Hover: secondary border becomes `--ink-2`. Primary has no hover change beyond the pointer cursor.
- Pressed: `translateY(1px)`.
- Disabled: opacity 0.45, `cursor: not-allowed`, and a full-strength reason in text nearby.
- Focus: the global 3px `--ink` ring.

### 4.6 Pattern picker

- Group label "PATTERN". While running the label row reads "PATTERN" plus "Stop to change" (`body-s`, `--ink-2`, normal case) and the buttons sit at opacity 0.45.
- `display:grid; grid-template-columns: repeat(auto-fit, minmax(108px, 1fr)); gap:8px`. Group `flex: 1 1 460px`. Buttons 148 × 56 on desktop.
- Each button: name (`button` size, as typed, no tracking, Archivo 700 15px) on line 1, pattern string (`num-xs`) on line 2, left-aligned, padding 8 12.
  - "Pulse" / "B·B·B·B·"
  - "Boots & cats" / "BtKtBtKt"
  - "Push" / "BtKtBBKt"
- Selected (`aria-pressed="true"`): `--ink` face, `--on-ink` text. Others: secondary style. Choosing one relabels the pads at once.

### 4.7 Tempo control

- Group label "TEMPO" (plus "Stop to change" while running, as above). Group width 336: minus 44 × 44, 8 gap, value block 88 wide, 8 gap, plus 44 × 44, 16 gap, slider 128 wide.
- Minus and plus: secondary, square, minus and plus icons, `aria-label` "Slower" and "Faster". Step 5 BPM.
- Value block: "70" (`num-tempo`, `--ink`) centered, "BPM" (`num-xs`, `--ink-2`) under it.
- Slider: native `<input type="range" min="60" max="120" step="1">`, 44 tall hit area, 4px `--line` track, 20px `--ink` thumb with a 2px `--ground` ring. Arrow keys step 1.
- Range 60 to 120, default 70.

### 4.8 Metronome toggle

- Group label "CLICK". Button 104 × 56, secondary style, `aria-pressed`.
- Content: speaker icon 20, 8 gap, LED dot 10 × 10, 6 gap, "ON" or "OFF" (`button`). On: dot filled `--ink`. Off: dot is a 2px `--line` ring.
- Stays usable while running. The count-in always clicks, whatever this toggle says.

### 4.9 Start / Stop

- 168 × 56 (`flex: 1 0 168px`, so it fills its row when the deck wraps). No group label (an empty 16px label row keeps alignment).
- Start: play icon + "START" (`button-l`) on line 1, "or Space" (`num-xs`) on line 2.
- Stop: stop icon + "STOP", "or Space". Stop goes straight to Results.
- Space toggles start and stop from anywhere on Practice.

### 4.10 Mic level meter

- **Header size:** mic icon 20, 8 gap, 12 segments 5 × 16, 2 gap, radius 1. Lit `--ink`, unlit `--seam`. `role="meter"`, `aria-label` "Mic level". Mic blocked: mic-off icon, all segments unlit, text "Mic blocked" (`body-s`, `--ink-2`).
- **Teach size:** inside the input strip. 32 segments, `display:flex; gap:3px`, each `flex:1 1 0; height:24px`, radius 2. TRIGGER marker: 2px wide, 36 tall vertical line at the detection threshold (62% of the meter width), `--ink-2`, flashes `--ink` 150 ms per onset. Label "TRIGGER" (`num-xs`, `--ink-2`) centered under the marker.

### 4.11 Sample-count indicator (Teach card)

- 8 slots, `display:flex; flex-wrap:wrap; gap:8px`, each 32 × 32, radius 4.
- Empty: 2px `--line` border. Filled: `--ink` face. Newest: filled plus the 300 ms ring (section 2.5).
- Count under the slots: "5/8" (`num-readout` at 700). At 8/8, a 24px check icon follows the count.

### 4.12 Sound card (Teach)

- 380 × 392 on desktop, `--panel`, radius 12, 2px `--seam` border, padding 24.
- Top row (16 tall): label ("KICK", "HI-HAT", "SNARE") left, status right (`body-s`, `--ink-2`): "Done" with a check icon, "Listening" with an 8px `--ink` dot, or "Not started".
- Letter (`letter-xl`, `--ink`) at y 48 to 168.
- Caption (`body-s`, `--ink-2`) at y 176 to 196.
- Slots at y 220 to 252, count at y 268 to 300.
- Buttons at y 320 to 368: "Record" (primary, 160 × 48, mic icon) at x 24 and "Redo" (secondary, 120 × 48, redo icon) at x 196.
- Armed: 3px `--ink` border, and the Record button turns into "Listening" (face `--pad`, 3px `--ink` border, `--ink` text, 8px blinking `--ink` dot in place of the icon). Pressing it pauses.
- Complete: the Record button is removed and Redo moves to x 24.
- Redo clears that card's 8 samples and arms it. With 0 samples Redo is disabled.
- At 8/8 the card stops and arms the next incomplete card. Only one card is armed at a time.

### 4.13 Notices

Neutral strips. Never accent colored. `--panel` face, 2px `--line` border on all four sides, radius 8, padding 16 20, `display:flex; flex-wrap:wrap; gap:12px 16px; align-items:center`. Icon 24 `--ink`, title (`body`, weight 600, `--ink`), body (`body-s`, `--ink-2`), optional button.

| Notice | Icon | Title | Body | Button | Where |
|---|---|---|---|---|---|
| Headphones | headphones | "Headphones on. Press Start or Space." | "Wired headphones work best. Speakers leak the click into the mic, and Bluetooth adds delay." | none | Practice, idle, above the step row |
| No sound | mic | "No sound detected." | "Move closer to the mic." | none | Practice while running after 2 bars with no onset. Teach while armed after 4 s with no onset. |
| Practice locked | mic | "Teach all three sounds first." | "13 of 24 samples so far." | Primary "Go to Teach", links to `Calibrate.dc.html` | Practice before 24 of 24. Start is disabled. |
| Results empty | play | "No results yet." | "Play at least 8 bars on Practice, then press Stop." | Primary "Go to Practice", links to `Main.dc.html` | Results before the first session |
| Mic blocked (panel, larger) | mic-off 32 | "Mic access is blocked" (`headline`) | "Beatbox Practice needs your mic to hear your sounds. Click the icon left of the web address, set Microphone to Allow, then press Try again." | Primary "Try again" 160 × 48 | Teach and Practice, replaces the input strip or step row |

### 4.14 Self-test panel (Teach)

- 1188 × 200, `--panel`, radius 12, padding 24. `display:flex; flex-wrap:wrap; gap:24px 32px`.
- Column A (`flex: 1 1 260px`): label "TEST", then "Make any of your sounds." (`body`, `--ink`), then status text (`body-s`, `--ink-2`).
- Column B: three lamp pads 104 × 104, gap 12 (336 wide). Lamp: `--pad` face, 2px `--line` border, radius 8, letter `letter-l` `--ink`. On a detection the matched lamp lights for 500 ms: `--ink` face, `--on-ink` letter. Locked: `--ground` face, 2px dashed `--line` border, letter `--line`.
- Column C (`flex: 1 1 360px`): label "HEARD", then the heard letter (`letter-l`) + its name ("Snare", `body`). Then three closeness rows, 24 tall each: letter (`num-s`, `--ink`) 20 wide, bar 240 × 10 (track `--pad`, fill `--ink` for the closest sound and `--line` for the others), value (`num-s`). Then label "LAST 8" and the last 8 detections (Azeret 20px, single spaces). If the top two closeness values are within 15 points, show (`body-s`, `--ink`): "t and K sound alike. Re-teach one of them for cleaner results."
- Locked until 24 of 24 samples: status reads "Unlocks at 24 of 24 samples. 11 to go.", heard shows "–", bars are empty tracks with "–" values, history reads "No sounds yet".

### 4.15 Results stat block

- No box. Label (`label`, `--ink-2`), 8 gap, value (`num-stat`, `--ink`), 4 gap, subline (`num-s`, `--ink-2`).
- Row: `display:flex; flex-wrap:wrap; gap:24px 48px`, each block `flex: 1 1 160px`.

### 4.16 Next-step block

- `--panel`, radius 12, padding 32, no top rule, no accent. `display:flex; flex-wrap:wrap; gap:24px 48px; align-items:center`.
- Text (`flex: 1 1 320px`): label "NEXT STEP", 12 gap, sentence (`next`, `--ink`), 12 gap, reason (`body`, `--ink-2`).
- Actions (`flex: 0 1 220px; display:flex; flex-direction:column; gap:12px`): "Practice again" (primary, 220 × 56, play icon) and "Re-teach a sound" (secondary, 220 × 56, redo icon).
- Practice again opens Practice with the suggested pattern and tempo preset (still editable). Re-teach a sound opens Teach with the card of the lowest-match sound armed (this session: Snare).

### 4.17 Timing split bar (Results)

- One row per sound in the pattern: letter (`letter-m`) 40 wide, 16 gap, bar (`flex: 1 1 auto`, 360 on desktop, 28 tall), 16 gap, average (`num-m`, right-aligned, 96 wide).
- Bar segments in fixed order, each a fraction of that sound's target steps, 2px `--panel` gaps between segments, radius 4 on the outer ends: EARLY `--off`, ON TIME `--on`, LATE `--off`, MISSED transparent with a 2px dashed `--line` outline. Percent text inside (`num-s`, `--on-ink` on fills, `--ink-2` on missed) only when the segment is 40px or wider.
- Under the bar (`num-s`, `--ink-2`): "Early 27  On time 117  Late 30  Missed 6".
- Direction reads from which side of the middle segment is wider, from the order and from the counts line, never from hue.

### 4.18 Sound match row (Results)

- Letter (`letter-m`) 40 wide, 16 gap, then a column: name (`body`, `--ink`) and a 300 × 16 bar below it (track `--pad`, fill `--ink`, radius 4), then the value (`num-readout` at 700) right-aligned with "146 of 174 hits" (`num-s`, `--ink-2`) under it.
- A sound under 70% gets a line under the row (`body-s`, `--ink`): "Most often heard as t (58 times)."
- A sound not in the pattern shows "Not in this pattern" (`body-s`, `--ink-2`) in place of the bar and value.

### 4.19 Icons

Inline SVG, `viewBox="0 0 24 24"`, `fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"`, color inherits from text.

| Name | Path data | Description |
|---|---|---|
| mic | `<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>` | Capsule mic on a stand |
| mic-off | mic + `<path d="M4 4l16 16"/>` | Mic with a diagonal strike |
| headphones | `<path d="M4 16v-4a8 8 0 0 1 16 0v4"/><rect x="3" y="15" width="4" height="6" rx="1"/><rect x="17" y="15" width="4" height="6" rx="1"/>` | Headband and two cups |
| play | `<path d="M8 5l11 7-11 7z"/>` | Outlined triangle |
| stop | `<rect x="6" y="6" width="12" height="12" rx="1"/>` | Outlined square |
| speaker | `<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M17 9a4 4 0 0 1 0 6"/>` | Speaker with one wave |
| minus | `<path d="M5 12h14"/>` | Bar |
| plus | `<path d="M5 12h14M12 5v14"/>` | Cross |
| x | `<path d="M6 6l12 12M18 6L6 18"/>` | Wrong sound |
| check | `<path d="M5 12.5l4.5 4.5L19 7"/>` | Done |
| redo | `<path d="M3 4v6h6"/><path d="M3.5 10a8.5 8.5 0 1 1 2 5.5"/>` | Counter-clockwise arrow |
| diamond-plus | `<path d="M12 3l9 9-9 9-9-9z"/><path d="M12 9v6M9 12h6"/>` | Extra hit |
| arrow-right | `<path d="M5 12h14M13 6l6 6-6 6"/>` | Go to |
| chevron-left (pad) | `viewBox="0 0 16 28"`, `<path d="M13 3L3 14l10 11"/>`, stroke-width 4 | Early marker |
| chevron-right (pad) | `viewBox="0 0 16 28"`, `<path d="M3 3l10 11L3 25"/>`, stroke-width 4 | Late marker |

---

## 5. Sample session (one coherent story)

The user teaches the three sounds (Calibrate snapshot at 13 of 24), then plays Boots & cats at 70 BPM (Main snapshot at bar 23), then stops after 90 bars (Results).

- 70 BPM: a step (eighth note) lasts 428.6 ms, a bar 3.43 s. The judging window is ±214 ms, on time is ±50 ms.
- Boots & cats per bar: 2 B, 4 t, 2 K.
- Session time counts from the first downbeat after the count-in.

**At the Main snapshot** (playhead on step 8 of bar 23, just after its beat): elapsed 22 bars + 7 steps = 78.4 s, shown "01:18". 184 target steps judged. On time 107 of 184 = 58%. Missed 9 (B 2, t 5, K 2). Hits on target steps 175. Right sound 124 of 175 = 71%: B 37 of 44 (84%), t 63 of 87 (72%), K 24 of 44 (55%). Streak 3, best 12.

**At Results** (Stop at the end of bar 90): 90 bars = 308.6 s, shown "05:09". 720 target steps (B 180, t 360, K 180). 12 extra hits.

| Sound | Early | On time | Late | Missed | Mean offset | Hits | Right sound |
|---|---|---|---|---|---|---|---|
| B | 27 (15%) | 117 (65%) | 30 (17%) | 6 (3%) | +6 ms | 174 | 146 (84%) |
| t | 86 (24%) | 216 (60%) | 40 (11%) | 18 (5%) | −12 ms | 342 | 250 (73%) |
| K | 74 (41%) | 86 (48%) | 11 (6%) | 9 (5%) | −38 ms | 171 | 96 (56%), heard as t 58, as B 17 |
| All | 187 | 419 (58%) | 81 | 33 | | 687 | 492 (72%) |

---

## 6. Artboards

All three pages share the header (section 4.1) and the 1188 content column. Positions below are page coordinates at 1440 wide (column x 126 to 1314). "x +n" means n px from the column's left edge.

### 6.1 Main.dc.html (Practice, playing)

PAGE, 1440 wide, fluid. Height at 1440: **788**.

| Region | y | Contents |
|---|---|---|
| Header | 0 to 64 | PRACTICE selected. Mic meter: 7 of 12 lit. |
| Control deck | 88 to 200 | `--panel` 1188 × 112, radius 12, padding 16 24. Label row y 104 to 120, controls y 128 to 184. |
| Status row | 232 to 320 | Streak and readouts (4.4). |
| Step row | 344 to 696 | Beat band 344 to 372, pads 380 to 512, verdicts 520 to 600, lanes 608 to 696. |
| Hint | 720 to 740 | One line, `body-s`, `--ink-2`, left-aligned. |

**Control deck** (running, so pattern and tempo are disabled at 0.45, labels at full strength):

- x +24: label "PATTERN" + "Stop to change". Buttons at x +24, +180, +336 (148 × 56): "Pulse" / "B·B·B·B·", "Boots & cats" / "BtKtBtKt" (selected), "Push" / "BtKtBBKt".
- x +508: label "TEMPO" + "Stop to change". Minus at x +508, value "70" / "BPM" at x +560 to +648, plus at x +656, slider x +716 to +844 with the thumb at 70.
- x +868: label "CLICK". Toggle 104 × 56: speaker, filled dot, "ON".
- x +996: Stop button 168 × 56: stop icon, "STOP", "or Space". Links to `Results.dc.html`.

**Status row:** left "STREAK", "3", "best 12". Right: "ON TIME" "58%" "107 of 184 steps", "SOUND MATCH" "71%" "B 84  t 72  K 55", "BAR" "23" "01:18".

**Step row**, pattern Boots & cats, bar 23. Column x: pad 1 at +0, 2 at +144, 3 at +304, 4 at +448, 5 at +608, 6 at +752, 7 at +912, 8 at +1056. Count labels "1 & 2 & 3 & 4 &". LED bars: only step 8 lit (`--ink`, playhead). Step 1's window has not opened yet, so all 8 pads show bar 23.

| Step | Letter | Pad state | Verdict line 1 / 2 / 3 | Lane rows, newest first (ms) | Caret |
|---|---|---|---|---|---|
| 1 | B | On time residue: 4px `--on` border, letter `--ink` centered | "ON" / – / – | +12, −20, +34, +58 | at +21, no value |
| 2 | t | On time residue | "ON" | −8, −56, +14, −22 | at −18 |
| 3 | K | Early residue + wrong sound: 4px `--off` border, letter `--ink` 21px left, chevron-left `--off` bottom-left, slash `--off`, chip "t" | "EARLY" (left) / "−64 ms" / x "heard t" | −64, −58, −71, −35 | at −57, value "−57" |
| 4 | t | Missed: 3px dashed `--ink-2`, letter `--line` | "MISS" / "no hit" | miss, −44, −12, +26 | at −10 |
| 5 | B | Late residue: 4px `--off` border, letter 22px right, chevron-right `--off` bottom-right | "LATE" (right) / "+72 ms" | +72, +18, −6, +40 | at +31 |
| 6 | t | On time residue | "ON" | +21, −15, −62, +58 | at +1 |
| 7 | K | On time residue | "ON" | −41, −66, −52, −30 | at −47, no value |
| 8 | t | Hit flash + playhead: face `--on`, letter, notches, step number `--on-ink`, top notch enlarged, LED lit | "ON" | +9, −53, +5, −36 | at −19 |

**Hint:** "Space starts and stops. The lane under each pad shows your last 4 hits on that step. Left of the line is early, right is late."

### 6.2 Calibrate.dc.html (Teach your sounds)

PAGE, 1440 wide. Height at 1440: **1024**.

| Region | y | Contents |
|---|---|---|
| Header | 0 to 64 | TEACH selected. Mic meter: 5 of 12 lit. |
| Title | 88 to 160 | "Teach your sounds" (`title`) at y 88 to 128. Right-aligned on the title baseline: "13 of 24 samples" (Azeret 500 20px, `--ink`). Line at y 136 to 160 (`body`, `--ink-2`): "Make each sound 8 times with a short pause between. Sit where you will practice." |
| Input strip | 184 to 256 | `--panel` 1188 × 72, radius 12, padding 0 20, flex-wrap, centered. Mic icon, "MIC" (`label`), meter x +92 to +812 (9 of 32 segments lit, TRIGGER marker at segment 20), text at x +836: "Wired headphones work best. Bluetooth adds delay." (`body-s`, `--ink-2`). |
| Sound cards | 280 to 672 | Three 380 × 392 cards at x +0, +404, +808 (grid, 24 gap). |
| Self-test | 696 to 896 | Locked state (4.14). |
| Footer | 920 to 976 | Left: "13 of 24 samples. Practice unlocks at 24." (`body-s`, `--ink-2`). Right: primary "Done" 220 × 56 with arrow-right icon, disabled look (0.45). Links to `Main.dc.html` in the prototype. |

Cards:

| | Kick | Hi-hat | Snare |
|---|---|---|---|
| Label | "KICK" | "HI-HAT" | "SNARE" |
| Status | check icon + "Done" | blinking dot + "Listening" | "Not started" |
| Letter | "B" | "t" | "K" |
| Caption | "Say B, short and punchy." | "Say t, short and crisp." | "Say K. If your snare is Pf, record Pf." |
| Slots | 8 filled | 5 filled, slot 5 shows the newest ring | 8 empty |
| Count | "8/8" + check icon | "5/8" | "0/8" |
| Border | 2px `--seam` | 3px `--ink` (armed) | 2px `--seam` |
| Buttons | "Redo" (secondary) at x 24 | "Listening" (armed) at x 24, "Redo" at x 196 | "Record" (primary) at x 24, "Redo" disabled at x 196 |

Self-test (locked): column A "TEST", "Make any of your sounds.", "Unlocks at 24 of 24 samples. 11 to go." Column B: three locked lamps "B", "t", "K". Column C: "HEARD" "–", closeness rows "B –", "t –", "K –" with empty tracks, "LAST 8" "No sounds yet".

### 6.3 Results.dc.html (after Stop)

PAGE, 1440 wide. Height at 1440: **1044**.

| Region | y | Contents |
|---|---|---|
| Header | 0 to 64 | RESULTS selected. Mic meter: 1 of 12 lit. |
| Title | 88 to 152 | "Results" (`title`). Meta at y 132 to 152 (`num-m`, `--ink-2`): "Boots & cats · 70 BPM". |
| Next step | 176 to 384 | Block 1188 × 208 (4.16). |
| Stats | 416 to 524 | Three stat blocks. |
| Panels | 556 to 996 | Two `--panel` panels 582 × 440, radius 12, padding 24, at x +0 and +606 (grid, 24 gap). |

**Next step:**
- "NEXT STEP"
- "Drop to 60 BPM and play Boots & cats until on time is above 70%."
- "You were on time for 58% of steps at 70 BPM. At 60 BPM each step lasts 500 ms instead of 429 ms."
- "Practice again" links to `Main.dc.html`. "Re-teach a sound" links to `Calibrate.dc.html`.

**Stats:**

| Label | Value | Subline |
|---|---|---|
| "SESSION" | "05:09" | "min:sec, count-in not included" |
| "BARS" | "90" | "8 steps each" |
| "ON TIME" | "58%" | "419 of 720 steps. 12 extra hits." |

**Timing panel** (x +0):
- "TIMING BY SOUND"
- Headline (`headline`): "You rush the snare (K) by 38 ms on average."
- Caption (`body-s`, `--ink-2`): "Each bar splits that sound's steps into early, on time, late and missed."
- Rows at y +168, +248, +328 inside the panel:
  - B: segments 15% / 65% / 17% / 3% (54 / 234 / 61 / 11 px), text "15%" "65%" "17%", average "+6 ms", counts "Early 27  On time 117  Late 30  Missed 6".
  - t: 24% / 60% / 11% / 5% (86 / 216 / 40 / 18 px), text "24%" "60%" "11%", average "−12 ms", counts "Early 86  On time 216  Late 40  Missed 18".
  - K: 41% / 48% / 6% / 5% (148 / 172 / 22 / 18 px), text "41%" "48%", average "−38 ms", counts "Early 74  On time 86  Late 11  Missed 9".

**Sound panel** (x +606):
- "SOUND MATCH"
- Headline: "72% of your hits were the right sound."
- Caption: "Counts hits on pattern steps. Missed steps and extra hits are left out."
- Rows at y +168, +248, +328: "B" "Kick" bar 84%, "84%", "146 of 174 hits". "t" "Hi-hat" bar 73%, "73%", "250 of 342 hits". "K" "Snare" bar 56%, "56%", "96 of 171 hits", then "Most often heard as t (58 times)."

### 6.4 States.dc.html (reference sheet)

FIXED, **1440 × 3240**. Header at the top (no tab selected, nav links work). Sheet padding 48. Section labels use `label`, `--ink-2`.

| Section | y | Contents |
|---|---|---|
| Title | 96 to 168 | "States and tokens" (`title`). Line (`body`, `--ink-2`): "Every feedback state on the pattern view, plus notices, colors, type and icons." |
| A. "PAD STATES" | 208 to 888 | 16 tiles, two rows of 8. Tile 152 × 304 at x 56 + 168i. Row 1 y 240 to 544, row 2 y 584 to 888. |
| B. "COUNT-IN" | 936 to 1168 | Full 8-pad row (beat band + pads only) at x 126, y 968 to 1136. Caption y 1148. |
| C. "DRIFT LANES" | 1216 to 1472 | Annotated lane at 2× and three 1:1 lanes. |
| D. "NOTICES" | 1520 to 2000 | Three strips, the mic-blocked panel, the Results empty strip. |
| E. "SELF-TEST AFTER 24 OF 24" | 2048 to 2280 | Active self-test panel, 1188 wide at x 126. |
| F. "COLOR" | 2328 to 2576 | 11 swatches. |
| G. "TYPE" | 2624 to 3056 | Type specimens. |
| H. "ICONS" | 3104 to 3192 | Icon row. |

**A. Tile anatomy:** title (`label`, `--ink`) and subline (`body-s`, `--ink-2`) in the top 40px, then a beat band, pad and verdict block exactly as on Main (pad centered, x 10 to 142 in the tile). No lanes.

| # | Title | Subline | Letter | What it shows | Verdict |
|---|---|---|---|---|---|
| 1 | "IDLE" | "Not playing" | B | Idle pad, letter `--ink` | none |
| 2 | "REST" | "Stay silent" | none | Rest pad | none |
| 3 | "UP NEXT" | "Window open" | t | LED `--ink-2`, letter `--ink` | none |
| 4 | "NOW" | "Playhead on the beat" | K | LED `--ink`, face `--pad-lift`, filled top notch | none |
| 5 | "ON TIME" | "At the hit, +9 ms" | t | On-time flash | "ON" |
| 6 | "ON TIME" | "Rest of the bar" | t | On-time residue | "ON" |
| 7 | "EARLY" | "At the hit, −64 ms" | K | Off flash, letter 21px left, chevron-left | "EARLY" / "−64 ms" (left) |
| 8 | "EARLY" | "Rest of the bar" | K | Off residue, letter 21px left | "EARLY" / "−64 ms" (left) |
| 9 | "LATE" | "At the hit, +72 ms" | B | Off flash, letter 22px right, chevron-right | "LATE" / "+72 ms" (right) |
| 10 | "LATE" | "Rest of the bar" | B | Off residue, letter 22px right | "LATE" / "+72 ms" (right) |
| 11 | "WRONG SOUND" | "On time, heard K" | t | On flash + slash + chip "K" | "ON" / – / x "heard K" |
| 12 | "WRONG SOUND" | "Early, heard t" | K | Off flash, letter 21px left, chevron, slash, chip "t" | "EARLY" / "−58 ms" / x "heard t" (left) |
| 13 | "MISSED" | "No hit in the window" | t | Missed | "MISS" / "no hit" |
| 14 | "EXTRA" | "On a rest, heard t" | none | Rest pad with diamond and "t" | "EXTRA" / "heard t" |
| 15 | "EXTRA" | "Second hit on a step" | B | On residue + extra badge | "ON" / – / diamond-plus "+1 extra" |
| 16 | "COUNT-IN" | "Beat 2 of 4" | none | LED `--ink`, digit "2" | none |

**B. Count-in row:** Boots & cats, beat 2. LED bars of steps 3 and 4 lit `--ink`. Pad 3 shows the digit "2" (`digit-count`, `--ink`) in place of its letter. All other letters `--line`. Caption (`body-s`, `--ink-2`): "Count-in: one bar of 4 clicks. The beat pair lights and shows its number, then the pattern starts on pad 1."

**C. Drift lanes:**
- Annotated lane at 2× (264 × 176) at x 48, y 1248: Snare step from Main (−64, −58, −71, −35, caret at −57 with "−57"). Callouts (`body-s`, `--ink`, 1px `--line` leader lines) at x 344 to 744: "Newest hit on top", "Shaded band: on time, ±50 ms", "Center line: exactly on the beat", "Left is early, right is late", "Caret: your average, after 3 hits", "Number shows past ±50 ms", "Fades to 70% by the 4th row".
- Three 1:1 lanes at x 800, 980, 1160, y 1248, captions under each (`body-s`, `--ink-2`): "Leaning early" (−64, −58, −71, −35), "Centered" (+12, −20, +34, +8), "With a miss" (miss, −44, −12, +26).

**D. Notices:**
- Three strips (grid `repeat(auto-fit, minmax(min(420px, 100%), 1fr))`, gap 16) at y 1552 to 1664: Headphones, No sound, Practice locked (copy in 4.13).
- Mic-blocked panel 1344 × 168 at y 1688.
- Results empty strip 1344 × 120 at y 1880.

**E. Self-test, active:** column A "TEST", "Make any of your sounds.", "Ready. 24 of 24 samples." Column B: lamps B, t, K with K lit (`--ink` face). Column C: "HEARD" "K" "Snare". Closeness: "B 9%", "t 41%", "K 50%" (K bar `--ink`, others `--line`). Hint: "t and K sound alike. Re-teach one of them for cleaner results." "LAST 8": "B t t K B K t K".

**F. Color:** 11 swatches, 112 wide, gap 8, starting x 48. Each: 112 × 104 chip (2px `--line` border on the dark ones so their edge shows), then token name (`num-xs`, `--ink`), hex (`num-xs`, `--ink-2`), role in 3 words or fewer (`body-s`, `--ink-2`): ground "Page", panel "Raised panels", pad "Idle pad", pad-lift "Playhead face", seam "Decorative lines", line "Outlines, dim letters", ink-2 "Secondary text", ink "Primary, light faces", on-ink "Text on light", on "On time only", off "Off time only".

**G. Type:** one line per type-scale entry from 2.3, each showing the name (`num-xs`, `--ink-2`, 160 wide column) and a sample in that style: letter-xl "B t K", letter "K", digit-count "2", num-streak "12", num-stat "05:09", letter-l "t", num-tempo "70", letter-m "B", title "Teach your sounds", next "Drop to 60 BPM", verdict "EARLY", num-readout "58%", headline "You rush the snare", chip "t", wordmark "Beatbox Practice", button-l "START", body "Make each sound 8 times.", num-m "−64 ms", button "PRACTICE AGAIN", body-s "Wired headphones work best.", num-s "107 of 184 steps", label "SOUND MATCH", num-xs "BtKtBtKt".

**H. Icons:** every icon from 4.19 at 24px, `--ink`, with its name under it (`num-xs`, `--ink-2`), 96px apart.

### 6.5 Prototype links

| From | Element | To |
|---|---|---|
| All 4 artboards | Header "Teach" / "Practice" / "Results" | `Calibrate.dc.html` / `Main.dc.html` / `Results.dc.html` |
| Main | "STOP" | `Results.dc.html` |
| Results | "Practice again" | `Main.dc.html` |
| Results | "Re-teach a sound" | `Calibrate.dc.html` |
| Calibrate | "Done" | `Main.dc.html` |
| States | "Go to Teach" / "Go to Practice" | `Calibrate.dc.html` / `Main.dc.html` |

---

## 7. In-between widths (no media queries)

This is the wrapping fallback for the desktop pages between phone and desktop widths. The phone layout itself is section 11.

Only `flex-wrap`, `grid` with `repeat(auto-fit, minmax(min(Npx, 100%), 1fr))`, and the 16px column padding. Every fixed-width piece is 340px or narrower, so nothing scrolls sideways at 375px. Only vertical scrolling.

**Main (Practice)**
- Header wraps: row 1 wordmark + mic meter, row 2 the three nav tabs sharing the width (min 96 each).
- Control deck wraps into rows: pattern grid (3 buttons of about 108 to 114, names may wrap to 2 lines), tempo group (336), then Click (104) and Start, which grows to fill its row.
- Status row wraps: streak first, then the three readout groups wrap 2 + 1.
- Step row: beat groups (276 wide) wrap. 4 per row at 1188, 2 per row from about 580, 1 per row on a phone (4 rows of 2 pads). Lanes stay under their pads. The user scrolls to see beats 3 and 4.
- Hint wraps.

**Calibrate (Teach)**
- Title row wraps (the sample count drops under the title).
- Input strip wraps: mic, label and meter on row 1 (meter `flex: 1 1 200px`, segments shrink), headphones text on row 2.
- Cards: grid `minmax(min(320px, 100%), 1fr)`, one column on a phone. Slots (312 wide) wrap inside a narrower card.
- Self-test columns wrap: text, then lamps (336), then heard and closeness.
- Footer wraps: text, then Done filling the width (`flex: 1 1 220px`).

**Results**
- Content order on every width: title, next step, stats, timing panel, sound panel.
- Next step wraps: text first, then the two buttons (each fills the row).
- Stats wrap 2 + 1 (`flex: 1 1 160px`).
- Panels: grid `minmax(min(320px, 100%), 1fr)`, one column. Split bars and match bars are `flex: 1 1 auto` and shrink.

**States** is a fixed sheet and has no phone layout.

---

## 8. Rules the app must follow

- **Matching:** each target step k has beat time `t_k` and a window `t_k ± h`, h = half a step (`15 / BPM` s, 214 ms at 70, 125 ms at 120). A hit belongs to the step whose window contains it. If that step is a rest, or already has a hit, the hit is EXTRA. MISS is judged when an unclaimed window closes. Timing and sound are judged separately: matching uses time only.
- **On time:** |offset| ≤ 50 ms at every tempo.
- **On time %** = on-time target steps / judged target steps (missed counts as not on time). **Sound match %** = right-sound hits / hits on target steps (missed steps and extras left out). Extras are counted and shown on their own.
- **Streak:** consecutive target steps that are on time AND the right sound. MISS, EXTRA, an off-time hit or a wrong sound resets it to 0. Rest steps with no hit neither add nor reset. Best = the highest streak this session.
- **Tendency sentence:** among sounds in the pattern with at least 10 hits, take the largest |mean offset|. Beyond ±20 ms: "You rush the {sound} by {n} ms on average." (early) or "You drag the {sound} by {n} ms on average." (late). Otherwise "Your timing is centered." Sound names: "kick (B)", "hi-hat (t)", "snare (K)".
- **Next step** (one threshold, 70%, first match wins). Fewer than 8 bars: "Play at least 8 bars for a next step." with no reason line.
  1. On time below 70% and BPM above 60: "Drop to {max(60, BPM − 10)} BPM and play {pattern} until on time is above 70%." Reason: "You were on time for {x}% of steps at {BPM} BPM. At {new} BPM each step lasts {30000 / new} ms instead of {30000 / BPM} ms."
  2. On time below 70% at 60 BPM, pattern is Push or Boots & cats: "Stay at 60 BPM and switch to {easier} until on time is above 70%." (Push to Boots & cats, Boots & cats to Pulse). Reason: "You were on time for {x}% of steps at the slowest tempo."
  3. On time below 70%, Pulse at 60 BPM: "Keep playing Pulse at 60 BPM until on time is above 70%." Reason: "You were on time for {x}% of steps. Land each B on the click."
  4. A sound in the pattern with at least 10 hits and match below 60%: "Re-teach the {sound}, then play {pattern} at {BPM} BPM again." Reason: "Only {x}% of your {letter} hits matched. Most were heard as {letter2}."
  5. BPM below 120: "Raise to {min(120, BPM + 10)} BPM and keep playing {pattern}." Reason: "You were on time for {x}% of steps at {BPM} BPM."
  6. At 120 and not Push: "Move on to {next pattern} at 70 BPM." Reason: "You were on time for {x}% of steps at the fastest tempo."
  7. Push at 120: "Keep Push at 120 BPM and aim for a longer streak." Reason: "You were on time for {x}% of steps at the fastest tempo."
- Per-sound stats skip sounds that are not in the pattern ("Not in this pattern").

---

## 9. Implementation notes

- **Clock:** one `AudioContext`. Standard lookahead scheduler (25 ms timer, schedule 100 ms ahead). Clicks on quarter notes: beat 1 at 1500 Hz, beats 2 to 4 at 1000 Hz, 30 ms. The count-in bar always clicks. Loop start `t0` = count-in start + 4 quarters. Step k at `t_k = t0 + k × 30 / BPM`.
- **Mic:** `getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } })`. On `NotAllowedError` show the mic-blocked panel.
- **Onsets** in an `AudioWorklet`: RMS per 128-frame block, onset when RMS rises above the threshold (the TRIGGER marker) after falling below half of it, refractory 90 ms. Timestamp = `(currentFrame + index) / sampleRate`. Post the onset time and a 2048-sample snippet (about 43 ms) to the main thread. Never poll an AnalyserNode from rAF for onsets.
- **Classifier:** features per snippet: 6 log band energies, spectral centroid, zero-crossing rate. z-score with the mean and spread of the 24 samples. k = 3 nearest neighbours, majority vote, ties go to the nearest. Self-test closeness per sound = `(1 / d_s) / Σ(1 / d)`, with d_s the mean distance to that sound's 3 nearest samples. Store the 24 feature vectors in `localStorage` inside try/catch, so Teach survives a reload.
- **Latency:** `offset = (onsetTime − inputLatency) − (t_k + ctx.outputLatency + ctx.baseLatency) − LATENCY_MS / 1000`. `inputLatency` from `track.getSettings().latency`, fallback 0.01. `const LATENCY_MS = 0` is the single tuning knob in code, no UI.
- **Visual sync:** map audio time to the screen with `ctx.getOutputTimestamp()`: heard time now = `contextTime + (performance.now() − performanceTime) / 1000`. One rAF loop compares heard time to the step schedule and switches classes: at `t_k − h` clear step k (residue, verdict, chip, slash, badge) and set Next up. At `t_k` move the playhead. At `t_k + h`, if unclaimed, set MISS. Hit flashes are applied on the first frame after the onset message.
- **Per hit, compute:** step k, offset ms, timing class (on, early, late), heard sound, right or wrong, then update the pad, letter `translateX(shift)`, verdict text, the lane (unshift into k's 4-row history, tick x from section 4.3), streak, and the running counts behind the readouts.
- **Keyboard:** Space on `document` keydown with `preventDefault()`, ignore `e.repeat`. Focus rings on all controls.
- **Results** are computed from the same counts at Stop: session time, completed bars, on time %, per-sound split and mean, per-sound match, extras, tendency, next step.

---

## 10. Review fixes

| Fix | Status |
|---|---|
| Residue cleared when the playhead enters (wipes early hits) | Applied. A step clears when its own window opens, half a step before its beat. |
| Early vs late too weak at 60 cm | Applied. Letter shift 20 to 28px, chevron in the bottom corner on that side, verdict words 28px and aligned left or right, lane ticks left or right. |
| Wrong sound reads as good, five overlapping cues | Applied. Stripes and plate dropped. Slash through the letter plus a 40px heard-letter chip, line 3 "heard t", same at every width. The hollow-pad idea was not used: the beginner lens asked for the slash, and the chip says what was heard. |
| Hit-to-step rule, denominators, streak, tendency, next-step rule | Applied. Section 8. One threshold (70%), a 60 BPM floor rule, an 8-bar minimum, 10 hits before a tendency or re-teach. |
| Latency | Applied. One formula and `LATENCY_MS` in code, wired-headphones line on Teach and in the Practice idle notice. No latency UI. |
| Drift lane density and aging contrast | Applied. 4 rows, 10 × 12 ticks, opacity floor 0.7 (3.28:1 checked), text only for the gated caret value, timing only. |
| Gate navigation | Applied. Tabs always work. Practice shows the locked notice and disables Start until 24 of 24. Results shows the empty notice before a session. |
| AudioContext time, AudioWorklet onsets, mic constraints, getOutputTimestamp, onset and classifier parameters | Applied. Section 9. |
| `--edge` and `--ink-faint` contrast | Applied. Merged into `--line #7A7F88`. Notches use `--ink-2`. Ratios re-measured. |
| Playhead told from on time by hue only | Applied. Playhead border removed. Playhead = LED bar + face lift + filled top notch. Count-in uses LEDs and a digit, never a fill. |
| KPI tile strip | Applied. Streak large, the rest as text groups on the ground. |
| "BX-8" name | Applied. Plain "Beatbox Practice" with an 8-square mark. |
| Top rule on Next Step | Applied. Removed. |
| Grayscale and color-vision check | Applied in the script (on vs off: 2.39:1, 2.06:1 deuteranopia, 3.10:1 protanopia). No separate phone wrong-sound variant. |
| Accents leaking into Teach, nav, buttons, meters | Applied. Accents appear only as timing judgments. |
| Keyboard Space, focus rings, stop on screen switch, mic-blocked state | Applied. |
| Phone fixed bottom START bar with safe-area padding | Not applied. The phone layout uses no media queries, so there is no fixed bar to cover content. Start stays in flow in the control deck, above the pads. |
| Session Score, tuner, IQR bars, latency UI, mini waveforms in slots, per-sound shapes | Not added. Out of the fixed scope or extra build cost with no beginner gain. |

---

## 11. Phone (390 wide)

The phone is a first-class target, not a wrapped desktop. Assumed setup: phone propped up about 40 cm away, wired or USB-C headphones. Same tokens, type families, feedback encoding and sample session as above. Sections 1 to 5 and 8 hold unchanged unless this section says otherwise. Section 7 is only the wrapping fallback between phone and desktop widths.

Rules for phone:

- Practice never scrolls while playing: everything for the bar fits on one 390 × 844 screen. Teach fits 844 too. Results scrolls.
- Navigation moves to a bottom tab bar (thumb reach). The header keeps only the wordmark and the mic meter.
- The main action (START, STOP, Done) is a full-width button just above the tab bar.
- While playing, the pattern and tempo controls collapse into one line, and the readouts shrink to values only.
- No "or Space" hints on phone. Minimum text is still 12px. Touch targets are still at least 44 × 44.
- Content column: 16px side padding, so 358 wide.

### 11.1 Phone header

52 tall, `--ground`, 1px `--seam` bottom line, padding 0 16, `display:flex; align-items:center; justify-content:space-between`.

- Left: logo mark 24 × 24 (same as 4.1) + 8 gap + "Beatbox Practice" (Archivo 800 16/24, stretch 125%, `--ink`).
- Right: mic meter, mic icon 18 + 8 gap + 12 segments 4 × 14, gap 2, radius 1. Lit `--ink`, unlit `--seam`. `role="meter"`, `aria-label` "Mic level".

### 11.2 Bottom tab bar

64 tall at the bottom of the screen (y 780 to 844 on an 844 screen), `--ground`, 1px `--seam` top line. `<nav aria-label="Main">` with three `<a>` tabs, `display:grid; grid-template-columns: repeat(3, minmax(0, 1fr))`.

- Each tab: 64 tall, `display:flex; flex-direction:column; align-items:center; justify-content:center; gap:4px`. Icon 24, label Archivo 700 12/16, stretch 112%, 0.08em tracking, uppercase.
- Labels and icons: "Teach" (mic icon), "Practice" (play icon), "Results" (bars icon: `<path d="M5 20V10M12 20V4M19 20v-7"/>`).
- Selected (`aria-current="page"`): icon and label `--ink`, plus a 24 × 3 `--ink` bar, radius 2, at the top edge of the tab, centered. Others: icon and label `--ink-2`, no bar.
- Links: Teach to `PhoneTeach.dc.html`, Practice to `PhonePractice.dc.html`, Results to `PhoneResults.dc.html`.
- In the real app, add `padding-bottom: env(safe-area-inset-bottom)` and keep the bar fixed. The mockups draw it in place.

### 11.3 Phone pad row

Two rows of 4 pads: row 1 is beats 1 and 2 (steps 1 to 4), row 2 is beats 3 and 4 (steps 5 to 8). Each row: two beat groups, `display:flex; gap:16px`, each group `display:flex; gap:8px; flex:1 1 0`, each column `flex:1 1 0; min-width:0`. At 358 wide a column is 81.5 wide. Row gap 16.

Column, top to bottom:

1. Count label, 14 tall: "1", "&", "2", "&" (row 1) and "3", "&", "4", "&" (row 2). Azeret 500 12/14, beat numbers `--ink`, "&" `--ink-2`, centered.
2. 4 gap, LED bar full column width × 4, radius 2 (unlit `--seam`, next up `--ink-2`, playhead or count-in `--ink`).
3. 6 gap, pad: full column width, 82 tall, radius 8. Same faces, borders and states as section 3, scaled:
   - Letter Archivo 800 40/40, stretch 125%, optically centered.
   - Step number Azeret 500 12 at (6, 4).
   - Center notches 8 × 5 (playhead top notch 10 × 6, filled `--ink`).
   - Residue border 3px (`--on` or `--off`). Missed: 2px dashed `--ink-2`. Rest: `--ground` face, 2px dashed `--line`, 6px dot.
   - Early and late letter shift: `12 + min(|offset| − 50, 80) / 20` px, so 12 to 16px. −64 ms shifts 13px left, +72 ms shifts 13px right.
   - Chevron 10 × 18 (stroke 3) in the bottom corner on the error side, 4px from the edges.
   - Wrong sound: 4px slash through the letter from bottom-left to top-right, plus a 22 × 22 heard-letter chip in the top-right corner, 3px in (face `--ground`, 2px `--ink` border, letter Archivo 800 13, stretch 125%, `--ink`).
4. 6 gap, verdict, 32 tall, two lines: line 1 Archivo 800 14/16, stretch 112%, uppercase, 0.02em ("ON" in `--on`, "EARLY" / "LATE" / "EXTRA" in `--off`, "MISS" in `--ink`). Line 2 Azeret 500 12/16 `--ink-2` ("−64 ms", "+72 ms", "no hit"). Alignment: early left, late right, others centered. The heard letter is shown only by the chip on the pad.
5. 4 gap, drift lane: full column width × 44, radius 4, 1px `--seam` frame. Scale 0.25 px per ms around the center. On-time band ±50 ms (25 wide, `--pad`), 2px `--line` center line. 4 rows of ticks 8 × 6, radius 1, row tops at y 4, 13, 22, 31, opacity 1.0, 0.9, 0.8, 0.7. Tick center x = `center + clamp(offset, −150, 150) × 0.25`. Missed: 14 × 2 `--ink-2` bar. Average caret: 8 × 6 `--ink` triangle at y 37 to 43, shown with 3 or more hits, no number on phone.

Column height with verdict and lane: 14 + 4 + 4 + 6 + 82 + 6 + 32 + 4 + 44 = 196. Idle (no verdict or lane): 110.

### 11.4 PhonePractice.dc.html (Practice, ready)

FIXED 390 × 844. Idle, before Start, all 24 samples taught. Pattern Boots & cats, 70 BPM, click on.

| Region | y | Contents |
|---|---|---|
| Header | 0 to 52 | 11.1, mic meter 2 of 12 lit |
| Headphones notice | 64 to 132 | Notice strip (4.13 style, padding 12 16): headphones icon 24, title "Headphones on, then press Start." (Archivo 600 15/20, `--ink`), body "Wired works best. Bluetooth adds delay." (`body-s`, `--ink-2`) |
| Pattern | 148 to 228 | Label "PATTERN" (`label`), 8 gap, three buttons in `repeat(3, minmax(0, 1fr))`, gap 8, 56 tall: "Pulse" / "B·B·B·B·", "Boots & cats" / "BtKtBtKt" (selected, `--ink` face), "Push" / "BtKtBBKt". Same styles as desktop 4.6. |
| Tempo and click | 244 to 364 | Label row: "TEMPO" left, "CLICK" right. Row (44 tall): minus 44 × 44 ("Slower"), value block 88 wide ("70" Azeret 700 28 + "BPM" Azeret 500 12 `--ink-2` on one baseline), plus 44 × 44 ("Faster"), then on the right the click toggle 96 × 44 (speaker icon, filled dot, "ON"). Below, slider full width, 44 tall hit area, thumb at 70. |
| Pads | 380 to 612 | 11.3, idle: no LEDs lit, all letters `--ink`, no verdicts, no lanes |
| Start | 640 to 696 | Primary button, full width, 56 tall: play icon + "START" (`button-l`). Links to `PhonePlaying.dc.html`. |
| Tab bar | 780 to 844 | 11.2, Practice selected |

### 11.5 PhonePlaying.dc.html (Practice, playing)

FIXED 390 × 844. Same moment as desktop Main (bar 23, playhead on step 8 just after its on-time hit). Same 8 pad states and the same lane data as 6.1.

| Region | y | Contents |
|---|---|---|
| Header | 0 to 52 | 11.1, mic meter 7 of 12 lit |
| Readouts | 64 to 124 | `display:grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap:8px`. Each cell: label (Archivo 600 12/16, stretch 112%, 0.1em, uppercase, `--ink-2`) above, value under it. "STREAK" "3" (Azeret 700 32/36) with "best 12" (Azeret 500 12 `--ink-2`) under it. "ON TIME" "58%", "SOUND" "71%", "BAR" "23", values Azeret 500 24/32 `--ink`. |
| Now playing | 136 to 180 | Left: "Boots & cats" (Archivo 700 16/20) and "70 BPM · Stop to change" (Azeret 500 12/16, `--ink-2`) stacked. Right: click toggle 96 × 44 (speaker, filled dot, "ON"). |
| Pads | 196 to 604 | 11.3 with verdicts and lanes. Step states exactly as the 6.1 table: 1 B on residue "ON", 2 t on residue "ON", 3 K early residue + wrong sound (chip "t") "EARLY" "−64 ms", 4 t missed "MISS" "no hit", 5 B late residue "LATE" "+72 ms", 6 t on residue "ON", 7 K on residue "ON", 8 t on-time flash + playhead (LED 8 lit `--ink`) "ON". Lane rows as in 6.1. |
| Stop | 632 to 688 | Full width, 56 tall, `--pad` face, 3px `--ink` border, stop icon + "STOP" (`button-l`, `--ink`). Links to `PhoneResults.dc.html`. |
| Hint | 704 to 724 | "Left of the line is early, right is late." (`body-s`, `--ink-2`, centered) |
| Tab bar | 780 to 844 | 11.2, Practice selected |

### 11.6 PhoneTeach.dc.html (Teach your sounds)

FIXED 390 × 844. Same moment as desktop Calibrate: Kick 8/8 done, Hi-hat 5/8 armed and listening, Snare 0/8. One sound is big at a time (the armed one); the others are compact rows.

| Region | y | Contents |
|---|---|---|
| Header | 0 to 52 | 11.1, mic meter 5 of 12 lit |
| Title | 64 to 112 | "Teach your sounds" (Archivo 800 24/32, stretch 112%) left, "13/24" (Azeret 500 16, `--ink`) right on the title baseline. Line under it: "Make each sound 8 times, with a short pause between." (`body-s`, `--ink-2`) |
| Mic strip | 124 to 164 | `--panel`, radius 12, padding 0 12, flex centered: mic icon 20, 8 gap, 20-segment meter (`flex:1`, gap 3, segments 16 tall, radius 2), 6 of 20 lit `--ink`, TRIGGER marker (2 × 28 `--ink-2` line) at 62% of the meter width. No caption under the marker on phone. |
| Active card | 176 to 476 | Hi-hat, armed: `--panel`, 3px `--ink` border, radius 12, padding 16. Top row: "HI-HAT" (`label`, `--ink-2`) left, 8px `--ink` dot + "Listening" (`body-s`, `--ink-2`) right. Letter "t" (Archivo 800 80/80, stretch 125%) centered. Caption "Say t, short and crisp." (`body-s`, `--ink-2`, centered). 8 slots 32 × 32, gap 8, centered: 5 filled `--ink`, slot 5 with the newest ring, 3 empty. Count "5/8" (Azeret 700 24) centered. Buttons row, gap 8: "Listening" (flex 1, 48 tall, `--pad` face, 3px `--ink` border, 8px dot + "LISTENING" `button`) and "Redo" (secondary, 112 × 48, redo icon). |
| Other sounds | 488 to 612 | Two rows, 58 tall each, gap 8. Row: `--panel`, radius 12, padding 0 8 0 16, flex centered, gap 12. Letter (Archivo 800 28, stretch 125%) 32 wide, then a column: name (Archivo 600 15/20, `--ink`) and status (Azeret 500 12/16, `--ink-2`), then on the right a 44-tall button. Kick: "B", "Kick", check icon 14 + "8/8 · Done", secondary "Redo" (redo icon). Snare: "K", "Snare", "0/8 · Not started", primary "Record" (mic icon). |
| Self-test | 624 to 668 | 2px dashed `--line` border, radius 8, padding 0 16, flex centered, gap 12: "TEST" (`label`, `--ink-2`) + "Unlocks at 24 of 24 samples. 11 to go." (`body-s`, `--ink`) |
| Done | 684 to 732 | Primary, full width, 48 tall, disabled look (0.45): "DONE" + arrow-right icon. Links to `PhonePractice.dc.html`. |
| Tab bar | 780 to 844 | 11.2, Teach selected |

### 11.7 PhoneResults.dc.html (Results)

FIXED 390 wide, the full scroll length (about 1500, set to the real content height). Same session numbers as 6.3. Order: title, next step, stats, timing, sound match, tab bar (drawn at the bottom of the mockup; fixed in the real app).

- Header 11.1, mic meter 1 of 12 lit.
- Title block, padding 24 16 0: "Results" (Archivo 800 28/36, stretch 112%), "Boots & cats · 70 BPM" (Azeret 500 14/20, `--ink-2`).
- Next step, 16 gap: `--panel`, radius 12, padding 20, column, gap 12: "NEXT STEP" (`label`, `--ink-2`), "Drop to 60 BPM and play Boots & cats until on time is above 70%." (Archivo 700 22/30, `--ink`), "You were on time for 58% of steps at 70 BPM. At 60 BPM each step lasts 500 ms instead of 429 ms." (`body-s`, `--ink-2`), then 8 gap, "Practice again" (primary, full width, 56, play icon, links to `PhonePractice.dc.html`) and "Re-teach a sound" (secondary, full width, 56, redo icon, links to `PhoneTeach.dc.html`).
- Stats, 24 gap: `repeat(3, minmax(0, 1fr))`, gap 8. "SESSION" "05:09" "min:sec", "BARS" "90" "8 steps each", "ON TIME" "58%" "419 of 720". Labels `label` at 12px, values Azeret 700 28/32, sublines Azeret 500 12/16 `--ink-2`.
- Timing panel, 24 gap: `--panel`, radius 12, padding 20. "TIMING BY SOUND", headline "You rush the snare (K) by 38 ms on average." (Archivo 700 18/24), caption "Each bar splits that sound's steps into early, on time, late and missed." (`body-s`, `--ink-2`). Three rows (B, t, K), each: letter (Archivo 800 28, 28 wide), 12 gap, bar (`flex:1`, 24 tall, segments and percents as 4.17, percent text only on segments 36px or wider), 12 gap, average (Azeret 500 14, 64 wide, right-aligned: "+6 ms", "−12 ms", "−38 ms"). Counts line under each bar (Azeret 500 12/16, `--ink-2`): "Early 27  On time 117  Late 30  Missed 6", "Early 86  On time 216  Late 40  Missed 18", "Early 74  On time 86  Late 11  Missed 9".
- Sound panel, 16 gap: same panel style. "SOUND MATCH", headline "72% of your hits were the right sound.", caption "Counts hits on pattern steps. Missed steps and extra hits are left out." Rows: letter (28 wide), column (name Archivo 600 15 + bar full width 12 tall, track `--pad`, fill `--ink`), value right (Azeret 700 20 "84%", with "146 of 174" Azeret 500 12 `--ink-2` under it). B "Kick" 84% "146 of 174", t "Hi-hat" 73% "250 of 342", K "Snare" 56% "96 of 171", then "Most often heard as t (58 times)." (`body-s`, `--ink`).
- 24 gap, then the tab bar 11.2, Results selected, as the last 64px of the mockup.

### 11.8 Phone prototype links

| From | Element | To |
|---|---|---|
| All phone screens | Tab bar Teach / Practice / Results | `PhoneTeach.dc.html` / `PhonePractice.dc.html` / `PhoneResults.dc.html` |
| PhonePractice | "START" | `PhonePlaying.dc.html` |
| PhonePlaying | "STOP" | `PhoneResults.dc.html` |
| PhoneResults | "Practice again" / "Re-teach a sound" | `PhonePractice.dc.html` / `PhoneTeach.dc.html` |
| PhoneTeach | "DONE" | `PhonePractice.dc.html` |

### 11.9 Phone implementation notes

- One responsive app: below 600px wide (`@media (max-width: 599px)`) switch to the phone layout: header without nav, fixed bottom tab bar, 4-pad rows, compact readouts, controls collapsed while playing.
- Keep the screen awake while playing: `navigator.wakeLock.request('screen')` on Start, released on Stop, inside try/catch.
- Create or resume the `AudioContext` inside the Start or Record tap handler (iOS Safari requires a user gesture). The mic needs HTTPS (or localhost).
- Phone browsers may ignore the `echoCancellation: false` constraints. Headphones matter even more on phone, because the speaker sits next to the mic.
- The latency knob `LATENCY_MS` stays the only tuning value. Phones usually need a larger value than laptops.
