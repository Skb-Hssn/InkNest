import { useEffect, useRef } from "react";
import { ListTree } from "lucide-react";
import type { Node } from "@milkdown/kit/prose/model";

export type NoteHeading = { position: number; level: number; text: string };
export function collectNoteHeadings(doc: Node) {
  const headings: NoteHeading[] = [];
  doc.descendants((node, position) => {
    if (node.type.name === "heading") headings.push({ position, level: node.attrs.level, text: node.textContent || "Empty heading" });
  });
  return headings;
}
export function HeadingMinimap({ headings, activePosition, onNavigate }: {
  headings: NoteHeading[];
  activePosition: number | null;
  onNavigate: (heading: NoteHeading) => void;
}) {
  const navRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const nav = navRef.current;
    const active = nav?.querySelector<HTMLElement>('[aria-current="location"]');
    if (!nav || !active) return;
    const top = active.getBoundingClientRect().top - nav.getBoundingClientRect().top;
    const bottom = top + active.getBoundingClientRect().height;
    if (top < 0) nav.scrollTop += top;
    else if (bottom > nav.clientHeight) nav.scrollTop += bottom - nav.clientHeight;
  }, [activePosition, headings]);
  return (
    <aside className="note-heading-minimap" aria-label="Heading minimap">
      <div className="note-outline-title"><ListTree size={15} /><span>Outline</span><span className="note-outline-count">{headings.length}</span></div>
      <nav ref={navRef} className="note-outline-scroll" aria-label="Note headings">
        {headings.length ? headings.map((heading) => (
          <button key={heading.position} type="button" className="note-outline-heading" title={heading.text}
            data-level={heading.level} aria-current={heading.position === activePosition ? "location" : undefined}
            style={{ paddingLeft: `${10 + (heading.level - 1) * 12}px` }} onClick={() => onNavigate(heading)}>
            <span className="note-outline-level">H{heading.level}</span><span>{heading.text}</span>
          </button>
        )) : <p className="note-outline-empty">Add headings to navigate your note.</p>}
      </nav>
    </aside>
  );
}
