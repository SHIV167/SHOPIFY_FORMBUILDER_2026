const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');

const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0';
const port = parseInt(process.env.PORT || '10001', 10);

// Increase max header size to 64KB to handle Shopify OAuth callbacks
// with large cookies (HTTP 431 fix)
const MAX_HEADER_SIZE = 64 * 1024;

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  createServer(
    { maxHeaderSize: MAX_HEADER_SIZE },
    async (req, res) => {
      try {
        const parsedUrl = parse(req.url, true);
        await handle(req, res, parsedUrl);
      } catch (err) {
        console.error('Error occurred handling', req.url, err);
        res.statusCode = 500;
        res.end('Internal Server Error');
      }
    }
  )
    .once('error', (err) => {
      console.error(err);
      process.exit(1);
    })
    .listen(port, hostname, () => {
      console.log(`> Contact Form app ready on http://${hostname}:${port} (maxHeaderSize: ${MAX_HEADER_SIZE / 1024}KB)`);
    });
});