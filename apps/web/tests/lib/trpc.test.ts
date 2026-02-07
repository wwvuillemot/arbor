import { describe, it, expect } from "vitest";
import { trpc, getTRPCClient } from "../../src/lib/trpc";

describe("tRPC Client", () => {
  describe("trpc", () => {
    it("should be defined", () => {
      expect(trpc).toBeDefined();
    });

    it("should have createClient method", () => {
      expect(typeof trpc.createClient).toBe("function");
    });
  });

  describe("getTRPCClient", () => {
    it("should create a tRPC client", () => {
      const client = getTRPCClient();
      expect(client).toBeDefined();
    });

    it("should create client with links configuration", () => {
      const client = getTRPCClient();
      // Just verify the client was created successfully
      expect(client).toBeDefined();
    });
  });
});
