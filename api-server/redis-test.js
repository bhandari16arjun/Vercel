const Redis = require('ioredis');
require('dotenv').config();

const redisUrl = process.env.REDIS_URL;
console.log('Testing connection (TLS + Port 36379) to:', redisUrl);

const redis = new Redis(redisUrl, {
    tls: { rejectUnauthorized: false },
    connectTimeout: 10000
});

redis.on('connect', async () => {
    console.log('Successfully connected to Redis!');
    try {
        const result = await redis.ping();
        console.log('Ping result:', result);
        process.exit(0);
    } catch (err) {
        console.error('Command failed:', err);
        process.exit(1);
    }
});

redis.on('error', (err) => {
    console.error('Redis connection failed:', err);
    process.exit(1);
});
