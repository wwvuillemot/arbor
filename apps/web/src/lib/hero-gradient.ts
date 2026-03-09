/**
 * Algorithmic hero gradient data generator.
 *
 * Algorithm:
 * 1. FNV-1a hash of the seed string → 32-bit uint
 * 2. Three hues derived via golden-angle (137.508°) stepping —
 *    guaranteed perceptual separation while remaining harmonious
 * 3. Returns structured color data consumed by <HeroGradient> to render
 *    an animated layered mesh: a solid linear base + two drifting blobs
 */

function fnv1a32(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
    h = h >>> 0;
  }
  return h;
}

function bits(h: number, start: number, count: number): number {
  return (h >>> start) & ((1 << count) - 1);
}

export type BlobPath = "a" | "b" | "c";

export interface HeroGradientData {
  /** CSS gradient string for the static base layer */
  base: string;
  blobs: Array<{
    /** CSS color (hsl with alpha) for the radial blob */
    color: string;
    /** Blob centre X as percentage of container width */
    x: number;
    /** Blob centre Y as percentage of container height */
    y: number;
    /** Which keyframe drift path to use */
    path: BlobPath;
    /** Animation duration in seconds */
    duration: number;
    /** Animation delay in seconds (negative → starts mid-cycle) */
    delay: number;
  }>;
}

export function generateHeroGradientData(seed: string): HeroGradientData {
  const h = fnv1a32(seed || "\0");
  const h2 = fnv1a32(String(h)); // second pass for extra entropy

  // ── Hues ─────────────────────────────────────────────────────────────────
  const hue0 = bits(h, 0, 8) * (360 / 256);
  const hue1 = (hue0 + 137.508) % 360;
  const hue2 = (hue1 + 137.508) % 360;

  // ── Saturation 68–88 % ───────────────────────────────────────────────────
  const sat0 = 68 + bits(h, 8, 5) * (20 / 32);
  const sat1 = 68 + bits(h, 13, 5) * (20 / 32);
  const sat2 = 68 + bits(h, 18, 5) * (20 / 32);

  // ── Lightness 42–58 % ────────────────────────────────────────────────────
  const l0 = 42 + bits(h, 23, 4) * (16 / 16);
  const l1 = 42 + bits(h, 27, 3) * (16 / 8);
  const l2 = 42 + bits(h2, 0, 4) * (16 / 16);

  // ── Linear base gradient ─────────────────────────────────────────────────
  const angle = bits(h, 0, 8) * (180 / 256);
  const c0 = `hsl(${hue0.toFixed(1)} ${sat0.toFixed(1)}% ${l0.toFixed(1)}%)`;
  const c1 = `hsl(${hue1.toFixed(1)} ${sat1.toFixed(1)}% ${l1.toFixed(1)}%)`;
  const c2 = `hsl(${hue2.toFixed(1)} ${sat2.toFixed(1)}% ${l2.toFixed(1)}%)`;
  const base = `linear-gradient(${angle.toFixed(1)}deg, ${c0}, ${c1} 50%, ${c2})`;

  // ── Blob colours (lighter + semi-transparent for a "glow" look) ──────────
  const blob0Color = `hsl(${hue0.toFixed(1)} ${sat0.toFixed(1)}% ${Math.min(l0 + 20, 82).toFixed(1)}% / 0.60)`;
  const blob2Color = `hsl(${hue2.toFixed(1)} ${sat2.toFixed(1)}% ${Math.min(l2 + 16, 82).toFixed(1)}% / 0.52)`;

  // ── Blob centres (10–90 %) ───────────────────────────────────────────────
  const b0x = 10 + bits(h2, 4, 7) * (80 / 128);
  const b0y = 10 + bits(h2, 11, 7) * (80 / 128);
  const b1x = 10 + bits(h2, 18, 7) * (80 / 128);
  const b1y = 10 + bits(h2, 25, 7) * (80 / 128);

  // ── Animation: duration 9–15 s, delay –0 to –7 s ─────────────────────────
  const dur0 = 9 + bits(h, 4, 3) * (6 / 8);
  const dur1 = 9 + bits(h, 7, 3) * (6 / 8);
  const del0 = -(bits(h2, 2, 3) * (7 / 8));
  const del1 = -(bits(h2, 5, 3) * (7 / 8));

  // ── Drift path assignment ─────────────────────────────────────────────────
  const paths: BlobPath[] = ["a", "b", "c"];
  const path0 = paths[bits(h, 10, 2) % 3];
  const path1 = paths[(bits(h, 12, 2) + 1) % 3]; // different from path0

  return {
    base,
    blobs: [
      {
        color: blob0Color,
        x: b0x,
        y: b0y,
        path: path0,
        duration: dur0,
        delay: del0,
      },
      {
        color: blob2Color,
        x: b1x,
        y: b1y,
        path: path1,
        duration: dur1,
        delay: del1,
      },
    ],
  };
}
