# 04: Review box coverage

**What to build:** Exercise the review box as a user records what happened in past Blocks.

**Blocked by:** None (can start immediately).

**Status:** resolved

- [x] Done, Partly with minutes, and Not done are covered.
- [x] Paging and the final All caught up state are covered.
- [x] Offline review controls and relevant refusal feedback are covered.

## Comments

Clearing the Partly minutes field exposed a React warning for NaN; the field now renders empty correctly and prevents submitting an empty value.
