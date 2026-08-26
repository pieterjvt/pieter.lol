import { escapeAttribute } from './html.mjs';

function prefixRootUrl(value, basePath) {
    if (!value.startsWith('/') || value.startsWith('//')) {
        return value;
    }

    if (value === basePath || value.startsWith(`${basePath}/`)) {
        return value;
    }

    return `${basePath}${value}`;
}

export function rewriteCssRootUrls(css, basePath) {
    let output = css.replace(
        /url\(\s*(["']?)\/(?!\/)([^)'"\s]+)\1\s*\)/gi,
        (_match, quote, value) => {
            return `url(${quote}${basePath}/${value}${quote})`;
        }
    );

    output = output.replace(
        /(@import\s+)(["'])\/(?!\/)([^"']+)\2/gi,
        (_match, lead, quote, value) => {
            return `${lead}${quote}${basePath}/${value}${quote}`;
        }
    );

    return output;
}

export function rewriteJsRootUrls(javascript, basePath) {
    return javascript.replace(/(["'`])\/(?!\/)([^"'`\r\n]*?)\1/g, (match, quote, value) => {
        const alreadyScoped = value.startsWith(`${basePath.slice(1)}/`);

        if (!value || alreadyScoped) {
            return match;
        }

        return `${quote}${basePath}/${value}${quote}`;
    });
}

function rewriteSrcset(value, basePath) {
    const candidates = value.split(',');
    const rewrittenCandidates = candidates.map((candidate) => {
        const trimmed = candidate.trim();
        if (!trimmed) {
            return trimmed;
        }

        const [url, ...descriptor] = trimmed.split(/\s+/);
        const rewritten = prefixRootUrl(url, basePath);

        return [rewritten, ...descriptor].join(' ');
    });

    return rewrittenCandidates.join(', ');
}

export function rewriteToolHtml(html, basePath, umami = {}) {
    let result = html.replace(
        /\b(href|src|action|poster)=(["'])([^"']*)\2/gi,
        (match, attribute, quote, value) => {
            const rewritten = prefixRootUrl(value, basePath);

            if (rewritten === value) {
                return match;
            }

            return `${attribute}=${quote}${rewritten}${quote}`;
        }
    );

    result = result.replace(/\bsrcset=(["'])([^"']*)\1/gi, (match, quote, value) => {
        const rewritten = rewriteSrcset(value, basePath);

        if (rewritten === value) {
            return match;
        }

        return `srcset=${quote}${rewritten}${quote}`;
    });

    result = result.replace(/<style\b([^>]*)>([\s\S]*?)<\/style>/gi, (_match, attributes, css) => {
        const rewritten = rewriteCssRootUrls(css, basePath);
        return `<style${attributes}>${rewritten}</style>`;
    });

    result = result.replace(/\bstyle=(["'])([^"']*)\1/gi, (match, quote, css) => {
        const rewritten = rewriteCssRootUrls(css, basePath);

        if (rewritten === css) {
            return match;
        }

        return `style=${quote}${rewritten}${quote}`;
    });

    const shouldInjectUmami =
        umami.scriptUrl && umami.websiteId && !result.includes('data-website-id=');

    if (!shouldInjectUmami) {
        return result;
    }

    const scriptUrl = escapeAttribute(umami.scriptUrl);
    const websiteId = escapeAttribute(umami.websiteId);
    const tag = `<script defer src="${scriptUrl}" data-website-id="${websiteId}"></script>`;

    if (/<\/head>/i.test(result)) {
        return result.replace(/<\/head>/i, `${tag}\n</head>`);
    }

    return `${tag}\n${result}`;
}
