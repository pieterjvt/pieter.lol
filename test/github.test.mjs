import assert from 'node:assert/strict';
import test from 'node:test';
import { GitHubRepositoryCache } from '../src/services/github.mjs';

function repositoryResponse() {
    return new Response(
        JSON.stringify([
            {
                name: 'demo',
                full_name: 'u/demo',
                description: 'Demo',
                html_url: 'https://github.com/u/demo',
                pushed_at: '2026-01-01T00:00:00Z',
                language: 'JavaScript',
                fork: false,
                archived: false
            }
        ]),
        {
            status: 200,
            headers: {
                etag: 'abc',
                'content-type': 'application/json'
            }
        }
    );
}

test('GitHub cache reuses data within TTL', async () => {
    let calls = 0;
    let now = 1000;

    const fetchImpl = async () => {
        calls += 1;
        return repositoryResponse();
    };

    const cache = new GitHubRepositoryCache({
        username: 'u',
        ttlMs: 300000,
        fetchImpl,
        now: () => now
    });

    const first = await cache.get();
    const second = await cache.get();

    assert.equal(first.length, 1);
    assert.equal(second.length, 1);
    assert.equal(first[0].fullName, 'u/demo');
    assert.equal(calls, 1);

    now += 300001;
    await cache.get();

    assert.equal(calls, 2);
});

test('GitHub outage serves stale data and backs off until the next TTL', async () => {
    let calls = 0;
    let now = 1000;
    let online = true;
    const originalError = console.error;

    console.error = () => {};

    try {
        const fetchImpl = async () => {
            calls += 1;

            if (!online) {
                throw new Error('GitHub unavailable');
            }

            return repositoryResponse();
        };

        const cache = new GitHubRepositoryCache({
            username: 'u',
            ttlMs: 300000,
            fetchImpl,
            now: () => now
        });

        const initial = await cache.get();
        assert.equal(initial.length, 1);

        online = false;
        now += 300001;

        const stale = await cache.get();
        const repeated = await cache.get();

        assert.equal(stale.length, 1);
        assert.equal(repeated.length, 1);
        assert.equal(calls, 2);

        now += 300001;
        await cache.get();

        assert.equal(calls, 3);
    } finally {
        console.error = originalError;
    }
});

test('GitHub outage without cached data returns an empty list', async () => {
    let calls = 0;
    let now = 1000;
    const originalError = console.error;

    console.error = () => {};

    try {
        const cache = new GitHubRepositoryCache({
            username: 'u',
            ttlMs: 300000,
            fetchImpl: async () => {
                calls += 1;
                throw new Error('GitHub unavailable');
            },
            now: () => now
        });

        const first = await cache.get();
        const second = await cache.get();

        assert.deepEqual(first, []);
        assert.deepEqual(second, []);
        assert.equal(calls, 1);

        now += 300001;
        await cache.get();

        assert.equal(calls, 2);
    } finally {
        console.error = originalError;
    }
});
