import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createRequestHandler } from '../src/app.mjs';

async function withServer(handler, callback) {
    const server = http.createServer(handler);

    await new Promise((resolve) => {
        server.listen(0, '127.0.0.1', resolve);
    });

    const { port } = server.address();

    try {
        await callback(`http://127.0.0.1:${port}`);
    } finally {
        await new Promise((resolve) => {
            server.close(resolve);
        });
    }
}

test('SSR pages and mirrored tool route work', async () => {
    const root = await createSiteFixture();
    const config = createConfig(root);
    const githubCache = createGitHubCache();

    await withServer(
        createRequestHandler({
            config,
            githubCache
        }),
        async (base) => {
            await assertHomePage(base);
            await assertSitemap(base);
            await assertToolsPage(base);
            await assertMirroredTool(base);
            await assertErrorPages(base);
        }
    );
});

test('mirrored tools cannot escape through links', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'site-link-test-'));

    await fs.mkdir(path.join(root, 'content'), {
        recursive: true
    });
    await fs.mkdir(path.join(root, 'public'), {
        recursive: true
    });
    await fs.mkdir(path.join(root, 'tool-cache/demo'), {
        recursive: true
    });
    await fs.mkdir(path.join(root, 'secret-dir'), {
        recursive: true
    });

    await fs.writeFile(path.join(root, 'content/privacy.md'), '## Overview\n\nHello.');
    await fs.writeFile(path.join(root, 'secret-dir/secret.txt'), 'secret');

    const linkType = process.platform === 'win32' ? 'junction' : 'dir';

    await fs.symlink(
        path.join(root, 'secret-dir'),
        path.join(root, 'tool-cache/demo/leak'),
        linkType
    );

    const config = createConfig(root);

    await withServer(
        createRequestHandler({
            config,
            githubCache: {
                get: async () => []
            }
        }),
        async (base) => {
            const response = await fetch(`${base}/tools/demo/leak/secret.txt`);

            assert.equal(response.status, 404);
        }
    );
});

test('unexpected application errors render the generic 500 page', async () => {
    const root = await createSiteFixture();
    const config = createConfig(root);
    const originalError = console.error;

    console.error = () => {};

    try {
        await withServer(
            createRequestHandler({
                config,
                githubCache: {
                    get: async () => {
                        throw new Error('private failure detail');
                    }
                }
            }),
            async (base) => {
                const response = await fetch(`${base}/`);
                const html = await response.text();

                assert.equal(response.status, 500);
                assert.match(response.headers.get('content-type'), /^text\/html/);
                assert.match(html, /<h1>internal server error :\(<\/h1>/);
                assert.match(html, /An unexpected server error occurred\./);
                assert.doesNotMatch(html, /private failure detail/);
            }
        );
    } finally {
        console.error = originalError;
    }
});

async function createSiteFixture() {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'site-test-'));

    await fs.mkdir(path.join(root, 'content'), {
        recursive: true
    });
    await fs.mkdir(path.join(root, 'public/assets/css'), {
        recursive: true
    });
    await fs.mkdir(path.join(root, 'tool-cache/demo/assets'), {
        recursive: true
    });
    await fs.mkdir(path.join(root, 'tool-cache/demo/nested'), {
        recursive: true
    });

    await fs.writeFile(
        path.join(root, 'content/privacy.md'),
        [
            '---',
            'title: Privacy',
            'heading: privacy',
            'description: Privacy text.',
            '---',
            '',
            '## Overview',
            '',
            'Hello.'
        ].join('\n')
    );
    await fs.writeFile(path.join(root, 'public/assets/css/site.css'), 'body {}');
    await fs.writeFile(
        path.join(root, 'tool-cache/demo/index.html'),
        '<html><head></head><body><img src="/assets/a.png"></body></html>'
    );
    await fs.writeFile(path.join(root, 'tool-cache/demo/assets/a.png'), Buffer.from([1, 2, 3]));
    await fs.writeFile(
        path.join(root, 'tool-cache/demo/nested/index.html'),
        '<html><body>nested</body></html>'
    );

    return root;
}

function createConfig(root) {
    return {
        rootDir: root,
        publicDir: path.join(root, 'public'),
        toolCacheDir: path.join(root, 'tool-cache'),
        umami: {
            scriptUrl: 'https://analytics.example/script.js',
            websiteId: 'id'
        },
        site: {
            siteName: 'example.test',
            siteUrl: 'https://example.test',
            description: 'Test',
            ownerName: 'Owner',
            email: 'a@example.test',
            githubUrl: 'https://github.com/u',
            linkedinUrl: 'https://linkedin.com/in/u',
            homeToolCount: 4,
            latestRepositoryCount: 5
        },
        tools: [
            {
                kind: 'github',
                slug: 'demo',
                title: 'Demo',
                description: 'D',
                label: 'html',
                repository: 'u/demo',
                sitePath: '.'
            },
            {
                kind: 'link',
                slug: 'external',
                title: 'External',
                description: 'E',
                label: 'html',
                url: 'https://example.test/external',
                repository: 'u/external'
            }
        ]
    };
}

