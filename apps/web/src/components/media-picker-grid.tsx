import * as React from "react";
import { Check, UploadCloud } from "lucide-react";
import { cn } from "@/lib/utils";
import { getMediaAttachmentUrl } from "@/lib/media-url";

// ---------------------------------------------------------------------------
// SVG sanitization and color normalization
// ---------------------------------------------------------------------------

/**
 * Strip unsafe content from fetched SVG text and replace all hardcoded
 * fill/stroke colors with `currentColor` so the SVG inherits the CSS `color`
 * of its parent container. `fill="none"` and `stroke="none"` are preserved so
 * hollow/open shapes continue to render correctly.
 */
function sanitizeAndAdaptSvg(svgText: string): string {
  // Security: remove script elements
  let result = svgText.replace(
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    "",
  );
  // Security: remove event-handler attributes (onclick, onload, etc.)
  result = result.replace(
    /\s+on[a-zA-Z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/g,
    "",
  );
  // Color adaptation: replace explicit fill values that are not "none"
  result = result.replace(/\bfill="(?!none\b)([^"]*)"/g, 'fill="currentColor"');
  // Color adaptation: replace explicit stroke values that are not "none"
  result = result.replace(
    /\bstroke="(?!none\b)([^"]*)"/g,
    'stroke="currentColor"',
  );
  // Color adaptation: replace fill inside inline style attributes
  result = result.replace(/\bfill:\s*(?!none\b)[^;}"']+/g, "fill:currentColor");
  // Color adaptation: replace stroke inside inline style attributes
  result = result.replace(
    /\bstroke:\s*(?!none\b)[^;}"']+/g,
    "stroke:currentColor",
  );
  return result;
}

// ---------------------------------------------------------------------------
// InlineSvg component
// ---------------------------------------------------------------------------

interface InlineSvgProps {
  /** Full URL to the SVG resource */
  url: string;
  /** Accessible label (mirrors the `alt` attribute on <img>) */
  label?: string;
  className?: string;
}

/**
 * Fetches an SVG, sanitizes it for safety, rewrites fill/stroke colors to
 * `currentColor`, and renders it inline in the DOM.  Because the SVG is part
 * of the document tree it inherits the CSS `color` property of its container,
 * so dark-mode theming works without any `invert` hacks.
 */
