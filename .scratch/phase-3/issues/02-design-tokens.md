# 02: What are the design tokens?

Type: grilling
Status: resolved
Blocked by: none

## Question

What are the exact design tokens for "Editorial, refined" (see [Which visual style should dynacal adopt?](01-visual-style.md))?

- the palette for light and dark: paper, ink, soft, rules, the accent, and the tints for Blocks, Free Events, Conflicts and flags (At Risk, Overdue, Unscheduled);
- the type scale (headline, kicker, body, calendar item, meta) and where serif or sans is used;
- spacing, rules and radii;
- how fonts load for self-hosters. `next/font` bundles them at build time, so the browser never calls Google, but the Docker build needs network access to fetch them.

The prototype's values in `variants/editorial-plus.module.css` on `prototype/design-styles` are the starting point. They were tuned by eye and never checked for contrast.

## Answer

These tokens are for "Editorial, refined". They start from the prototype's values and fix every text colour that failed WCAG AA. The owner accepted every recommendation in the grilling.

### Colour

| Token | Light | Dark | Use |
|---|---|---|---|
| paper | `#f5f1ea` | `#151412` | page background |
| card | `#fbf8f3` | `#1c1a17` | Events, the details label, checkboxes |
| ink | `#1b1a18` | `#eee8de` | text and strong rules |
| soft | `#625d56` (was `#6f6a62`) | `#a59e92` (was `#9b9488`) | meta text and secondary labels |
| rule | `#d6cfc2` | `#38342d` | hairline rules |
| faint | `#e7e0d3` | `#24221e` | calendar grid lines and row dividers |
| accent | `#ad4527` (was `#c0502c`) | `#e57a55` | terracotta: emphasis, Blocks, Overdue and At Risk |
| on-accent | `#ffffff` | `#151412` (was white) | text on accent-filled buttons |
| highlight | accent at 22% | accent at 30% | hover sweeps behind links and text buttons |
| block | accent at 14% over card | accent at 20% over card | Block fill |

With these values every text pair passes AA (4.5:1 or better). Measured: soft on a Block, 5.0 in light and 4.8 in dark; accent on paper, 5.1; on-accent on accent, 5.7 in light and 6.4 in dark. Rules and grid lines are decoration and aren't held to a contrast ratio.

- **Flags share the accent.** At Risk and Overdue use the accent; Unscheduled uses soft, because it's a fact about room rather than a warning. The flag's word always appears, so nothing relies on colour alone.
- **Blocks and Events:**
  - Blocks have a block fill with a solid accent left edge.
  - Events from Busy Calendars are card with a thin ink edge.
  - dynacal Events have a double edge.
  - Free Events are dashed and soft.
  - Conflicts get diagonal accent hatching.
  - Past items fade to 45% opacity.
- **Dark mode** follows the system setting only. There's no manual choice in Settings, since that would be a new feature.

### Type

- **Instrument Serif** for everything read as content: the headline, Task titles, Block and Event titles, day numbers and the details label title.
- **Instrument Sans** for everything acted on or scanned: meta lines, buttons, form fields, kickers and hour labels.
- **Sizes** (from the prototype): headline `clamp(44px, 6.5vw, 84px)`, day numbers 40px, label title 34px, Task title 20px, Block and Event title 15px, body 15px, kicker 12px in spaced capitals, meta 12.5px.
- **The smallest text is 12px**, except the calendar's hour labels at 11px.
- **Fonts load through `next/font/google`.** They're fetched while the image builds and served by dynacal itself, so a browser never contacts Google. The build already needs internet access for `pnpm install`.

### Space and shape

- **Spacing scale:** 4, 8, 12, 16, 24, 32 and 40px.
- **Corners:** square on panels, Blocks and the details label; pills on buttons, toggles and chips; circles on checkboxes.
- **Rules:** 1px hairlines inside content. 3px only for the masthead's top rule.
- **Focus:** a 2px accent outline with a 2px gap on buttons, links, checkboxes and Blocks, shown on keyboard focus only (`:focus-visible`).

### Motion

- **Curves:** `expo` is `cubic-bezier(0.16, 1, 0.3, 1)`, for sweeps and fades. `bounce` is `cubic-bezier(0.3, 1.8, 0.5, 1)`, an overshoot for presses and landings.
- **Durations:** fast 120ms, base 350ms, slow 600ms.
- Which interaction uses which curve and duration is for [Which interactions get motion, and what does each do?](07-interactions.md).
