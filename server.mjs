import { createServer } from 'node:http';

const port = Number.parseInt(process.env.PORT ?? '8080', 10);

const server = createServer((request, response) => {
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');

  if (request.url === '/healthz') {
    response.writeHead(200);
    response.end(JSON.stringify({ status: 'ok', app: 'tecnico-node' }));
    return;
  }

  if (request.url === '/') {
    response.writeHead(200);
    response.end(JSON.stringify({
      message: 'Hola desde Node.js en Alpine',
      node: process.version,
    }));
    return;
  }

  response.writeHead(404);
  response.end(JSON.stringify({ error: 'not found' }));
});

server.listen(port, '0.0.0.0', () => {
  console.log(`tecnico-node escuchando en el puerto ${port}`);
});