function createGitHubCache() {
    return {
        get: async () => [
            {
                name: 'demo',
                fullName: 'u/demo',
                description: 'Repo',
                url: 'https://github.com/u/demo',
                pushedAt: '2026-01-01T00:00:00Z',
                language: 'JavaScript'
            },
            {
                name: 'external',
                fullName: 'u/external',
                description: 'External repo',
                url: 'https://github.com/u/external',
                pushedAt: '2026-02-02T00:00:00Z',
                language: 'HTML'
            }
        ]
    };
}

async function assertHomePage(base) {
    const response = await fetch(`${base}/`);
    const html = await response.text();

    assert.equal(response.status, 200);
    assert.match(html, /<title>example\.test<\/title>/);
    assert.match(html, /<h2 id="code-heading" class="section-tab">latest code<\/h2>/);
    assert.match(html, /Last updated: 01\/01\/2026/);
}

async function assertSitemap(base) {
    const response = await fetch(`${base}/sitemap.xml`);
    const xml = await response.text();

    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type') ?? '', /^(?:application|text)\/xml\b/);
    assert.match(xml, /<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/);

    const locations = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => match[1]);

    assert.deepEqual(locations, [
        'https://example.test/',
        'https://example.test/tools',
        'https://example.test/privacy',
        'https://example.test/tools/demo'
    ]);
}

async function assertToolsPage(base) {
    const response = await fetch(`${base}/tools`);
    const html = await response.text();

    assert.equal(response.status, 200);
    assert.match(html, /<title>tools \| example\.test<\/title>/);
    assert.match(html, /https:\/\/example\.test\/<\/a>tools/);
    assert.match(html, /Last updated: 01\/01\/2026/);
    assert.match(html, /Last updated: 02\/02\/2026/);
}

async function assertMirroredTool(base) {
    const redirect = await fetch(`${base}/tools/demo`, {
        redirect: 'manual'
    });

    assert.equal(redirect.status, 308);
    assert.equal(redirect.headers.get('location'), '/tools/demo/');

    const nestedRedirect = await fetch(`${base}/tools/demo/nested?x=1`, {
        redirect: 'manual'
    });

    assert.equal(nestedRedirect.status, 308);
    assert.equal(nestedRedirect.headers.get('location'), '/tools/demo/nested/?x=1');

    const tool = await fetch(`${base}/tools/demo/`);
    const toolHtml = await tool.text();

    assert.match(toolHtml, /src="\/tools\/demo\/assets\/a\.png"/);
    assert.match(toolHtml, /data-website-id="id"/);

    const asset = await fetch(`${base}/tools/demo/assets/a.png`);
    const bytes = await asset.arrayBuffer();

    assert.equal(asset.status, 200);
    assert.equal(bytes.byteLength, 3);
}

async function assertErrorPages(base) {
    const notFound = await fetch(`${base}/missing-page`);
    const notFoundHtml = await notFound.text();

    assert.equal(notFound.status, 404);
    assert.match(notFoundHtml, /<title>404 not found \| example\.test<\/title>/);
    assert.match(notFoundHtml, /<h1>not found :\(<\/h1>/);
    assert.match(notFoundHtml, /The requested page could not be found\./);

    const badRequest = await requestRawPath(base, '/%E0%A4%A');

    assert.equal(badRequest.status, 400);
    assert.match(badRequest.body, /<h1>bad request :\(<\/h1>/);
    assert.match(badRequest.body, /The server could not understand the request\./);

    const methodNotAllowed = await fetch(`${base}/`, {
        method: 'POST'
    });
    const methodHtml = await methodNotAllowed.text();

    assert.equal(methodNotAllowed.status, 405);
    assert.equal(methodNotAllowed.headers.get('allow'), 'GET, HEAD');
    assert.match(methodHtml, /<h1>method not allowed :\(<\/h1>/);
    assert.match(methodHtml, /This request method is not allowed for this page\./);
}

function requestRawPath(base, requestPath) {
    const target = new URL(base);

    return new Promise((resolve, reject) => {
        const request = http.request(
            {
                hostname: target.hostname,
                port: target.port,
                path: requestPath,
                method: 'GET'
            },
            (response) => {
                const chunks = [];

                response.on('data', (chunk) => {
                    chunks.push(chunk);
                });
                response.on('end', () => {
                    resolve({
                        status: response.statusCode,
                        headers: response.headers,
                        body: Buffer.concat(chunks).toString('utf8')
                    });
                });
            }
        );

        request.on('error', reject);
        request.end();
    });
}
