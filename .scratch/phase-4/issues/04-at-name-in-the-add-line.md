# 04: "@name" in the add line

**What to build:** Typing "@deep" in the add line puts the new Task in the Context whose name starts with "deep", so the owner can choose a Context without opening the editor. An exact name (ignoring case) wins over a prefix; "@" with no match, or matching more than one Context, stays in the title and the Task goes to the Default Context, so the owner can see it didn't pick one. See the spec's stories 19–20.

**Blocked by:** 03

**Status:** resolved

- [ ] "Write essay 1h @deep" with a "Deep work" Context gives a Task titled "Write essay", 1h, in Deep work (add-line reader test).
- [ ] With "Deep" and "Deep work", "@deep" picks "Deep"; with only "Deep work" and "Design", "@de" stays in the title (reader test).
- [ ] "@nothing" stays in the title and the Task joins the Default Context (reader test).
- [ ] "@" works in any position in the line, alongside duration, "by", "!priority" and "split" (reader test).
- [ ] A phone-width browser test adds a Context, adds "Write essay 1h @deep", and sees it placed in that Context's window with its tag.
