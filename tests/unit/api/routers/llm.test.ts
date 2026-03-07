import { describe, it, expect } from "vitest";
import { appRouter } from "@/api/router";
import { createContext } from "@/api/trpc";

// Create a test caller
function createCaller() {
  return appRouter.createCaller(
    createContext({
      req: {} as any,
      res: {} as any,
      info: {} as any,
    }),
  );
}

describe("LLM Router", () => {
  describe("listAvailableModels", () => {
    it("should return a list of available models", async () => {
      const caller = createCaller();
      const models = await caller.llm.listAvailableModels();

      expect(Array.isArray(models)).toBe(true);
      expect(models.length).toBeGreaterThan(0);

      // Check structure of first model
      const firstModel = models[0];
      expect(firstModel).toHaveProperty("id");
      expect(firstModel).toHaveProperty("name");
      expect(firstModel).toHaveProperty("provider");
      expect(firstModel).toHaveProperty("contextWindow");
      expect(firstModel).toHaveProperty("supportsTools");
      expect(firstModel).toHaveProperty("supportsVision");
      expect(firstModel).toHaveProperty("supportsStreaming");
    });

    it("should include stub model in test mode", async () => {
      const caller = createCaller();
      const models = await caller.llm.listAvailableModels();

      const stubModel = models.find((m) => m.id === "stub");
      expect(stubModel).toBeDefined();
      expect(stubModel?.name).toBe("Stub Model (Testing)");
      expect(stubModel?.provider).toBe("local");
    });

    it("should include DeepSeek R1 model with reasoning support", async () => {
      const caller = createCaller();
      const models = await caller.llm.listAvailableModels();

      const deepseekModel = models.find((m) => m.id === "deepseek-r1");
      expect(deepseekModel).toBeDefined();
      expect(deepseekModel?.name).toBe("DeepSeek R1");
      expect(deepseekModel?.supportsReasoning).toBe(true);
    });
  });
});
