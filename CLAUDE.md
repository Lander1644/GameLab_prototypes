# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A collection of small browser games for science/programming fairs ("ferias"). Hard constraints
that shape every design decision:

- **No build step, no bundler, no dependencies, no internet.** Everything is plain
  HTML + CSS + JS loaded with `<script>` tags. Games must work by double-clicking a file
  (`file://` protocol), because fair Wi‑Fi is unreliable.
- **The whole codebase is in Spanish** — identifiers, comments, UI strings, commit messages.
  Match it: name new things in Spanish and keep comments in Spanish.

## Commands

There is no build or lint. Tests are plain Node scripts (no framework) that exit non‑zero on
failure. Run them from the repo root:

```
node tools/test-reactor.js            # reactor physics stays winnable
node tools/test-robot2.js             # robot2 levels: reference solution wins, stars, rules
node tools/test-robot2.js --deep      # also brute-forces shorter solutions up to 6 blocks (slow)
node tools/test-robot_py.js           # robot_py world rules + each level's reference solution
```

To "run" a game, open its `index.html` in a browser (or the root `index.html` for the menu).
There is no dev server. `index.html?rapido` shortens all timers in the quiz for quick testing.

## Core architecture pattern: logic split from rendering

Every game separates its **DOM-free logic/simulation module** from its **rendering + input
module (`game.js`)**. This is what makes the logic testable under Node without a browser.

The logic modules use a UMD-style wrapper so the same file loads in both environments:

```js
(function (root) {
  'use strict';
  /* ... pure logic, no document/window access ... */
  const api = { /* ... */ };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;  // Node (tests)
  else root.XName = api;                                                      // browser (global)
})(typeof window !== 'undefined' ? window : globalThis);
```

When editing a logic module, keep it DOM-free and keep both exports working, or the tests break.

| Game folder | Logic (DOM-free, tested) | Rendering/input | Notes |
|---|---|---|---|
| `reactor/` | `sim.js` (`ReactorSim`) | `game.js`, `commands.js` | Reactor stabilization sim |
| `robot2/` | `logic.js` (`Robot2Logic`), `levels.js` | `game.js` | Scratch-style drag-and-drop blocks |
| `robot_py/` | `sim.js`, `levels.js` | `game.js`, `runner.js` | Program the robot in **Python**; **WIP** |
| `quizz_QA/` | see below (`js/` modules) | — | Two-player buzzer quiz; has its own README |

`shared/style.css` holds common theme variables (`--accent`, `--panel`, `--line`, `--muted`,
etc.). New games should link it and add a card to the root `index.html` menu.

### reactor
Tuning lives in `DIFFICULTIES` at the top of `sim.js` (`facil`/`normal`/`dificil`). The sim is a
deliberately simplified, time-compressed model (rods, pump, power, temperature, xenon). After
changing parameters, run `node tools/test-reactor.js` to confirm it's still winnable.

### robot2 (blocks)
Programs are trees of nodes (`F`/`L`/`R`/`X`, `FOR`, `WHILE`). Maps use `#` steel wall
(unbreakable), `X` breakable rock, `R` robot, `G` goal, `B` battery. **Star rating is based on
block count vs. the level's reference `solution`** (`starsFor`): 3★ = ≤ par, 2★ = ≤ 1.5× par,
1★ = more. Therefore a level's `solution` must be the *natural* algorithm for that level, not the
shortest possible trick — it defines the "par." Each level also declares `allow` (which block
types are available), plus optional `alts` (natural alternatives, must still win with ≥2★) and
`tricks` (shortcuts, must win with 3★). `test-robot2.js` validates all of this; `--deep` warns
(informationally) if a shorter solution than par exists.

### robot_py (Python robot) — in progress
Same "execute fully, then animate the trace" model as robot2, but **flow control (for/while/if)
comes from real Python code**, not blocks. `sim.js` exposes only imperative primitives +
sensors. The missing piece is the interpreter bridge: **`runner.js` is currently a stub.**
`robot_py/INTERPRETE_PROMPT.md` is the spec for finishing it — vendor Skulpt into
`robot_py/lib/` (currently only a README there) and implement
`window.RobotPy.run(source, api, hooks) -> Promise` against the contract `game.js` expects.
Do **not** change `sim.js`/`levels.js`/`game.js` (contract is fixed), and do **not** add its
menu card until the interpreter works (avoids a broken link at the fair).

### quizz_QA
Modular, with scripts loaded in a fixed order from its `index.html` (`config → utils → bank →
state → screens → players → questions → timers → buzzers → answers → game → script`). All state
lives in the global `Quiz.Estado` (`state.js`). `game.js` is the only module that decides flow;
`buzzers.js`/`answers.js` report events back to it via callbacks rather than deciding themselves.
Questions are pure data in `js/bank.js` (each has `respuesta` = exact correct option text; option
order is shuffled at runtime). See `quizz_QA/README.md` for details.

## Repo notes

- `.gitattributes` sets `* text=auto` to normalize line endings (Windows/Mac/Linux) so git
  doesn't flag spurious whitespace-only changes.
- The old `robot/` game was replaced by `robot2/`; the menu links `reactor/`, `robot2/`, and
  `quizz_QA/`.
