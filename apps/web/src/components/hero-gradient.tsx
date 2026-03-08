"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { generateHeroGradientData } from "@/lib/hero-gradient";

interface HeroGradientProps {
  /** Seed string — typically the card's name */
  seed: string;
  /** Optional real image URL; shown instead of the gradient when provided */
  imageUrl?: string | null;
  /** Alt text for the image */
  imageAlt?: string;
  className?: string;
}

/**
 * Renders either a real hero image or a procedurally generated animated
 * gradient mural unique to the given seed.
 *
 * The gradient is composed of three layers:
 *   1. A static linear-gradient base (hash-derived hues + angle)
 *   2. Two oversized radial blobs that drift independently via CSS keyframes
 *      (hero-blob-a/b/c defined in globals.css), creating a fluid-mixing look
 */
export function HeroGradient({
  seed,
  imageUrl,
  imageAlt = "",
  className,
}: HeroGradientProps) {
  if (imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imageUrl}
        alt={imageAlt}
        className={cn("w-full h-full object-cover", className)}
      />
    );
  }

  const { base, blobs } = generateHeroGradientData(seed);

  return (
    <div
      className={cn("relative overflow-hidden", className)}
      style={{ background: base }}
      aria-hidden
    >
      {blobs.map((blob, i) => (
        <div
          key={i}
          className="absolute"
          style={{
            // Oversized so the blob fills the frame even when translated
            inset: "-25%",
            background: `radial-gradient(ellipse 60% 60% at ${blob.x.toFixed(1)}% ${blob.y.toFixed(1)}%, ${blob.color}, transparent)`,
            animation: `hero-blob-${blob.path} ${blob.duration.toFixed(2)}s ${blob.delay.toFixed(2)}s ease-in-out infinite`,
            willChange: "transform",
          }}
        />
      ))}
    </div>
  );
}
