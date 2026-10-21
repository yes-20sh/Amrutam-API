import { randomUUID } from 'node:crypto';
import 'dotenv/config';
import Redis from 'ioredis';

const runId = randomUUID().slice(0, 8);
const queueKey = `redis-smoke-test:${runId}:queue`;
const lockKey = `redis-smoke-test:${runId}:slot-lock`;
const cacheKey = `redis-smoke-test:${runId}:cache`;

const jobCount = 20;
const workerCount = 5;
const contenderCount = 25;
const processingDelayMs = 15;

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

let totalTests = 0;
let passedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
  passedTests++;
  console.log(`  ✓ ${message}`);
}

async function testConnection() {
  console.log(`[1/4] Testing Redis Connection & PING...`);
  const start = Date.now();
  await redis.connect();
  const pong = await redis.ping();
  const latency = Date.now() - start;

  assert(pong === 'PONG', `Redis responded with PONG (${latency}ms roundtrip)`);
}

async function testQueuePipeline() {
  console.log(`\n[2/4] Testing FIFO Queue Processing (${jobCount} jobs, ${workerCount} concurrent workers)...`);
  const jobs = Array.from({ length: jobCount }, (_, index) => `job-${index + 1}`);
  await redis.lpush(queueKey, ...jobs);

  let activeWorkers = 0;
  let maxConcurrentWorkers = 0;
  const dequeuedJobs = [];
  const processedJobs = [];

  const queueStartTime = Date.now();

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

  const durationMs = Date.now() - queueStartTime;
  const processedSet = new Set(processedJobs);

  assert(
    processedJobs.length === jobCount,
    `All ${jobCount} jobs processed successfully (${durationMs}ms total)`,
  );
  assert(
    processedSet.size === jobCount,
    `Zero duplicate job executions (unique jobs: ${processedSet.size})`,
  );
  assert(
    maxConcurrentWorkers === workerCount,
    `Worker pool reached maximum target concurrency (${maxConcurrentWorkers}/${workerCount})`,
  );
}

async function testSlotLockConcurrency() {
  console.log(`\n[3/4] Testing Distributed Slot Lock Mutex (${contenderCount} concurrent contenders)...`);
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

  assert(
    winners.length === 1,
    `Exactly 1 of ${contenderCount} concurrent contenders acquired the lock (atomic SET NX)`,
  );
  assert(
    lockOwner !== null && lockOwner.startsWith('contender-'),
    `Verified lock owner is recorded as ${lockOwner}`,
  );

  const ttl = await redis.ttl(lockKey);
  assert(ttl > 0 && ttl <= 30, `Lock has active TTL safety net (${ttl}s remaining)`);

  await redis.del(lockKey);
  const afterDel = await redis.get(lockKey);
  assert(afterDel === null, 'Lock released successfully');
}

async function testCacheReadWrite() {
  console.log(`\n[4/4] Testing In-Memory Cache Read/Write Throughput...`);
  const payload = {
    service: 'amrutam-api',
    status: 'healthy',
    features: ['caching', 'concurrency', 'sagas'],
    timestamp: Date.now(),
  };

  const writeStart = Date.now();
  await redis.set(cacheKey, JSON.stringify(payload), 'EX', 60);
  const writeMs = Date.now() - writeStart;

  const readStart = Date.now();
  const raw = await redis.get(cacheKey);
  const readMs = Date.now() - readStart;

  const parsed = JSON.parse(raw);
  assert(parsed.service === 'amrutam-api', `Cache retrieved valid payload (Write: ${writeMs}ms, Read: ${readMs}ms)`);
  assert(parsed.features.length === 3, 'Complex array serialization intact');

  await redis.del(cacheKey);
  const postDel = await redis.get(cacheKey);
  assert(postDel === null, 'Cache key clean-up confirmed');
}

console.log(`\n========================================`);
console.log(`  AMRUTAM API - REDIS INFRASTRUCTURE TEST`);
console.log(`  Run ID: ${runId}`);
console.log(`========================================\n`);

try {
  await testConnection();
  await testQueuePipeline();
  await testSlotLockConcurrency();
  await testCacheReadWrite();

  console.log(`\n----------------------------------------`);
  console.log(`  ALL ${passedTests}/${totalTests} REDIS SMOKE TESTS PASSED!`);
  console.log(`----------------------------------------\n`);
} catch (error) {
  const failure = redisError ?? error;
  const details = failure.errors
    ?.map((item) => item.code ?? item.message)
    .join(', ');
  console.error(
    `\n❌ Redis smoke test failed: ${details || failure.message || failure.code || 'Unknown error'}\n`,
  );
  process.exitCode = 1;
} finally {
  try {
    if (redis.status === 'ready') {
      await redis.del(queueKey, lockKey, cacheKey);
    }
  } finally {
    redis.disconnect();
  }
}
