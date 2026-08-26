import MarkdownIt from 'markdown-it';
import { slugify } from './html.mjs';

const markdown = new MarkdownIt({
    html: false,
    linkify: false,
    typographer: false
});

function parseFrontMatter(source) {
    if (!source.startsWith('---\n')) {
        return [{}, source];
    }

    const end = source.indexOf('\n---\n', 4);

    if (end === -1) {
        return [{}, source];
    }

    const meta = {};
    const lines = source.slice(4, end).split('\n');

    for (const line of lines) {
        const separator = line.indexOf(':');

        if (separator === -1) {
            continue;
        }

        const key = line.slice(0, separator).trim();
        const value = line.slice(separator + 1).trim();

        if (key) {
            meta[key] = value;
        }
    }

    return [meta, source.slice(end + 5)];
}

function getInlineText(token) {
    if (!token.children) {
        return token.content;
    }

    return token.children
        .filter((child) => {
            return child.type === 'text' || child.type === 'code_inline';
        })
        .map((child) => child.content)
        .join('');
}

export function parsePrivacyMarkdown(source) {
    const normalized = source.replaceAll('\r\n', '\n');
    const [meta, body] = parseFrontMatter(normalized);

    const tokens = markdown.parse(body, {});
    const sections = [];

    let current = null;
    let sectionTokens = [];

    const flushSection = () => {
        if (!current) {
            return;
        }

        current.html = markdown.renderer.render(sectionTokens, markdown.options, {});

        sections.push(current);

        current = null;
        sectionTokens = [];
    };

    for (let i = 0; i < tokens.length; i += 1) {
        const token = tokens[i];

        if (token.type === 'heading_open' && token.tag === 'h2') {
            flushSection();

            const inline = tokens[i + 1];

            if (!inline || inline.type !== 'inline') {
                continue;
            }

            const title = getInlineText(inline);

            current = {
                title,
                id: slugify(title),
                html: ''
            };

            // Skip:
            // heading_open
            // inline
            // heading_close
            i += 2;

            continue;
        }

        if (current) {
            sectionTokens.push(token);
        }
    }

    flushSection();

    return {
        meta,
        sections
    };
}
