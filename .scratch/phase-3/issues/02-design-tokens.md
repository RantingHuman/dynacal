# 02: What are the design tokens?

Type: grilling
Status: open
Blocked by: none

## Question

What are the exact design tokens for "Editorial, refined" (see [Which visual style should dynacal adopt?](01-visual-style.md))?

- the palette for light and dark: paper, ink, soft, rules, the accent, and the tints for Blocks, Free Events, Conflicts and flags (At Risk, Overdue, Unscheduled);
- the type scale (headline, kicker, body, calendar item, meta) and where serif or sans is used;
- spacing, rules and radii;
- how fonts load for self-hosters. `next/font` bundles them at build time, so the browser never calls Google, but the Docker build needs network access to fetch them.

The prototype's values in `variants/editorial-plus.module.css` on `prototype/design-styles` are the starting point. They were tuned by eye and never checked for contrast.
