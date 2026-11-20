import type { IncomingMessage, ServerResponse } from 'node:http';
import type express from 'express';
import { createApp } from '../server';

let appPromise: Promise<express.Express> | null = null;

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  appPromise ??= createApp();
  const app = await appPromise;
  return app(req, res);
}
