import path from 'node:path';

const TYPES = new Map([
    ['.css', 'text/css; charset=utf-8'],
    ['.gif', 'image/gif'],
    ['.html', 'text/html; charset=utf-8'],
    ['.ico', 'image/x-icon'],
    ['.jpeg', 'image/jpeg'],
    ['.jpg', 'image/jpeg'],
    ['.js', 'text/javascript; charset=utf-8'],
    ['.json', 'application/json; charset=utf-8'],
    ['.mjs', 'text/javascript; charset=utf-8'],
    ['.png', 'image/png'],
    ['.svg', 'image/svg+xml; charset=utf-8'],
    ['.txt', 'text/plain; charset=utf-8'],
    ['.webmanifest', 'application/manifest+json; charset=utf-8'],
    ['.webp', 'image/webp'],
    ['.woff', 'font/woff'],
    ['.woff2', 'font/woff2']
]);

export function contentType(filePath) {
    const extension = path.extname(filePath).toLowerCase();

    return TYPES.get(extension) || 'application/octet-stream';
}

export function send(res, status, body, headers = {}) {
    const payload = Buffer.isBuffer(body) ? body : Buffer.from(String(body));

    res.writeHead(status, {
        'Content-Length': payload.length,
        'X-Content-Type-Options': 'nosniff',
        ...headers
    });

    res.end(payload);
}

export function sendHtml(res, status, html, headers = {}) {
    send(res, status, html, {
        'Content-Type': 'text/html; charset=utf-8',
        ...headers
    });
}

export function redirect(res, location, status = 308) {
    res.writeHead(status, {
        Location: location,
        'Content-Length': '0'
    });

    res.end();
}
