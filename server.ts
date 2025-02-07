import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Scrapper } from './models/domain';
import { Konzum } from './scrappers/konzum';
import * as schema from './db/schema';
import { Studenac } from './scrappers/studenac';
import { Kaufland } from './scrappers/kaufland';
import { client, connectRedis } from './redisClient';
import { Eurospin } from './scrappers/eurospin';
import { Spar } from './scrappers/spar';
import { Lidl } from './scrappers/lidl';
import { Plodine } from './scrappers/plodine';
import { Tommy } from './scrappers/tommy';

// fetch configuration fron environment variables
const PORT = process.env.PORT || 3000;

const ALL_RETAILS_KEY = 'retail:all';

// open database
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 10000,
  keepAlive: true,
});

const db = drizzle(pool, { schema, logger: true });

// initialize Redis connection
connectRedis().catch((err) =>
  console.error('Failed to connect to Redis:', err)
);

const scrappers: Scrapper[] = [
  new Konzum(),
  new Kaufland(),
  new Eurospin(),
  new Spar(),
  new Lidl(),
  new Studenac(),
  new Plodine(),
  new Tommy(),
];

// process HTTP requests
const server = Bun.serve({
  port: PORT,

  async fetch(request) {
    const { method } = request;
    const { pathname } = new URL(request.url);

    if (method === 'GET' && pathname === '/api/scrape') {
      triggerScrappers();
      return new Response('Scraping triggered', { status: 200 });
    }
    if (method === 'GET' && pathname === '/api/scrape/konzum') {
      triggerKonzumScrapper();
      return new Response('Scraping Konzum triggered', { status: 200 });
    }
    if (method === 'GET' && pathname === '/api/scrape/studenac') {
      triggerStudenacScrapper();
      return new Response('Scraping Studenac triggered', { status: 200 });
    }
    if (method === 'GET' && pathname === '/api/scrape/kaufland') {
      triggerKauflandScrapper();
      return new Response('Scraping Kaufland triggered', { status: 200 });
    }
    if (method === 'GET' && pathname === '/api/scrape/eurospin') {
      triggerEurospinScrapper();
      return new Response('Scraping Eurospin triggered', { status: 200 });
    }
    if (method === 'GET' && pathname === '/api/scrape/spar') {
      triggerSparScrapper();
      return new Response('Scraping Spar triggered', { status: 200 });
    }
    if (method === 'GET' && pathname === '/api/scrape/lidl') {
      triggerLidlScrapper();
      return new Response('Scraping Lidl triggered', { status: 200 });
    }
    if (method === 'GET' && pathname === '/api/scrape/plodine') {
      triggerPlodineScrapper();
      return new Response('Scraping Plodine triggered', { status: 200 });
    }
    if (method === 'GET' && pathname === '/api/scrape/tommy') {
      triggerTommyScrapper();
      return new Response('Scraping Tommy triggered', { status: 200 });
    }
    if (method === 'GET' && pathname === '/api/clear-cache') {
      await clearCache();
      return new Response('Cache cleared', { status: 200 });
    }

    return new Response('Not Found', { status: 404 });
  },
});

async function triggerScrappers() {
  try {
    for (const scrapper of scrappers) {
      await scrapper.fetch(db);

      const key = `retail:${scrapper.retailName.toLowerCase()}`;
      await client.del(key);
    }
    await client.del(ALL_RETAILS_KEY);
  } catch (error: unknown) {
    // handle errors
    if (error instanceof Error) {
      console.error(error.stack || error);
    } else {
      // Handle non-Error exceptions (rare but possible)
      console.error(String(error));
    }
  } finally {
    exit();
  }
}

async function triggerScrapper(scrapper: Scrapper) {
  try {
    await scrapper.fetch(db);

    const key = `retail:${scrapper.retailName.toLowerCase()}`;
    await client.del(key);
  } catch (error: unknown) {
    // handle errors
    if (error instanceof Error) {
      console.error(error.stack || error);
    } else {
      // Handle non-Error exceptions (rare but possible)
      console.error(String(error));
    }
  } finally {
    exit();
  }
}

async function triggerKonzumScrapper() {
  const scrapper = new Konzum();
  triggerScrapper(scrapper);
}

async function triggerStudenacScrapper() {
  const scrapper = new Studenac();
  triggerScrapper(scrapper);
}

async function triggerKauflandScrapper() {
  const scrapper = new Kaufland();
  triggerScrapper(scrapper);
}

async function triggerEurospinScrapper() {
  const scrapper = new Eurospin();
  triggerScrapper(scrapper);
}

async function triggerSparScrapper() {
  const scrapper = new Spar();
  triggerScrapper(scrapper);
}

async function triggerLidlScrapper() {
  const scrapper = new Lidl();
  triggerScrapper(scrapper);
}

async function triggerPlodineScrapper() {
  const scrapper = new Plodine();
  triggerScrapper(scrapper);
}

async function triggerTommyScrapper() {
  const scrapper = new Tommy();
  triggerScrapper(scrapper);
}

async function clearCache() {
  try {
    for (const scrapper of scrappers) {
      const key = `retail:${scrapper.retailName.toLowerCase()}`;
      await client.del(key);
    }
    await client.del(ALL_RETAILS_KEY);
  } catch (error: unknown) {
    // handle errors
    if (error instanceof Error) {
      console.error(error.stack || error);
    } else {
      // Handle non-Error exceptions (rare but possible)
      console.error(String(error));
    }
  } finally {
    exit();
  }
}

console.log(`Server listening on port ${server.port}`);

process.on('SIGINT', exit);

function exit() {
  console.log('exiting');
  pool.end();
  client.disconnect();
  process.exit();
}
