"use client";

import * as React from "react";
import { Node, mergeAttributes } from "@tiptap/core";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    resizableImage: {
      setImage: (attrs: {
        src: string;
        alt?: string;
        title?: string;
      }) => ReturnType;
    };
  }
}
import { ReactNodeViewRenderer, NodeViewWrapper } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import { Move } from "lucide-react";

// ── Aspect ratio options ───────────────────────────────────────────────────────

const AR_OPTIONS = [
  { label: "Free", value: null },
  { label: "1∶1", value: 1 },
  { label: "4∶3", value: 4 / 3 },
  { label: "3∶2", value: 3 / 2 },
  { label: "16∶9", value: 16 / 9 },
  { label: "3∶4", value: 3 / 4 },
] as const;

const MIN_WIDTH = 80;
const MAX_WIDTH_FRACTION = 0.98;

// ── Node View ─────────────────────────────────────────────────────────────────

function ResizableImageView({
  node,
  updateAttributes,
  selected,
}: NodeViewProps) {
  const { src, alt, width, aspectRatio, focalX, focalY } = node.attrs as {
    src: string;
    alt?: string;
    width: number | null;
    aspectRatio: number | null;
    focalX: number;
    focalY: number;
  };

  const containerRef = React.useRef<HTMLDivElement>(null);
  const [repositioning, setRepositioning] = React.useState(false);

  // ── Resize drag ─────────────────────────────────────────────────────────────

  const handleResizeDrag = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = width ?? containerRef.current?.offsetWidth ?? 300;

    const onMove = (mv: MouseEvent) => {
      const editor = containerRef.current?.closest(".ProseMirror");
      const maxW = editor
        ? editor.clientWidth * MAX_WIDTH_FRACTION
        : window.innerWidth * MAX_WIDTH_FRACTION;
      const newWidth = Math.min(
        maxW,
        Math.max(MIN_WIDTH, startWidth + mv.clientX - startX),
      );
      updateAttributes({ width: Math.round(newWidth) });
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  // ── Focal-point drag ────────────────────────────────────────────────────────

  const setFocalFromEvent = (clientX: number, clientY: number) => {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const x = Math.round(
      Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100)),
    );
    const y = Math.round(
      Math.min(100, Math.max(0, ((clientY - rect.top) / rect.height) * 100)),
    );
    updateAttributes({ focalX: x, focalY: y });
  };

  const handleFocalDrag = (e: React.MouseEvent) => {
    if (!repositioning) return;
    e.preventDefault();
    setFocalFromEvent(e.clientX, e.clientY);

    const onMove = (mv: MouseEvent) =>
      setFocalFromEvent(mv.clientX, mv.clientY);
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  // ── Derived values ──────────────────────────────────────────────────────────

  const height =
    aspectRatio && width ? Math.round(width / aspectRatio) : undefined;
  const isCropped = !!aspectRatio;

  return (
    <NodeViewWrapper
      className="relative block my-2 group/img"
      style={{ width: width ? `${width}px` : "100%", maxWidth: "100%" }}
      data-drag-handle={repositioning ? undefined : ""}
    >
      {/* Image container / frame */}
      <div
        ref={containerRef}
        className={`relative leading-[0] rounded ${isCropped ? "overflow-hidden" : ""}`}
        style={{
          height: height ? `${height}px` : undefined,
          cursor: repositioning ? "move" : undefined,
        }}
        onMouseDown={repositioning ? handleFocalDrag : undefined}
      >
        <img
          src={src}
          alt={alt ?? ""}
          draggable={false}
          style={
            isCropped
              ? {
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  margin: 0,
                  objectFit: "cover",
                  objectPosition: `${focalX}% ${focalY}%`,
                  userSelect: "none",
                  pointerEvents: "none",
                }
              : {
                  display: "block",
                  width: "100%",
                  height: "auto",
                  margin: 0,
                  userSelect: "none",
                  pointerEvents: "none",
                }
          }
        />

        {/* Selection ring */}
        {selected && !repositioning && (
          <div className="absolute inset-0 ring-2 ring-primary ring-inset rounded pointer-events-none" />
        )}

        {/* Reposition overlay */}
        {repositioning && (
          <div className="absolute inset-0 ring-2 ring-amber-400 ring-inset rounded pointer-events-none">
            {/* Crosshair at focal point */}
            <div
              className="absolute w-4 h-4 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
              style={{ left: `${focalX}%`, top: `${focalY}%` }}
            >
              <div className="absolute top-1/2 left-0 right-0 h-px bg-amber-400" />
              <div className="absolute left-1/2 top-0 bottom-0 w-px bg-amber-400" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full border-2 border-amber-400 bg-black/30" />
            </div>
          </div>
        )}
      </div>

      {/* Right-edge resize handle */}
      {!repositioning && (
        <div
          onMouseDown={handleResizeDrag}
          className="absolute top-1/2 -translate-y-1/2 -right-1.5 w-3 h-12 rounded-full bg-primary/80 cursor-ew-resize opacity-0 group-hover/img:opacity-100 transition-opacity shadow-md"
          title="Drag to resize"
        />
      )}

      {/* Toolbar */}
      {selected && (
        <div className="absolute -top-9 left-0 flex items-center gap-0.5 bg-popover border rounded-md shadow-lg px-1 py-0.5 z-10">
          {/* AR buttons */}
          <span className="text-[10px] text-muted-foreground pr-1 border-r mr-1">
            AR
          </span>
          {AR_OPTIONS.map((opt) => (
            <button
              key={opt.label}
              onMouseDown={(e) => {
                e.preventDefault();
                updateAttributes({ aspectRatio: opt.value ?? null });
                if (!opt.value) setRepositioning(false);
              }}
              className={`px-1.5 py-0.5 text-[10px] rounded transition-colors ${
                aspectRatio === (opt.value ?? null)
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-accent text-foreground"
              }`}
            >
              {opt.label}
            </button>
          ))}

          {/* Reposition toggle — always available */}
          <>
            <span className="w-px h-3 bg-border mx-1" />
            <button
              onMouseDown={(e) => {
                e.preventDefault();
                setRepositioning((v) => !v);
              }}
              title={
                repositioning
                  ? "Done"
                  : "Set focal point — determines which area stays visible when cropped on cards"
              }
              className={`flex items-center gap-1 px-1.5 py-0.5 text-[10px] rounded transition-colors ${
                repositioning
                  ? "bg-amber-400 text-black"
                  : "hover:bg-accent text-foreground"
              }`}
            >
              <Move className="w-2.5 h-2.5" />
              {repositioning ? "Done" : "Focus"}
            </button>
          </>

          {width && (
            <span className="text-[10px] text-muted-foreground pl-1 border-l ml-1">
              {width}px
            </span>
          )}
        </div>
      )}

      {/* Exit reposition on click-outside (deselect) */}
      {repositioning &&
        !selected &&
        (() => {
          setRepositioning(false);
          return null;
        })()}
    </NodeViewWrapper>
  );
}

