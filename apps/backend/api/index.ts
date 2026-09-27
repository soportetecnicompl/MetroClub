import 'reflect-metadata';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import express, { type Express } from 'express';
import { AppModule } from '../src/app.module';

/**
 * Entrypoint serverless para Vercel. A diferencia de src/main.ts (proceso
 * persistente vía `nest start`), aquí el handler se re-invoca en cada
 * request; cacheamos la instancia de Nest/Express a nivel de módulo para
 * reutilizarla entre invocaciones "warm" del mismo contenedor de Vercel.
 */
let cachedApp: Express | null = null;

async function bootstrap(): Promise<Express> {
  const expressApp = express();
  const app = await NestFactory.create(AppModule, new ExpressAdapter(expressApp));
  app.enableCors();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.setGlobalPrefix('api');
  await app.init();
  return expressApp;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (!cachedApp) {
    cachedApp = await bootstrap();
  }
  cachedApp(req, res);
}
