import assert from 'node:assert/strict';
import test from 'node:test';
import {
    rewriteCssRootUrls,
    rewriteJsRootUrls,
    rewriteToolHtml
} from '../src/lib/tool-rewrite.mjs';

test('tool HTML rewrites root paths and injects Umami', () => {
    const html = [
        '<html><head><link href="/assets/site.css"></head>',
        '<body><img src="/img/a.png">',
        '<a href="https://example.com/?a=1&amp;b=2">x</a>',
        '</body></html>'
    ].join('');

    const output = rewriteToolHtml(html, '/tools/demo', {
        scriptUrl: 'https://analytics.example/script.js',
        websiteId: 'abc'
    });

    assert.match(output, /href="\/tools\/demo\/assets\/site\.css"/);
    assert.match(output, /src="\/tools\/demo\/img\/a\.png"/);
    assert.match(output, /href="https:\/\/example\.com\/\?a=1&amp;b=2"/);
    assert.match(output, /data-website-id="abc"/);
});

test('tool CSS and JS root paths are scoped', () => {
    const css = rewriteCssRootUrls('a{background:url(/img/a.png)}', '/tools/demo');
    const javascript = rewriteJsRootUrls('fetch("/api/data")', '/tools/demo');

    assert.equal(css, 'a{background:url(/tools/demo/img/a.png)}');
    assert.equal(javascript, 'fetch("/tools/demo/api/data")');
});
