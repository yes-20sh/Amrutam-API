import { randomUUID } from 'node:crypto';
import 'dotenv/config';
import Redis from 'ioredis';

const runId = randomUUID();
const queueKey = `redis-smoke-test:${runId}:queue`;
const lockKey = `redis-smoke-test:${runId}:slot-lock`;
const jobCount = 20;
const workerCount = 5;
const contenderCount = 25;
const processingDelayMs = 25;

const redisUrl = process.env.REDIS_URL;
const redisOptions = {
  connectTimeout: 5000,
  enableReadyCheck: true,
  lazyConnect: true,
  maxRetriesPerRequest: 1,
  retryStrategy: null,
  tls: redisUrl?.startsWith('rediss://')
    ? { rejectUnauthorized: false }
    : undefined,
};

const redis = redisUrl
  ? new Redis(redisUrl, redisOptions)
  : new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: Number.parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD || undefined,
      ...redisOptions,
    });
let redisError;

redis.on('error', (error) => {
  redisError = error;
});

async function testQueue() {
  const jobs = Array.from({ length: jobCount }, (_, index) => `job-${index + 1}`);
  await redis.lpush(queueKey, ...jobs);

  let activeWorkers = 0;
  let maxConcurrentWorkers = 0;
  const dequeuedJobs = [];
  const processedJobs = [];

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (true) {
        const job = await redis.rpop(queueKey);
        if (job === null) return;

        dequeuedJobs.push(job);
        activeWorkers += 1;
        maxConcurrentWorkers = Math.max(maxConcurrentWorkers, activeWorkers);
        await new Promise((resolve) => setTimeout(resolve, processingDelayMs));
        processedJobs.push(job);
        activeWorkers -= 1;
      }
    }),
  );

  const processedSet = new Set(processedJobs);
  if (
    processedJobs.length !== jobCount ||
    processedSet.size !== jobCount ||
    dequeuedJobs.some((job, index) => job !== jobs[index]) ||
    maxConcurrentWorkers !== workerCount
  ) {
    throw new Error(
      `Queue check failed: processed ${processedJobs.length}/${jobCount} unique jobs with max concurrency ${maxConcurrentWorkers}/${workerCount}`,
    );
  }

  console.log(
    `PASS queue: processed ${processedJobs.length} FIFO jobs with ${maxConcurrentWorkers} concurrent workers`,
  );
}

async function testSlotLockConcurrency() {
  const contenders = Array.from(
    { length: contenderCount },
    (_, index) => `contender-${index + 1}`,
  );
  const results = await Promise.all(
    contenders.map((contender) =>
      redis.set(lockKey, contender, 'EX', 30, 'NX'),
    ),
  );
  const winners = results.filter((result) => result === 'OK');
  const lockOwner = await redis.get(lockKey);

  if (winners.length !== 1 || lockOwner === null) {
    throw new Error(
      `Concurrency check failed: expected one lock winner, got ${winners.length}`,
    );
  }

  console.log(
    `PASS concurrency: exactly 1 of ${contenderCount} contenders acquired the slot lock`,
  );
}

try {
  await redis.connect();
  const pong = await redis.ping();
  if (pong !== 'PONG') {
    throw new Error(`Unexpected Redis PING response: ${pong}`);
  }

  console.log('PASS connection: Redis responded to PING');
  await testQueue();
  await testSlotLockConcurrency();
  console.log('Redis smoke test passed.');
} catch (error) {
  const failure = redisError ?? error;
  const details = failure.errors
    ?.map((item) => item.code ?? item.message)
    .join(', ');
  console.error(
    `Redis smoke test failed: ${details || failure.message || failure.code || 'Unknown error'}`,
  );
  process.exitCode = 1;
} finally {
  try {
    if (redis.status === 'ready') {
      await redis.del(queueKey, lockKey);
    }
  } finally {
    redis.disconnect();
  }
}
