import { defineConfig } from "orval";

export default defineConfig({
  arbor: {
    input: {
      target: "./server/openapi.yaml",
    },
    output: {
      mode: "tags-split",
      target: "./src/lib/api/generated",
      schemas: "./src/lib/api/generated/models",
      client: "react-query",
      mock: true,
      prettier: true,
      override: {
        mutator: {
          path: "./src/lib/api/client.ts",
          name: "customInstance",
        },
        query: {
          useQuery: true,
          useMutation: true,
          signal: true,
        },
      },
    },
    hooks: {
      afterAllFilesWrite: "prettier --write",
    },
  },
});