export function InlineSvg({ url, label, className }: InlineSvgProps) {
  const [svgHtml, setSvgHtml] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    fetch(url)
      .then((res) => res.text())
      .then((text) => {
        if (!cancelled) {
          setSvgHtml(sanitizeAndAdaptSvg(text));
        }
      })
      .catch(() => {
        // Silently fail — the placeholder div stays visible
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  if (!svgHtml) {
    // Placeholder while loading (same dimensions as the SVG will occupy)
    return (
      <div
        className={cn("bg-muted/30 animate-pulse rounded", className)}
        aria-label={label}
      />
    );
  }

  return (
    // eslint-disable-next-line react/no-danger
    <div
      className={cn("[&_svg]:w-full [&_svg]:h-full", className)}
      aria-label={label}
      dangerouslySetInnerHTML={{ __html: svgHtml }}
    />
  );
}

export interface MediaPickerItem {
  id: string;
  filename: string | null;
  mimeType: string | null;
}

export interface MediaPickerGridProps {
  /** All candidate items (already pre-filtered by mime type if needed) */
  items: MediaPickerItem[];
  selectedId: string | null;
  /** Called with the item id to select, or null to deselect (when toggleable) */
  onSelect: (id: string | null) => void;
  /** Opens the OS file picker. When omitted the upload button is hidden. */
  onUploadClick?: () => void;
  isLoading?: boolean;
  isUploading?: boolean;
  /** Allow clicking the selected item to deselect it */
  toggleable?: boolean;
  /** Number of columns in the grid (default 4) */
  columns?: 3 | 4 | 5 | 6;
  /** Thumbnail aspect ratio (default "square") */
  aspect?: "square" | "wide";
  /** CSS object-fit for the thumbnail image (default "cover") */
  objectFit?: "cover" | "contain";
  /**
   * @deprecated SVGs are now inlined and automatically honor currentColor.
   * This prop is ignored and kept only for backward compatibility.
   */
  invertOnDark?: boolean;
  /** Show truncated filename label beneath each thumbnail */
  showLabels?: boolean;
  filterPlaceholder?: string;
  uploadLabel?: string;
  emptyUploadLabel?: string;
  loadingLabel?: string;
  /** data-testid prefix for individual option buttons */
  testIdPrefix?: string;
}

const COLS_CLASS: Record<number, string> = {
  3: "grid-cols-3",
  4: "grid-cols-4",
  5: "grid-cols-5",
  6: "grid-cols-6",
};

export function MediaPickerGrid({
  items,
  selectedId,
  onSelect,
  onUploadClick,
  isLoading = false,
  isUploading = false,
  toggleable = false,
  columns = 4,
  aspect = "square",
  objectFit = "cover",
  invertOnDark = false,
  showLabels = false,
  filterPlaceholder = "Filter…",
  uploadLabel = "Upload",
  emptyUploadLabel = "Upload image",
  loadingLabel = "Loading…",
  testIdPrefix = "media-picker",
}: MediaPickerGridProps) {
  const [filter, setFilter] = React.useState("");

  const filtered = React.useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) =>
      (item.filename ?? "").toLowerCase().includes(q),
    );
  }, [items, filter]);

  if (isLoading) {
    return <p className="text-xs text-muted-foreground">{loadingLabel}</p>;
  }

  if (items.length === 0) {
    if (!onUploadClick) return null;
    return (
      <button
        type="button"
        onClick={onUploadClick}
        disabled={isUploading}
        className="w-full flex flex-col items-center justify-center gap-2 py-8 border border-dashed rounded-md text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        data-testid={`${testIdPrefix}-upload-empty`}
      >
        <UploadCloud className="w-6 h-6" />
        <span className="text-xs">{isUploading ? "…" : emptyUploadLabel}</span>
      </button>
    );
  }

  const aspectClass = aspect === "wide" ? "aspect-[3/1]" : "aspect-square";
  const fitClass = objectFit === "contain" ? "object-contain" : "object-cover";
  const colClass = COLS_CLASS[columns] ?? "grid-cols-4";

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder={filterPlaceholder}
          className="flex-1 px-2 py-1 text-xs rounded border bg-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          data-testid={`${testIdPrefix}-filter`}
        />
        {onUploadClick && (
          <button
            type="button"
            onClick={onUploadClick}
            disabled={isUploading}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50 shrink-0"
            data-testid={`${testIdPrefix}-upload`}
          >
            <UploadCloud className="w-3 h-3" />
            {isUploading ? "…" : uploadLabel}
          </button>
        )}
      </div>

      <div
        className={cn("grid gap-2 max-h-52 overflow-y-auto pr-0.5", colClass)}
      >
        {filtered.map((item) => {
          const isSelected = item.id === selectedId;
          const isSvg = item.mimeType === "image/svg+xml";
          return (
            <button
              key={item.id}
              type="button"
              title={item.filename ?? ""}
              aria-pressed={isSelected}
              onClick={() =>
                onSelect(toggleable && isSelected ? null : item.id)
              }
              className={cn(
                "relative flex flex-col items-center gap-1 rounded-md border-2 transition-all p-1 bg-muted/20",
                isSelected
                  ? "border-primary ring-2 ring-primary ring-offset-1"
                  : "border-transparent hover:border-primary/50",
              )}
              data-testid={`${testIdPrefix}-option-${item.id}`}
            >
              {isSvg ? (
                <InlineSvg
                  url={getMediaAttachmentUrl(item.id)}
                  label={item.filename ?? ""}
                  className={cn("w-full", aspectClass)}
                />
              ) : (
                <img
                  src={getMediaAttachmentUrl(item.id)}
                  alt={item.filename ?? ""}
                  className={cn("w-full", aspectClass, fitClass)}
                />
              )}
              {showLabels && (
                <span className="w-full text-center text-[10px] text-muted-foreground truncate leading-tight">
                  {(item.filename ?? "").replace(/\.svg$/i, "")}
                </span>
              )}
              {isSelected && (
                <div className="absolute top-1 right-1 bg-green-500 rounded-full p-0.5 shadow">
                  <Check className="w-3 h-3 text-white" strokeWidth={3} />
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
