import Fastify, { type FastifyInstance, type FastifyRequest } from "fastify";
import cors from "@fastify/cors";
import { fastifyTRPCPlugin } from "@trpc/server/adapters/fastify";
import { ApolloServer, HeaderMap } from "@apollo/server";
import { appRouter } from "./router";
import { createContext } from "./trpc";
import { schema } from "../graphql/schema";
import { MediaAttachmentService } from "../services/media-attachment-service";

const DEFAULT_LOG_LEVEL = "info";
const DEFAULT_CORS_ORIGIN = "http://localhost:3000";
const GRAPHQL_PATH = "/graphql";
const MAX_ROUTE_PARAMETER_LENGTH = 5000;
const MAX_REQUEST_BODY_BYTES = 52_428_800;

const mediaAttachmentService = new MediaAttachmentService();

export interface ApiServerBundle {
  server: FastifyInstance;
  apollo: ApolloServer;
}

export async function createServer(): Promise<ApiServerBundle> {
  const server = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || DEFAULT_LOG_LEVEL,
      transport: {
        target: "pino-pretty",
        options: {
          translateTime: "HH:MM:ss Z",
          ignore: "pid,hostname",
        },
      },
    },
    routerOptions: {
      maxParamLength: MAX_ROUTE_PARAMETER_LENGTH,
    },
    bodyLimit: MAX_REQUEST_BODY_BYTES,
  });

  await registerCors(server);
  await registerTrpc(server);

  const apollo = await createApolloServer(server);
  registerGraphqlRoute(server, apollo);
  registerMediaRoute(server);
  registerHealthRoutes(server);

  return { server, apollo };
}

async function registerCors(server: FastifyInstance): Promise<void> {
  await server.register(cors, {
    origin: process.env.CORS_ORIGIN || DEFAULT_CORS_ORIGIN,
    credentials: true,
  });
}

async function registerTrpc(server: FastifyInstance): Promise<void> {
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
}

async function createApolloServer(
  server: FastifyInstance,
): Promise<ApolloServer> {
  const apollo = new ApolloServer({
    schema,
    introspection: process.env.NODE_ENV !== "production",
  });

  await apollo.start();
  server.addHook("onClose", async () => {
    await apollo.stop();
  });

  return apollo;
}

function registerGraphqlRoute(
  server: FastifyInstance,
  apollo: ApolloServer,
): void {
  server.route({
    url: GRAPHQL_PATH,
    method: ["GET", "POST"],
    handler: async (request, reply) => {
      const headers = createHeaderMap(request);
      const searchString = buildGraphqlSearchString(request);
      const httpGraphqlResponse = await apollo.executeHTTPGraphQLRequest({
        httpGraphQLRequest: {
          method: request.method.toUpperCase(),
          headers,
          body: request.method === "GET" ? undefined : request.body,
          search: searchString,
        },
        context: async () => ({}),
      });

      reply.status(httpGraphqlResponse.status || 200);
      for (const [key, value] of httpGraphqlResponse.headers) {
        reply.header(key, value);
      }

      if (httpGraphqlResponse.body.kind === "complete") {
        reply.send(httpGraphqlResponse.body.string);
        return;
      }

      for await (const chunk of httpGraphqlResponse.body.asyncIterator) {
        reply.raw.write(chunk);
      }
      reply.raw.end();
    },
  });
}

function createHeaderMap(request: FastifyRequest): HeaderMap {
  const headers = new HeaderMap();
  for (const [key, value] of Object.entries(request.headers)) {
    if (value !== undefined) {
      headers.set(
        key.toLowerCase(),
        Array.isArray(value) ? value.join(", ") : value,
      );
    }
  }
  return headers;
}

function buildGraphqlSearchString(request: FastifyRequest): string {
  const requestUrl = request.raw.url ?? request.url;
  return new URL(requestUrl, "http://localhost").search;
}

function registerMediaRoute(server: FastifyInstance): void {
  server.get<{ Params: { id: string } }>(
    "/media/:id",
    async (request, reply) => {
      try {
        const { attachment, stream } =
          await mediaAttachmentService.getAttachmentContent(request.params.id);

        reply.type(attachment.mimeType);
        reply.header("Content-Length", `${attachment.size}`);
        reply.header(
          "Content-Disposition",
          buildInlineContentDisposition(attachment.filename),
        );
        reply.header("Cache-Control", "public, max-age=31536000, immutable");
        reply.header("X-Content-Type-Options", "nosniff");

        return reply.send(stream);
      } catch {
        return reply.status(404).send({ error: "Media not found" });
      }
    },
  );
}

function buildInlineContentDisposition(fileName: string): string {
  const sanitizedFileName = fileName.replace(/["\\\r\n]/g, "_");
  const encodedFileName = encodeURIComponent(fileName);
  return `inline; filename="${sanitizedFileName}"; filename*=UTF-8''${encodedFileName}`;
}

function registerHealthRoutes(server: FastifyInstance): void {
  server.get("/health", async () => ({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  }));

  server.get("/", async () => ({
    name: "Arbor API",
    version: "0.1.0",
    endpoints: {
      health: "/health",
      trpc: "/trpc",
      graphql: GRAPHQL_PATH,
    },
  }));
}
