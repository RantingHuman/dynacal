/** "Block" as a word, in any case: the owner never sees the internal term (or the verb, which reads the same). */
const BLOCK = /\bblocks?\b/i;

/** Attributes whose text the owner can see or hear. */
const SPOKEN_ATTRIBUTES = ["aria-label", "aria-description", "aria-valuetext", "title", "placeholder", "alt"];

/**
 * Every piece of visible text and accessible naming under `root` that says "Block". Empty when the screen speaks only
 * in Tasks and their times.
 */
export function blockWording(root: ParentNode = document.body): string[] {
  const found: string[] = [];
  const walker = document.createTreeWalker(root as Node, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node.nodeType === Node.TEXT_NODE) {
      if (node.parentElement?.closest("script, style")) continue;
      if (BLOCK.test(node.textContent ?? "")) found.push(node.textContent!.trim());
      continue;
    }
    const element = node as Element;
    for (const name of SPOKEN_ATTRIBUTES) {
      const value = element.getAttribute(name);
      if (value && BLOCK.test(value)) found.push(`${name}="${value}"`);
    }
  }
  return found;
}
