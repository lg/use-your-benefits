import { Hono } from 'hono';
import {
  getCardsHandler,
  getBenefitsHandler,
  getBenefitHandler,
  updateBenefitHandler,
  toggleActivationHandler,
  getRemindersHandler,
  getStatsHandler,
  corsMiddleware
} from './handlers';

const app = new Hono();

app.use('*', corsMiddleware);

app.get('/api/cards', getCardsHandler);
app.get('/api/benefits', getBenefitsHandler);
app.get('/api/benefits/:id', getBenefitHandler);
app.patch('/api/benefits/:id', updateBenefitHandler);
app.patch('/api/benefits/:id/activate', toggleActivationHandler);
app.get('/api/reminders', getRemindersHandler);
app.get('/api/stats', getStatsHandler);

export default app;
