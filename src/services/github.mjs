export class GitHubRepositoryCache {
    constructor({
        username,
        ttlMs = 300000,
        token = '',
        exclude = [],
        fetchImpl = fetch,
        now = Date.now
    }) {
        this.username = username;
        this.ttlMs = ttlMs;
        this.token = token;
        this.exclude = new Set(exclude);
        this.fetchImpl = fetchImpl;
        this.now = now;
        this.items = [];
        this.etag = '';
        this.lastAttemptAt = 0;
        this.refreshPromise = null;
        this.timer = null;
    }

    async get() {
        const expired = !this.lastAttemptAt || this.now() - this.lastAttemptAt >= this.ttlMs;

        if (expired) {
            await this.refresh();
        }

        return this.items;
    }

    async refresh() {
        if (this.refreshPromise) {
            return this.refreshPromise;
        }

        this.refreshPromise = this.#refresh().finally(() => {
            this.refreshPromise = null;
        });

        return this.refreshPromise;
    }

    async #refresh() {
        const headers = {
            Accept: 'application/vnd.github+json',
            'User-Agent': 'pieter-lol-site',
            'X-GitHub-Api-Version': '2022-11-28'
        };

        if (this.token) {
            headers.Authorization = `Bearer ${this.token}`;
        }

        if (this.etag) {
            headers['If-None-Match'] = this.etag;
        }

        try {
            const url = this.#repositoriesUrl();
            const response = await this.fetchImpl(url, {
                headers,
                signal: AbortSignal.timeout(8000)
            });

            if (response.status === 304) {
                this.lastAttemptAt = this.now();
                return this.items;
            }

            if (!response.ok) {
                throw new Error(`GitHub API returned ${response.status}`);
            }

            const repositories = await response.json();
            this.items = repositories
                .filter((repository) => {
                    return !this.exclude.has(repository.name);
                })
                .map((repository) => {
                    return this.#presentRepository(repository);
                });

            this.etag = response.headers.get('etag') || '';
            this.lastAttemptAt = this.now();

            return this.items;
        } catch (error) {
            this.lastAttemptAt = this.now();
            console.error(`GitHub refresh failed: ${error.message}`);

            return this.items;
        }
    }

    #repositoriesUrl() {
        const username = encodeURIComponent(this.username);
        const query = 'type=owner&sort=pushed&direction=desc&per_page=100';

        return `https://api.github.com/users/${username}/repos?${query}`;
    }

    #presentRepository(repository) {
        const fallbackFullName = `${this.username}/${repository.name}`;

        return {
            name: repository.name,
            fullName: repository.full_name || fallbackFullName,
            description: repository.description || 'No description provided.',
            url: repository.html_url,
            pushedAt: repository.pushed_at,
            language: repository.language || 'repository',
            fork: repository.fork || false,
            archived: repository.archived || false
        };
    }

    start() {
        if (this.timer) {
            return;
        }

        void this.refresh();
        this.timer = setInterval(() => {
            void this.refresh();
        }, this.ttlMs);
        this.timer.unref?.();
    }

    stop() {
        if (this.timer) {
            clearInterval(this.timer);
        }

        this.timer = null;
    }
}
