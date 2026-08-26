import http from 'node:http';
import { createRequestHandler } from './app.mjs';
import { loadConfig } from './config.mjs';
import { GitHubRepositoryCache } from './services/github.mjs';

const config = await loadConfig();
const githubCache = new GitHubRepositoryCache({
    username: config.site.githubUsername,
    ttlMs: config.site.githubCacheSeconds * 1000,
    token: process.env.GITHUB_TOKEN || '',
    exclude: config.site.excludeRepositories
});

githubCache.start();

const handler = createRequestHandler({
    config,
    githubCache
});
const server = http.createServer(handler);
const host = process.env.HOST || '0.0.0.0';
const port = Number(process.env.PORT || 3000);

server.listen(port, host, () => {
    console.log(`Listening on http://${host}:${port}`);
});

const shutdown = () => {
    githubCache.stop();
    server.close(() => {
        process.exit(0);
    });
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
