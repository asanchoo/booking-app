import 'dotenv/config';
import app from './src/app.js';
import { initBot } from './src/services/telegramService.js';
import { initReminderCron } from './src/services/reminderService.js';

const port = Number(process.env.PORT) || 3001;

app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
  initBot();
  initReminderCron();
});

