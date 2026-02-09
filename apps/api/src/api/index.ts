import Fastify, { FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import { fastifyTRPCPlugin } from "@trpc/server/adapters/fastify";
import { ApolloServer, HeaderMap } from "@apollo/server";
import { parse } from "url";
import { appRouter } from "./router";
import { createContext } from "./trpc";
import { schema } from "../graphql/schema";

const PORT = parseInt(process.env.API_PORT || "3001", 10);
const HOST = process.env.API_HOST || "0.0.0.0";

/**
 * Create and configure the Fastify server with all routes.
 * Exported so tests can create a server instance without starting it.
 */
export async function createServer(): Promise<{
  server: FastifyInstance;
  apollo: ApolloServer;
}> {
  const server = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || "info",
      transport: {
        target: "pino-pretty",
        options: {
          translateTime: "HH:MM:ss Z",
          ignore: "pid,hostname",
        },
      },
    },
    maxParamLength: 5000,
  });

  // Register CORS
  await server.register(cors, {
    origin: process.env.CORS_ORIGIN || "http://localhost:3000",
    credentials: true,
  });

  // Register tRPC
  await server.register(fastifyTRPCPlugin, {
    prefix: "/trpc",
    trpcOptions: {
      router: appRouter,
      createContext,
      onError({ path, error }: { path: string | undefined; error: Error }) {
        console.error(`❌ tRPC Error on ${path}:`, error);
      },
    },
  });

  // ── GraphQL (Apollo Server 4) ──────────────────────────────────────────
  const apollo = new ApolloServer({
    schema,
    introspection: process.env.NODE_ENV !== "production",
  });

  await apollo.start();

  // Graceful shutdown: drain Apollo when Fastify closes
  server.addHook("onClose", async () => {
    await apollo.stop();
  });

  // Manual Fastify ↔ Apollo integration (works with Fastify 5)
  server.route({
    url: "/graphql",
    method: ["GET", "POST"],
    handler: async (request, reply) => {
      // Build HeaderMap from Fastify headers
      const headers = new HeaderMap();
      for (const [key, value] of Object.entries(request.headers)) {
        if (value !== undefined) {
          headers.set(
            key.toLowerCase(),
            Array.isArray(value) ? value.join(", ") : value,
          );
        }
      }

      // Build search string from the URL
      const searchString = parse(request.url).search ?? "";

      // Execute the GraphQL request
      // For GET requests, body must be undefined; Apollo reads from search params
      const httpGraphQLResponse = await apollo.executeHTTPGraphQLRequest({
        httpGraphQLRequest: {
          method: request.method.toUpperCase(),
          headers,
          body: request.method === "GET" ? undefined : request.body,
          search: searchString,
        },
        context: async () => ({}),
      });

      // Set response status and headers
      reply.status(httpGraphQLResponse.status || 200);
      for (const [key, value] of httpGraphQLResponse.headers) {
        reply.header(key, value);
      }

      // Send the response body
      if (httpGraphQLResponse.body.kind === "complete") {
        reply.send(httpGraphQLResponse.body.string);
      } else {
        // Chunked response (e.g., @defer)
        for await (const chunk of httpGraphQLResponse.body.asyncIterator) {
          reply.raw.write(chunk);
        }
        reply.raw.end();
      }
    },
  });

  // Health check endpoint (non-tRPC)
  server.get("/health", async () => {
    return {
      status: "ok",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  });

  // Root endpoint
  server.get("/", async () => {
    return {
      name: "Arbor API",
      version: "0.1.0",
      endpoints: {
        health: "/health",
        trpc: "/trpc",
        graphql: "/graphql",
      },
    };
  });

  return { server, apollo };
}

async function main() {
  const { server } = await createServer();

  // Start server
  try {
    await server.listen({ port: PORT, host: HOST });
    console.log(`
🚀 Arbor API Server Ready!

   URL: http://localhost:${PORT}
   tRPC: http://localhost:${PORT}/trpc
   GraphQL: http://localhost:${PORT}/graphql
   Health: http://localhost:${PORT}/health
    `);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }

  // Graceful shutdown
  const signals = ["SIGINT", "SIGTERM"];
  signals.forEach((signal) => {
    process.on(signal, async () => {
      console.log(`\n${signal} received, shutting down gracefully...`);
      await server.close();
      process.exit(0);
    });
  });
}

main();
