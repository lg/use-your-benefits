import { Hono } from 'hono';
import api from './api/routes';

const app = new Hono();

app.route('/', api);

app.get('/', (c) => {
  return c.text('Credit Card Benefits API - Use /api/* endpoints');
});

export default app;
