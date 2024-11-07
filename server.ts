import puppeteer from 'puppeteer-core';
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Scrapper } from './models/domain';
import { Konzum } from './scrappers/konzum';
import * as schema from './db/schema';
import { Studenac } from './scrappers/studenac';
import { Kaufland } from './scrappers/kaufland';
import { client, connectRedis } from './redisClient';

// fetch configuration fron environment variables
const PORT = process.env.PORT || 3000;

// location of Chrome executable (useful for local debugging)
const chrome =
  process.platform == 'darwin'
    ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
    : '/usr/bin/google-chrome-stable';

// launch a single headless Chrome instance to be used by all requests
const browser = await puppeteer.launch({
  headless: 'new',
  executablePath: chrome,
});

// open database
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 10000,
  keepAlive: true,
});

const db = drizzle(pool, { schema, logger: true });

// Initialize Redis connection
connectRedis().catch((err) =>
  console.error('Failed to connect to Redis:', err)
);

const scrappers: Scrapper[] = [new Konzum(), new Kaufland()];

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

    return new Response('Not Found', { status: 404 });
  },
});

async function triggerScrappers() {
  try {
    for (const scrapper of scrappers) {
      await scrapper.fetch(db, browser);

      const hrLocaleKey = `retail:${scrapper.retailName.toLowerCase()}|locale:hr_HR`;
      await client.del(hrLocaleKey);
    }
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
  try {
    const scrapper = new Konzum();
    await scrapper.fetch(db);

    const hrLocaleKey = `retail:${scrapper.retailName.toLowerCase()}|locale:hr_HR`;
    await client.del(hrLocaleKey);
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

async function triggerStudenacScrapper() {
  try {
    const scrapper = new Studenac();
    await scrapper.fetch(db);

    const hrLocaleKey = `retail:${scrapper.retailName.toLowerCase()}|locale:hr_HR`;
    await client.del(hrLocaleKey);
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

async function triggerKauflandScrapper() {
  try {
    const scrapper = new Kaufland();
    await scrapper.fetch(db);

    const hrLocaleKey = `retail:${scrapper.retailName.toLowerCase()}|locale:hr_HR`;
    await client.del(hrLocaleKey);
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
  browser.close();
  pool.end();
  process.exit();
}
