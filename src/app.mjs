import fs from 'node:fs/promises';
import path from 'node:path';
import { contentType, redirect, send, sendHtml } from './lib/http.mjs';
import { parsePrivacyMarkdown } from './lib/markdown.mjs';
import { rewriteCssRootUrls, rewriteJsRootUrls, rewriteToolHtml } from './lib/tool-rewrite.mjs';
import {
    renderError,
    renderSitemap,
    renderRobotsTxt,
    renderHome,
    renderPrivacy,
    renderTools
} from './views/index.mjs';

async function readSafeFile(baseDir, relativePath) {
    const resolvedBase = path.resolve(baseDir);
    const resolved = path.resolve(resolvedBase, relativePath);
    const isInsideBase =
        resolved === resolvedBase || resolved.startsWith(`${resolvedBase}${path.sep}`);

    if (!isInsideBase) {
        return null;
    }

    try {
        const baseReal = await fs.realpath(resolvedBase);
        const stat = await fs.stat(resolved);
        const candidate = stat.isDirectory() ? path.join(resolved, 'index.html') : resolved;
        const candidateReal = await fs.realpath(candidate);
        const isInsideRealBase =
            candidateReal === baseReal || candidateReal.startsWith(`${baseReal}${path.sep}`);

        if (!isInsideRealBase) {
            return null;
        }

        return {
            path: candidateReal,
            data: await fs.readFile(candidateReal),
            wasDirectory: stat.isDirectory()
        };
    } catch {
        return null;
    }
}

function cacheHeader(filePath) {
    const cacheable = /\.(?:css|js|mjs|png|jpe?g|gif|svg|webp|woff2?|ico)$/i.test(filePath);

    return cacheable ? 'public, max-age=3600' : 'no-cache';
}

export function createRequestHandler({ config, githubCache }) {
    const githubTools = new Map();
    let privacyPromise;

    for (const tool of config.tools) {
        if (tool.kind === 'github') {
            githubTools.set(tool.slug, tool);
        }
    }

    const getPrivacy = () => {
        if (!privacyPromise) {
            const privacyPath = path.join(config.rootDir, 'content/privacy.md');

            privacyPromise = fs.readFile(privacyPath, 'utf8').then(parsePrivacyMarkdown);
        }

        return privacyPromise;
    };

    return async function requestHandler(req, res) {
        let url;
        let pathname;

        try {
            url = new URL(req.url || '/', 'http://localhost');
            pathname = decodeURIComponent(url.pathname);
        } catch {
            return sendErrorPage(res, 400, config);
        }

        try {
            if (!isSupportedMethod(req.method)) {
                return sendErrorPage(res, 405, config, {
                    Allow: 'GET, HEAD'
                });
            }

            if (pathname === '/healthz') {
                return send(res, 200, JSON.stringify({ ok: true }), {
                    'Content-Type': 'application/json; charset=utf-8',
                    'Cache-Control': 'no-store'
                });
            }

            if (pathname === '/sitemap.xml') {
                const sitemap = renderSitemap({
                    ...config,
                    githubTools
                });

                return send(res, 200, sitemap, {
                    'Content-Type': 'application/xml; charset=utf-8',
                    'Cache-Control': 'public, max-age=3600'
                });
            }

            if (pathname === '/robots.txt') {
                const robotsTxt = renderRobotsTxt(config);

                return send(res, 200, robotsTxt, {
                    'Contet-Type': 'text/plain; charset=utf-8',
                    'Cache-Control': 'public, max-age=86400'
                });
            }

            if (pathname === '/') {
                const repositories = await githubCache.get();

                return sendHtml(
                    res,
                    200,
                    renderHome({
                        ...config,
                        repositories
                    })
                );
            }

            if (pathname === '/tools') {
                return redirect(res, `/tools/${url.search}`);
            }

            if (pathname === '/tools/') {
                const repositories = await githubCache.get();
                return sendHtml(
                    res,
                    200,
                    renderTools({
                        ...config,
                        repositories
                    })
                );
            }

            if (pathname === '/privacy') {
                return redirect(res, `/privacy/${url.search}`);
            }

            if (pathname === '/privacy/') {
                const privacy = await getPrivacy();
                return sendHtml(
                    res,
                    200,
                    renderPrivacy({
                        ...config,
                        privacy
                    })
                );
            }

            if (pathname.startsWith('/tools/')) {
                return serveMirroredTool({
                    res,
                    url,
                    pathname,
                    config,
                    githubTools
                });
            }

            const file = await readSafeFile(config.publicDir, pathname.slice(1));

            if (file) {
                return send(res, 200, file.data, {
                    'Content-Type': contentType(file.path),
                    'Cache-Control': cacheHeader(file.path)
                });
            }

            return sendErrorPage(res, 404, config);
        } catch (error) {
            console.error(error);

            return sendErrorPage(res, 500, config);
        }
    };
}

function isSupportedMethod(method) {
    return method === 'GET' || method === 'HEAD';
}

function sendErrorPage(res, status, config, headers = {}) {
    try {
        return sendHtml(res, status, renderError(config, status), headers);
    } catch (error) {
        console.error(`Error page render failed: ${error.message}`);

        return send(res, status, `HTTP ${status}`, {
            'Content-Type': 'text/plain; charset=utf-8',
            ...headers
        });
    }
}

async function serveMirroredTool({ res, url, pathname, config, githubTools }) {
    const pathParts = pathname.split('/');
    const slug = pathParts[2];
    const rest = pathParts.slice(3);
    const tool = githubTools.get(slug);

    if (!tool) {
        return sendErrorPage(res, 404, config);
    }

    const siteRoot = path.resolve(config.toolCacheDir, tool.slug, tool.sitePath || '.');
    const relative = rest.join('/') || '.';
    const file = await readSafeFile(siteRoot, relative);

    if (!file) {
        return sendErrorPage(res, 404, config);
    }

    if (file.wasDirectory && !pathname.endsWith('/')) {
        return redirect(res, `${pathname}/${url.search}`);
    }

    const type = contentType(file.path);
    const basePath = `/tools/${encodeURIComponent(tool.slug)}`;
    let body = file.data;

    if (type.startsWith('text/html')) {
        const html = body.toString('utf8');
        body = Buffer.from(rewriteToolHtml(html, basePath, config.umami));
    } else if (type.startsWith('text/css')) {
        const css = body.toString('utf8');
        body = Buffer.from(rewriteCssRootUrls(css, basePath));
    } else if (type.startsWith('text/javascript')) {
        const javascript = body.toString('utf8');
        body = Buffer.from(rewriteJsRootUrls(javascript, basePath));
    }

    return send(res, 200, body, {
        'Content-Type': type,
        'Cache-Control': cacheHeader(file.path)
    });
}
