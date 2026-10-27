# 06: How do creating and editing a Task look?

Type: prototype
Status: resolved
Blocked by: 05

## Question

How do creating and editing a Task look and behave in "Editorial, refined"? The fields are title, notes, estimated duration, deadline, Earliest Start, Priority and "Don't split". Does the form open in the floating label, inline in the contents list, or somewhere else? And how does it stay quick for the common case: a title, a duration and a deadline?

## Context

From [Where does each existing home-screen control live?](05-home-controls.md): a new Task starts from "+ Task" on the Tasks heading line, and you edit a Task by clicking it in the list. The Task's details also hold its Declined Times (a count on the row, the list with Clear inside). The prototype's placeholder opens in the floating label; that's still for this ticket to decide.

## Answer

**Variant C, "sentence plus a full page."** The owner chose it over A (the form in the floating label) and B (the Task's row opening inline in the list).

**Adding a Task** is one line at the top of the Tasks list, under the Tasks heading ("+ Add a Task: 'Board memo 2h by fri'"). "+ Task" on the heading line focuses it. As you type, a preview line shows what was understood as chips: solid accent for what was picked out, dashed for defaults ("1h", "no deadline"). Enter adds the Task. Whatever isn't picked out becomes the title. The words it understands, all optional and in any order:

| Field | Words | Default |
|---|---|---|
| Estimated duration | `2h`, `90m`, `1h30`, `1.5 hours` | 1h |
| Deadline | `by` or `due` + `today` / `tomorrow` / a weekday (next occurrence, today included), optionally `at 16:00` | none |
| Earliest Start | `from` / `after` / `not before` + a day | none |
| Priority | `!low`, `!med`, `!high`, `!crit` | Medium |
| Don't split | `in one go`, `one block`, `don't split`, `no split` | off |

A hint under the empty field lists these, and a "Full form" link opens the full page pre-filled with what was typed. Notes and dates more than a week away are set there.

**Editing a Task** (click it in the list, or "Full form") opens a full page in place of the calendar column, with "Task" or "New Task" on the heading line and "← Back to the week". It shows:
- the title in large headline type, with a line below such as "2h 30m of 4h remaining · At Risk";
- every field, always visible, as a two-column list of labels and controls;
- Save / Cancel, plus Delete, which asks "Delete it? Delete / Keep" in place instead of a browser dialog.

The fields:
- **How long:** chips for 15m, 30m, 45m, 1h, 1h 30m, 2h, 3h and 4h, plus an "other" field in minutes.
- **Due and Earliest Start:** "No deadline" or "Any time", chips for Today, Tomorrow and the next weekdays, and a date picker for later dates. Once a day is set, an optional "at" time appears, with the hint "any time in Working Hours" when empty.
- **Priority:** four pills; High and Critical are filled with the accent colour.
- **Splitting:** a switch, "Don't split: one continuous Block".
- **Notes:** a serif text area.
- **Declined Times:** the Task's list, with Clear, also lives on this page (per [Where does each existing home-screen control live?](05-home-controls.md)).

On narrow widths, the labels stack above their controls.

The prototype is on the throwaway branch `prototype/design-styles` (commit 7634687), at route `/prototype-styles/task-editor`, variant `sentence` (`variants/task-editor.tsx`). Variants A and B are kept there for reference. The parser is a throwaway regex sketch, not a spec for edge cases.
