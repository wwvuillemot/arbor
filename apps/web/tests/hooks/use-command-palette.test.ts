import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useCommandPalette } from "../../src/hooks/use-command-palette";

describe("useCommandPalette", () => {
  it("should initialize with open set to false", () => {
    const { result } = renderHook(() => useCommandPalette());

    expect(result.current.open).toBe(false);
  });

  it("should provide setOpen function", () => {
    const { result } = renderHook(() => useCommandPalette());

    expect(typeof result.current.setOpen).toBe("function");
  });

  it("should update open state when setOpen is called", () => {
    const { result } = renderHook(() => useCommandPalette());

    act(() => {
      result.current.setOpen(true);
    });

    expect(result.current.open).toBe(true);

    act(() => {
      result.current.setOpen(false);
    });

    expect(result.current.open).toBe(false);
  });

  it("should provide toggle function", () => {
    const { result } = renderHook(() => useCommandPalette());

    expect(typeof result.current.toggle).toBe("function");
  });

  it("should toggle open state when toggle is called", () => {
    const { result } = renderHook(() => useCommandPalette());

    expect(result.current.open).toBe(false);

    act(() => {
      result.current.toggle();
    });

    expect(result.current.open).toBe(true);

    act(() => {
      result.current.toggle();
    });

    expect(result.current.open).toBe(false);
  });
});
