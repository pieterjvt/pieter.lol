import assert from 'node:assert/strict';
import test from 'node:test';
import { parsePrivacyMarkdown } from '../src/lib/markdown.mjs';

test('privacy markdown becomes structured sections', () => {
    const source = [
        '---',
        'title: Privacy',
        '---',
        '',
        '## Analytics',
        '',
        'Read [details](/privacy?a=1&b=2).'
    ].join('\n');

    const result = parsePrivacyMarkdown(source);

    assert.equal(result.meta.title, 'Privacy');
    assert.equal(result.sections[0].id, 'analytics');
    assert.equal(
        result.sections[0].html,
        '<p>Read <a href="/privacy?a=1&amp;b=2">details</a>.</p>\n'
    );
});
