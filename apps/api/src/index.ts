import cors from 'cors';
import express from 'express';
import { closePool } from '@wild-rift-forge/database';
import { loadEnv } from './env.js';
import { championsRouter } from './routes/champions.js';
import { countersRouter } from './routes/counters.js';
import { matchupsRouter } from './routes/matchups.js';
import { patchesRouter } from './routes/patches.js';
import { tiersRouter } from './routes/tiers.js';

loadEnv();

const port = Number(process.env.API_PORT ?? 4000);
const app = express();

app.use(cors({ origin: true }));
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.use('/champions', championsRouter);
app.use('/counters', countersRouter);
app.use('/matchups', matchupsRouter);
app.use('/tiers', tiersRouter);
app.use('/patches', patchesRouter);

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  const message = err instanceof Error ? err.message : 'Internal server error';
  res.status(500).json({ error: message });
});

const server = app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});

async function shutdown(): Promise<void> {
  server.close();
  await closePool();
  process.exit(0);
}

process.on('SIGINT', () => {
  void shutdown();
});
process.on('SIGTERM', () => {
  void shutdown();
});
