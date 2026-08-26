import path from 'node:path';
import { fileURLToPath } from 'node:url';
import nunjucks from 'nunjucks';
import { getHttpError } from '../lib/errors.mjs';

const viewsDir = path.dirname(fileURLToPath(import.meta.url));
const templatesDir = path.join(viewsDir, 'templates');

const loader = new nunjucks.FileSystemLoader(templatesDir, {
    noCache: process.env.NODE_ENV !== 'production'
});

const environment = new nunjucks.Environment(loader, {
    autoescape: true,
    lstripBlocks: true,
    trimBlocks: true
});

export function renderHome({ site, umami, tools, repositories }) {
    const repositoryIndex = createRepositoryIndex(repositories);

    const visibleTools = tools.slice(0, site.homeToolCount);

    const presentedTools = visibleTools.map((tool) => {
        return presentTool(tool, repositoryIndex);
    });

    const toolRepositories = new Set();

    for (const tool of tools) {
        if (!tool.repository) {
            continue;
        }

        const repoName = repositoryName(tool.repository);

        if (repoName) {
            toolRepositories.add(repoName);
        }
    }

    const presentedRepositories = [];

    for (const repository of repositories) {
        if (repository.fork || repository.archived) {
            continue;
        }

        const repositoryName = repository.name.toLowerCase();

        if (toolRepositories.has(repositoryName)) {
            continue;
        }

        presentedRepositories.push(presentRepository(repository));

        if (presentedRepositories.length >= site.latestRepositoryCount) {
            break;
        }
    }

    return render('pages/home.njk', {
        site: presentSite(site),
        umami,
        page: createPage(site, {
            title: site.siteName,
            heading: site.siteName,
            description: `Useful tools and code by ${site.ownerName}`,
            headerText: site.description
        }),
        tools: presentedTools,
        repositories: presentedRepositories,
        hasRepositories: presentedRepositories.length > 0
    });
}

export function renderTools({ site, umami, tools, repositories }) {
    const repositoryIndex = createRepositoryIndex(repositories);
    const presentedTools = tools.map((tool) => {
        return presentTool(tool, repositoryIndex);
    });

    return render('pages/tools.njk', {
        site: presentSite(site),
        umami,
        page: createPage(site, {
            title: 'tools',
            heading: 'tools',
            path: 'tools',
            description: `Useful tools and utilities by ${site.ownerName}.`,
            headerText: 'A collection of useful tools and small projects.'
        }),
        tools: presentedTools
    });
}

export function renderPrivacy({ site, umami, privacy }) {
    const title = privacy.meta.title || 'privacy policy';
    const heading = privacy.meta.heading || 'privacy policy';
    const headerText =
        privacy.meta.description || 'Information about how this website handles your data.';

    const updatedAt = privacy.meta.updated || '';
    const updatedLabel = formatDate(updatedAt);

    const sections = privacy.sections.map((section) => {
        return {
            ...section,
            title: section.title.toLowerCase()
        };
    });

    return render('pages/privacy.njk', {
        site: presentSite(site),
        umami,
        page: createPage(site, {
            title,
            heading,
            path: 'privacy',
            description: `Privacy policy for ${site.siteName} and its tools.`,
            headerText
        }),
        privacy: {
            ...privacy,
            sections,
            updatedAt,
            updatedLabel
        }
    });
}

function escapeXml(value) {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&apos;');
}

export function renderSitemap({ site, githubTools }) {
    const toolUrls = Array.from(githubTools.keys()).map(
        (key) => `/tools/${encodeURIComponent(key)}`
    );
    const urls = ['/', '/tools', '/privacy', ...toolUrls];

    const uniqueUrls = [...new Set(urls)];

    const entries = uniqueUrls.map((pathname) => {
        const loc = new URL(pathname, site.siteUrl).href;

        return `  <url>
    <loc>${escapeXml(loc)}</loc>
  </url>`;
    });

    return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join('\n')}
</urlset>
`;
}

export function renderRobotsTxt({ site }) {
    return `User-agent: *
Disallow:

Sitemap: ${site.siteUrl}/sitemap.xml`;
}

export function renderError({ site, umami }, status) {
    const error = getHttpError(status);

    return render('pages/error.njk', {
        site: presentSite(site),
        umami,
        page: createPage(site, {
            title: `${error.status} ${error.name}`,
            heading: `${error.name} :(`,
            path: `error/${error.status}`,
            description: error.description,
            headerText: error.description
        }),
        error
    });
}

function render(template, data) {
    return environment.render(template, data);
}

function createPage(site, values) {
    const siteName = site.siteName.toLowerCase();
    const title = String(values.title).toLowerCase();
    const heading = String(values.heading).toLowerCase();
    const pathLabel = String(values.path || '').toLowerCase();
    const documentTitle = title === siteName ? siteName : `${title} | ${siteName}`;

    return {
        title,
        heading,
        path: pathLabel,
        documentTitle,
        description: values.description,
        headerText: values.headerText
    };
}

function presentSite(site) {
    return {
        ...site,
        siteName: site.siteName.toLowerCase(),
        siteUrl: site.siteUrl.toLowerCase()
    };
}

function createRepositoryIndex(repositories) {
    const index = new Map();

    for (const repository of repositories) {
        if (repository.name) {
            index.set(repository.name.toLowerCase(), repository);
        }

        if (repository.fullName) {
            index.set(repository.fullName.toLowerCase(), repository);
        }
    }

    return index;
}

function repositoryName(repository) {
    if (!repository) {
        return '';
    }

    return repository
        .replace(/\.git$/i, '')
        .split(/[/:]/)
        .at(-1)
        .toLowerCase();
}

function presentTool(tool, repositoryIndex) {
    const repository = findToolRepository(tool, repositoryIndex);
    const updatedAt = repository?.pushedAt || '';

    return {
        ...tool,
        label: String(tool.label || '').toLowerCase(),
        url: toolUrl(tool),
        updatedAt,
        updatedLabel: formatDate(updatedAt)
    };
}

function findToolRepository(tool, repositoryIndex) {
    if (!tool.repository) {
        return null;
    }

    const fullName = String(tool.repository)
        .replace(/\.git$/i, '')
        .toLowerCase();
    const directMatch = repositoryIndex.get(fullName);

    if (directMatch) {
        return directMatch;
    }

    const segments = fullName.split(/[/:]/);
    const name = segments.at(-1) || '';

    return repositoryIndex.get(name) || null;
}

function toolUrl(tool) {
    if (tool.kind === 'github') {
        return `/tools/${encodeURIComponent(tool.slug)}`;
    }

    return tool.url;
}

function presentRepository(repository) {
    return {
        ...repository,
        label: repository.language || 'repository'
    };
}

function formatDate(value) {
    if (!value) {
        return '';
    }

    const date = new Date(value);

    if (Number.isNaN(date.valueOf())) {
        return '';
    }

    const formatter = new Intl.DateTimeFormat('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });

    return formatter.format(date);
}
