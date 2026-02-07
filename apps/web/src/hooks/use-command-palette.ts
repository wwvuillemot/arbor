"use client";

import * as React from "react";

export function useCommandPalette() {
  const [open, setOpen] = React.useState(false);

  return {
    open,
    setOpen,
    toggle: () => setOpen((prev) => !prev),
  };
}
