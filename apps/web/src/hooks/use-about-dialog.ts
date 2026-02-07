"use client";

import * as React from "react";

export function useAboutDialog() {
  const [open, setOpen] = React.useState(false);

  return {
    open,
    setOpen,
    toggle: () => setOpen((prev) => !prev),
  };
}
