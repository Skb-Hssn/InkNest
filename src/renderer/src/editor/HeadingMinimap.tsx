import { useEffect, useRef, useState, type CSSProperties, type PointerEvent, type KeyboardEvent } from "react";
import { GripVertical, Grip, ListTree, X } from "lucide-react";
import type { Node } from "@milkdown/kit/prose/model";

export type NoteHeading = { position: number; level: number; text: string };
export function collectNoteHeadings(doc: Node) {
  const headings: NoteHeading[] = [];
  doc.descendants((node, position) => {
    if (node.type.name === "heading") headings.push({ position, level: node.attrs.level, text: node.textContent || "Empty heading" });
  });
  return headings;
}
export function HeadingMinimap({ headings, activePosition, onNavigate, visible, preferredWidth, onWidthChange, onClose }: {
  headings: NoteHeading[];
  activePosition: number | null;
  onNavigate: (heading: NoteHeading) => void;
  visible: boolean;
  preferredWidth: number;
  onWidthChange: (width: number) => void;
  onClose: () => void;
}) {
  const hasDocumentTitle = headings[0]?.level === 1 && headings[0]?.position === 0 && headings.length > 1 && headings.slice(1).every((heading) => heading.level > 1);
  const navHeadings = hasDocumentTitle ? headings.slice(1) : headings;
  const firstLevel = Math.min(...navHeadings.map((heading) => heading.level), 6);
  const currentPosition = hasDocumentTitle && activePosition === headings[0]?.position ? navHeadings[0]?.position : activePosition;
  const navRef = useRef<HTMLElement | null>(null);
  const slotRef = useRef<HTMLDivElement | null>(null);
  const resizeRef = useRef<{ pointerId: number; startX: number; startWidth: number; width: number; startY: number; startHeight: number; previousHeight: number | null; corner: boolean } | null>(null);
  const [height, setHeight] = useState<number | null>(null);
  const [width, setWidth] = useState(preferredWidth);
  const [maxWidth, setMaxWidth] = useState(420);
  const [resizing, setResizing] = useState(false);
  const effectiveWidth = Math.min(width, maxWidth);
  const clampWidth = (value: number) => Math.round(Math.min(maxWidth, Math.max(180, value)));

  useEffect(() => {
    if (!resizeRef.current) setWidth(preferredWidth);
  }, [preferredWidth]);

  useEffect(() => {
    const workspace = slotRef.current?.parentElement;
    if (!workspace) return;
    const update = () => setMaxWidth(Math.min(420, Math.max(180, workspace.clientWidth - 332)));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(workspace);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!visible && resizeRef.current) {
      setWidth(resizeRef.current.startWidth);
      if (resizeRef.current.corner) setHeight(resizeRef.current.previousHeight);
      resizeRef.current = null;
      setResizing(false);
    }
  }, [visible]);

  function startResize(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.focus({ preventScroll: true });
    event.currentTarget.setPointerCapture(event.pointerId);
    resizeRef.current = { pointerId: event.pointerId, startX: event.clientX, startWidth: effectiveWidth, width: effectiveWidth, startY: event.clientY, previousHeight: height, startHeight: navRef.current?.parentElement?.getBoundingClientRect().height ?? 200, corner: event.currentTarget.classList.contains("note-outline-corner") };
    setResizing(true);
  }
  function moveResize(event: PointerEvent<HTMLDivElement>) {
    const resize = resizeRef.current;
    if (!resize || resize.pointerId !== event.pointerId) return;
    resize.width = clampWidth(resize.startWidth + (resize.corner ? event.clientX - resize.startX : resize.startX - event.clientX));
    if (resize.corner) setHeight(Math.min((slotRef.current?.parentElement?.clientHeight ?? 550) - 32, Math.max(120, resize.startHeight + event.clientY - resize.startY)));
    setWidth(resize.width);
  }
  function finishResize(event: PointerEvent<HTMLDivElement>) {
    const resize = resizeRef.current;
    if (!resize || resize.pointerId !== event.pointerId) return;
    resizeRef.current = null;
    setResizing(false);
    event.currentTarget.releasePointerCapture(event.pointerId);
    if (resize.width !== resize.startWidth) onWidthChange(resize.width);
  }
  function cancelResize() {
    if (!resizeRef.current) return;
    setWidth(resizeRef.current.startWidth);
    if (resizeRef.current.corner) setHeight(resizeRef.current.previousHeight);
    resizeRef.current = null;
    setResizing(false);
  }
  function resizeByKeyboard(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape" && resizeRef.current) {
      event.preventDefault();
      cancelResize();
      return;
    }
    if (event.altKey || event.ctrlKey || event.metaKey || resizeRef.current) return;
    const step = event.shiftKey ? 40 : 16;
    const corner = event.currentTarget.classList.contains("note-outline-corner");
    if (corner && ["ArrowUp", "ArrowDown"].includes(event.key)) {
      event.preventDefault();
      const current = height ?? navRef.current?.parentElement?.getBoundingClientRect().height ?? 200;
      setHeight(Math.min((slotRef.current?.parentElement?.clientHeight ?? 550) - 32, Math.max(120, current + (event.key === "ArrowDown" ? step : -step))));
      return;
    }
    const next = event.key === "ArrowLeft" ? effectiveWidth + (corner ? -step : step) : event.key === "ArrowRight" ? effectiveWidth + (corner ? step : -step)
      : event.key === "Home" ? 180 : event.key === "End" ? maxWidth : null;
    if (next === null) return;
    event.preventDefault();
    const value = clampWidth(next);
    setWidth(value);
    if (value !== effectiveWidth) onWidthChange(value);
  }

  useEffect(() => {
    const nav = navRef.current;
    const active = nav?.querySelector<HTMLElement>('[aria-current="location"]');
    if (!visible || !nav || !active) return;
    const top = active.getBoundingClientRect().top - nav.getBoundingClientRect().top;
    const bottom = top + active.getBoundingClientRect().height;
    if (top < 0) nav.scrollTop += top;
    else if (bottom > nav.clientHeight) nav.scrollTop += bottom - nav.clientHeight;
  }, [activePosition, headings, visible]);
  return (
    <div ref={slotRef} className="note-outline-slot" data-open={visible} data-resizing={resizing}
      aria-hidden={!visible} inert={!visible} style={{ "--note-outline-width": `${effectiveWidth}px` } as CSSProperties}>
    <aside className="note-heading-minimap" aria-label="Heading minimap" style={height ? { height } : undefined}>
      <div className="note-outline-resize" role="separator" aria-label="Resize heading minimap" aria-orientation="vertical"
        aria-valuemin={180} aria-valuemax={maxWidth} aria-valuenow={effectiveWidth} aria-valuetext={`${effectiveWidth} pixels`}
        tabIndex={visible ? 0 : -1} title="Drag the left edge to resize. Double-click to reset."
        onPointerDown={startResize} onPointerMove={moveResize} onPointerUp={finishResize}
        onPointerCancel={cancelResize} onLostPointerCapture={cancelResize} onKeyDown={resizeByKeyboard}
        onDoubleClick={() => { const value = clampWidth(232); setWidth(value); onWidthChange(value); }}>
        <span className="note-outline-resize-grip" aria-hidden="true"><GripVertical size={12} /></span>
      </div>
      <div className="note-outline-title"><ListTree size={15} /><span>On this page</span><span className="note-outline-count">{headings.length}</span>
        <button type="button" className="note-outline-close" aria-label="Close heading minimap" title="Hide outline" onClick={onClose}><X size={14} /></button>
      </div>
      <nav ref={navRef} className="note-outline-scroll" aria-label="Note headings">
        {navHeadings.length ? navHeadings.map((heading) => (
          <button key={heading.position} type="button" className="note-outline-heading" title={heading.text}
            data-level={heading.level} aria-current={heading.position === currentPosition ? "location" : undefined}
            style={{ paddingLeft: `${10 + (heading.level - firstLevel) * 12}px` }} onClick={() => onNavigate(heading)}>
            <span className="note-outline-level">H{heading.level}</span><span>{heading.text}</span>
          </button>
        )) : <p className="note-outline-empty">Add headings to navigate your note.</p>}
      </nav>
      <div className="note-outline-corner" role="separator" aria-label="Resize heading panel" tabIndex={visible ? 0 : -1}
        aria-valuemin={180} aria-valuemax={maxWidth} aria-valuenow={effectiveWidth} title="Drag to resize the panel"
        onPointerDown={startResize} onPointerMove={moveResize} onPointerUp={finishResize}
        onPointerCancel={cancelResize} onLostPointerCapture={cancelResize} onKeyDown={resizeByKeyboard}><Grip size={13} /></div>
    </aside>
    </div>
  );
}
