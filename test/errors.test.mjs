import assert from 'node:assert/strict';
import test from 'node:test';
import { getHttpError } from '../src/lib/errors.mjs';

test('HTTP errors use standard names and useful descriptions', () => {
    assert.deepEqual(getHttpError(401), {
        status: 401,
        name: 'unauthorized',
        description: 'Authentication is required to access this page.'
    });

    assert.deepEqual(getHttpError(503), {
        status: 503,
        name: 'service unavailable',
        description: 'The service is temporarily unavailable.'
    });
});

test('invalid error statuses fall back to 500', () => {
    const error = getHttpError('invalid');

    assert.equal(error.status, 500);
    assert.equal(error.name, 'internal server error');
});