// ── Tiptap Extension ──────────────────────────────────────────────────────────

export const ResizableImage = Node.create({
  name: "image",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      src: { default: null },
      alt: { default: null },
      title: { default: null },
      width: { default: null },
      aspectRatio: { default: null },
      focalX: { default: 50 },
      focalY: { default: 50 },
    };
  },

  parseHTML() {
    return [{ tag: "img[src]" }];
  },

  renderHTML({ HTMLAttributes }) {
    const { width, aspectRatio, focalX, focalY, ...rest } = HTMLAttributes as {
      width?: number | null;
      aspectRatio?: number | null;
      focalX?: number;
      focalY?: number;
      [key: string]: unknown;
    };
    const fx = focalX ?? 50;
    const fy = focalY ?? 50;
    const style = [
      width ? `width:${width}px` : null,
      width && aspectRatio
        ? `height:${Math.round(width / aspectRatio)}px`
        : null,
      aspectRatio ? "object-fit:cover" : null,
      aspectRatio ? `object-position:${fx}% ${fy}%` : null,
    ]
      .filter(Boolean)
      .join(";");
    return ["img", mergeAttributes(rest, style ? { style } : {})];
  },

  addCommands() {
    return {
      setImage:
        (attrs: { src: string; alt?: string; title?: string }) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs }),
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(ResizableImageView);
  },
});
