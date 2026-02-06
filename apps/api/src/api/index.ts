import Fastify from 'fastify';
import cors from '@fastify/cors';
import { fastifyTRPCPlugin } from '@trpc/server/adapters/fastify';
import { appRouter } from './router';
import { createContext } from './trpc';

const PORT = parseInt(process.env.API_PORT || '3001', 10);
const HOST = process.env.API_HOST || '0.0.0.0';

async function main() {
  const server = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info',
      transport: {
        target: 'pino-pretty',
        options: {
          translateTime: 'HH:MM:ss Z',
          ignore: 'pid,hostname',
        },
      },
    },
    maxParamLength: 5000,
  });

  // Register CORS
  await server.register(cors, {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
  });

  // Register tRPC
  await server.register(fastifyTRPCPlugin, {
    prefix: '/trpc',
    trpcOptions: {
      router: appRouter,
      createContext,
      onError({ path, error }) {
        console.error(`❌ tRPC Error on ${path}:`, error);
      },
    },
  });

  // Health check endpoint (non-tRPC)
  server.get('/health', async () => {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  });

  // Root endpoint
  server.get('/', async () => {
    return {
      name: 'Arbor API',
      version: '0.1.0',
      endpoints: {
        health: '/health',
        trpc: '/trpc',
      },
    };
  });

  // Start server
  try {
    await server.listen({ port: PORT, host: HOST });
    console.log(`
🚀 Arbor API Server Ready!
   
   URL: http://localhost:${PORT}
   tRPC: http://localhost:${PORT}/trpc
   Health: http://localhost:${PORT}/health
    `);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }

  // Graceful shutdown
  const signals = ['SIGINT', 'SIGTERM'];
  signals.forEach((signal) => {
    process.on(signal, async () => {
      console.log(`\n${signal} received, shutting down gracefully...`);
      await server.close();
      process.exit(0);
    });
  });
}

main();

