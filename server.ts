import puppeteer from 'puppeteer-core';
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Scrapper } from './models/domain';
import { Konzum } from './scrappers/konzum';
import * as schema from './db/schema';
import { Studenac } from './scrappers/studenac';

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
});
const db = drizzle(pool, { schema, logger: true });

const scrappers: Scrapper[] = [new Studenac()];

// process HTTP requests
const server = Bun.serve({
  port: PORT,

  async fetch(request) {
    const { method } = request;
    const { pathname } = new URL(request.url);

    if (method === 'GET' && pathname === '/api/scrape') {
      try {
        for (const scrapper of scrappers) {
          await scrapper.fetch(db, browser);
        }

        exit();

        return new Response('Done', { status: 200 });
      } catch (error: unknown) {
        // handle errors
        if (error instanceof Error) {
          console.error(error.stack || error);
          return new Response(`<pre>${error.stack || error}</pre>`, {
            status: 500,
            headers: { 'Content-Type': 'text/html' },
          });
        } else {
          // Handle non-Error exceptions (rare but possible)
          console.error(String(error));
          return new Response(`<pre>${String(error)}</pre>`, {
            status: 500,
            headers: { 'Content-Type': 'text/html' },
          });
        }
      } finally {
        console.log(`Printer server listening on port ${server.port}`);
      }
    }

    return new Response('Not Found', { status: 404 });
  },
});

console.log(`Server listening on port ${server.port}`);

process.on('SIGINT', exit);

function exit() {
  console.log('exiting');
  browser.close();
  pool.end();
  process.exit();
}
