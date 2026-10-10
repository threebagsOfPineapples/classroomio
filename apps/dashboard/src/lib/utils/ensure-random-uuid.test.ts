import assert from 'node:assert/strict';
import test from 'node:test';
import { ensureRandomUuid } from './ensure-random-uuid';

test('keeps the native UUID implementation', () => {
  const nativeRandomUuid = globalThis.crypto.randomUUID;
  ensureRandomUuid();
  assert.equal(globalThis.crypto.randomUUID, nativeRandomUuid);
});

test('generates valid independent UUIDs using Web Crypto when randomUUID is unavailable', (context) => {
  const originalDescriptor = Object.getOwnPropertyDescriptor(globalThis.crypto, 'randomUUID');
  Object.defineProperty(globalThis.crypto, 'randomUUID', { value: undefined, configurable: true, writable: true });
  context.after(() => {
    if (originalDescriptor) {
      Object.defineProperty(globalThis.crypto, 'randomUUID', originalDescriptor);
    } else {
      Reflect.deleteProperty(globalThis.crypto, 'randomUUID');
    }
  });
  const randomValues = context.mock.method(globalThis.crypto, 'getRandomValues');
  ensureRandomUuid();
  const firstUuid = globalThis.crypto.randomUUID();
  const secondUuid = globalThis.crypto.randomUUID();
  const uuidV4Pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
  assert.match(firstUuid, uuidV4Pattern);
  assert.match(secondUuid, uuidV4Pattern);
  assert.notEqual(firstUuid, secondUuid);
  assert.equal(randomValues.mock.calls.length, 2);
});
