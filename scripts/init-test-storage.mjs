import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { setTimeout } from 'node:timers/promises';

assert.equal(process.env.OBJECT_STORAGE_ENDPOINT, 'http://minio:9000');
assert.equal(new URL(process.env.DATABASE_URL).pathname, '/train_test119');

const require = createRequire(new URL('../apps/api/package.json', import.meta.url));
const { S3Client, ListBucketsCommand, CreateBucketCommand, PutBucketPolicyCommand } = require('@aws-sdk/client-s3');
const client = new S3Client({
  endpoint: process.env.OBJECT_STORAGE_ENDPOINT,
  region: 'us-east-1',
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.OBJECT_STORAGE_ACCESS_KEY_ID,
    secretAccessKey: process.env.OBJECT_STORAGE_SECRET_ACCESS_KEY
  }
});

let existingBuckets;
for (let attempt = 0; attempt < 30; attempt += 1) {
  try {
    const result = await client.send(new ListBucketsCommand({}));
    existingBuckets = new Set(result.Buckets.map((bucket) => bucket.Name));
    break;
  } catch (error) {
    if (attempt === 29) throw error;

    await setTimeout(1000);
  }
}
for (const bucket of ['videos', 'documents', 'media']) {
  if (!existingBuckets.has(bucket)) await client.send(new CreateBucketCommand({ Bucket: bucket }));
}
const policy = JSON.stringify({
  Version: '2012-10-17',
  Statement: [{ Effect: 'Allow', Principal: '*', Action: ['s3:GetObject'], Resource: ['arn:aws:s3:::media/*'] }]
});
await client.send(new PutBucketPolicyCommand({ Bucket: 'media', Policy: policy }));
client.destroy();
console.log('Test storage ready: private videos/documents, public media.');
