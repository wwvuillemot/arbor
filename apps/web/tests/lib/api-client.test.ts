import { describe, it, expect, beforeEach } from "vitest";
import { AxiosError } from "axios";
import {
  AXIOS_INSTANCE,
  customInstance,
  handleApiError,
} from "../../src/lib/api/client";

describe("API Client", () => {
  describe("AXIOS_INSTANCE", () => {
    it("should have correct baseURL", () => {
      expect(AXIOS_INSTANCE.defaults.baseURL).toBeDefined();
      expect(AXIOS_INSTANCE.defaults.baseURL).toContain("http");
    });

    it("should have correct headers", () => {
      expect(AXIOS_INSTANCE.defaults.headers["Content-Type"]).toBe(
        "application/json",
      );
    });
  });

  describe("customInstance", () => {
    it("should create a promise with cancel method", async () => {
      const promise = customInstance({ url: "/test" });
      expect(promise).toBeInstanceOf(Promise);
      expect(typeof (promise as { cancel?: () => void }).cancel).toBe(
        "function",
      );
      // Cancel the promise immediately to prevent unhandled rejection
      const cancelablePromise = promise as Promise<unknown> & {
        cancel: () => void;
      };
      cancelablePromise.cancel();
      // Catch the cancellation error
      await expect(promise).rejects.toThrow();
    });
  });

  describe("handleApiError", () => {
    it("should handle error with response", () => {
      const error = {
        response: {
          status: 404,
          data: { message: "Not found" },
        },
      } as AxiosError;

      const result = handleApiError(error);
      expect(result).toBe("Not found");
    });

    it("should handle error with response but no message", () => {
      const error = {
        response: {
          status: 500,
          data: {},
        },
      } as AxiosError;

      const result = handleApiError(error);
      expect(result).toBe("Error: 500");
    });

    it("should handle error with request but no response", () => {
      const error = {
        request: {},
      } as AxiosError;

      const result = handleApiError(error);
      expect(result).toBe(
        "No response from server. Please check your connection.",
      );
    });

    it("should handle error without request or response", () => {
      const error = {
        message: "Network error",
      } as AxiosError;

      const result = handleApiError(error);
      expect(result).toBe("Network error");
    });

    it("should handle error without message", () => {
      const error = {} as AxiosError;

      const result = handleApiError(error);
      expect(result).toBe("An unexpected error occurred");
    });
  });
});
