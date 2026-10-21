import { randomUUID } from 'node:crypto';
import 'dotenv/config';
import Redis from 'ioredis';

const testRunId = randomUUID().slice(0, 8);
const testPrefix = `test:cache:${testRunId}`;

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

let connectionError;
redis.on('error', (err) => {
  connectionError = err;
});

// Helper utilities mimicking RedisService
async function getCache(key) {
  const data = await redis.get(key);
  return data ? JSON.parse(data) : null;
}

async function setCache(key, data, ttlSeconds = 60) {
  await redis.set(key, JSON.stringify(data), 'EX', ttlSeconds);
}

async function delCache(key) {
  await redis.del(key);
}

async function delByPattern(pattern) {
  const keys = await redis.keys(pattern);
  if (keys && keys.length > 0) {
    await redis.del(...keys);
  }
}

// Track test results
let passedTests = 0;
let totalTests = 0;

function assert(condition, message) {
  totalTests++;
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
  passedTests++;
  console.log(`  ✓ ${message}`);
}

async function runCacheTests() {
  console.log(`\n========================================`);
  console.log(`  AMRUTAM API - REDIS CACHING TEST SUITE`);
  console.log(`  Run ID: ${testRunId}`);
  console.log(`========================================\n`);

  // --- 1. Connection Test ---
  console.log(`[1/5] Testing Redis Connection & PING...`);
  await redis.connect();
  const pong = await redis.ping();
  assert(pong === 'PONG', 'Redis responded with PONG');

  // --- 2. Basic Key-Value & JSON Serialization ---
  console.log(`\n[2/5] Testing Basic Cache Operations (Get, Set, TTL, Del)...`);
  const simpleKey = `${testPrefix}:sample`;
  const samplePayload = {
    id: 101,
    name: 'Dr. Jane Smith',
    specialization: 'Ayurveda',
    rating: 4.9,
    tags: ['herbal', 'panchakarma'],
  };

  await setCache(simpleKey, samplePayload, 10);
  const fetched = await getCache(simpleKey);
  assert(fetched !== null, 'Cache entry was successfully retrieved');
  assert(fetched.name === 'Dr. Jane Smith', 'Payload name matches stored object');
  assert(fetched.tags.length === 2, 'Array serialization preserved');

  const ttl = await redis.ttl(simpleKey);
  assert(ttl > 0 && ttl <= 10, `TTL is properly set (${ttl}s remaining)`);

  await delCache(simpleKey);
  const afterDelete = await getCache(simpleKey);
  assert(afterDelete === null, 'Cache key successfully deleted and returns null');

  // --- 3. Doctor Availability Slots Cache (Cache-Aside & Pattern Invalidation) ---
  console.log(`\n[3/5] Testing Doctor Availability Slots Caching (Cache-Aside Flow)...`);
  const doctorId = `doc-${testRunId}`;
  const dateKey = '2026-10-22';
  const slotCacheKey = `cache:slots:${doctorId}:${dateKey}`;

  const mockSlots = [
    {
      slot_id: `slot-1-${testRunId}`,
      doctor_id: doctorId,
      start_time: '2026-10-22T09:00:00Z',
      end_time: '2026-10-22T09:30:00Z',
      status: 'AVAILABLE',
    },
    {
      slot_id: `slot-2-${testRunId}`,
      doctor_id: doctorId,
      start_time: '2026-10-22T10:00:00Z',
      end_time: '2026-10-22T10:30:00Z',
      status: 'AVAILABLE',
    },
  ];

  // 3a. Cache Miss -> Set Cache
  let cachedSlots = await getCache(slotCacheKey);
  assert(cachedSlots === null, 'Initial read is a Cache Miss (expected)');

  const startTime = Date.now();
  await setCache(slotCacheKey, mockSlots, 120);
  const writeDurationMs = Date.now() - startTime;
  console.log(`    (Cache populated in ${writeDurationMs}ms)`);

  // 3b. Cache Hit
  const hitStartTime = Date.now();
  cachedSlots = await getCache(slotCacheKey);
  const hitDurationMs = Date.now() - hitStartTime;
  assert(cachedSlots !== null, 'Subsequent read is a Cache Hit');
  assert(cachedSlots.length === 2, 'Cached slots count matches');
  assert(cachedSlots[0].status === 'AVAILABLE', 'Slot status matches');
  console.log(`    (Cache hit response retrieved in ${hitDurationMs}ms)`);

  // 3c. Targeted Invalidation (When slot is booked or modified)
  console.log(`    -> Simulating slot booking & targeted cache eviction...`);
  await delByPattern(`cache:slots:${doctorId}:*`);
  const afterEviction = await getCache(slotCacheKey);
  assert(
    afterEviction === null,
    'Targeted pattern eviction cleared doctor slots cache',
  );

  // --- 4. Doctor Directory Cache Invalidation ---
  console.log(`\n[4/5] Testing Doctor Directory List Caching...`);
  const dirCacheKey = `cache:doctors:list:${testRunId}`;
  const mockDirectory = [
    { doctor_id: `doc-1`, specialization: 'Kayachikitsa' },
    { doctor_id: `doc-2`, specialization: 'Shalya Tantra' },
  ];

  await setCache(dirCacheKey, mockDirectory, 600);
  const dirCached = await getCache(dirCacheKey);
  assert(dirCached !== null, 'Doctor directory list cached successfully');
  assert(dirCached.length === 2, 'Doctor directory contains expected entries');

  await delCache(dirCacheKey);
  const dirAfterDel = await getCache(dirCacheKey);
  assert(dirAfterDel === null, 'Doctor directory cache evicted on doctor profile update');

  // --- 5. Atomic Slot Reservation Hold (SET NX EX) ---
  console.log(`\n[5/5] Testing Atomic Reservation Hold (Concurrency Guard)...`);
  const slotHoldKey = `slot:hold:slot-100-${testRunId}`;
  const patient1Id = 'patient-alice';
  const patient2Id = 'patient-bob';

  // Patient 1 acquires hold
  const hold1 = await redis.set(slotHoldKey, patient1Id, 'EX', 10, 'NX');
  assert(hold1 === 'OK', 'Patient 1 successfully acquired atomic slot hold');

  // Patient 2 attempts to acquire the same hold while held
  const hold2 = await redis.set(slotHoldKey, patient2Id, 'EX', 10, 'NX');
  assert(
    hold2 === null,
    'Patient 2 hold attempt rejected (prevented double-booking race condition)',
  );

  const currentHolder = await redis.get(slotHoldKey);
  assert(currentHolder === patient1Id, 'Slot hold owner is verified as Patient 1');

  // Release hold (e.g. after payment or cancellation)
  await redis.del(slotHoldKey);
  const afterRelease = await redis.get(slotHoldKey);
  assert(afterRelease === null, 'Slot hold released successfully');

  console.log(`\n----------------------------------------`);
  console.log(`  ALL ${passedTests}/${totalTests} REDIS CACHE TESTS PASSED!`);
  console.log(`----------------------------------------\n`);
}

try {
  await runCacheTests();
} catch (err) {
  const failure = connectionError ?? err;
  console.error(`\n❌ Redis Caching Test Failed: ${failure.message}\n`);
  process.exitCode = 1;
} finally {
  // Teardown test keys
  try {
    if (redis.status === 'ready') {
      const keys = await redis.keys(`${testPrefix}*`);
      if (keys.length) {
        await redis.del(...keys);
      }
    }
  } catch {}
  redis.disconnect();
}
