import { Queue } from 'bullmq';
import appConfig from './src/config/app.config';

async function clearQueue() {
  const redisConfig = appConfig().redis;

  // Ensure port is a number and host/password have defaults
  const host = redisConfig.host || '127.0.0.1';
  const port = Number(redisConfig.port) || 6379;
  const password = redisConfig.password || undefined;

  console.log('Redis config:', { host, port, password: password ? '******' : undefined });

  const mailQueue = new Queue('mail-queue5', {
    connection: {
      host,
      port,
      password,
    },
  });

  try {
    console.log('Clearing mail-queue5...');
    await mailQueue.obliterate({ force: true });
    console.log('Queue cleared successfully.');
  } catch (err) {
    console.error('Error clearing queue:', err);
  } finally {
    await mailQueue.close();
  }
}

// Run the script
clearQueue().catch((err) => {
  console.error('Unexpected error:', err);
});
