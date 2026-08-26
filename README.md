# pieter.lol

Small server-rendered personal site for tools and recent GitHub repositories. Built using Node.js and Nunjucks.

## Add tools

Tools are configured in `content/tools.json`.

### GitHub-hosted tool

```json
{
    "kind": "github",
    "slug": "spatial-unlocker",
    "title": "Spatial Unlocker",
    "description": "Unlocks Apple Spatial Scene for screenshots.",
    "label": "html/css/js",
    "repository": "pieterjvt/spatial-unlocker",
    "ref": "main",
    "sitePath": "."
}
```

GitHub tools must be static sites with an `index.html` inside `sitePath`.

### External tool

```json
{
    "kind": "link",
    "slug": "rickroll",
    "title": "Rickroll",
    "description": "Auto-play Rick Astley.",
    "label": "html/css/js",
    "url": "https://r.pieter.lol"
}
```

Add `repository` to an external tool to show its latest GitHub push date:

```json
{
    "kind": "link",
    "slug": "example",
    "title": "Example",
    "description": "External tool with repository metadata.",
    "label": "html/css/js",
    "url": "https://example.com",
    "repository": "pieterjvt/example"
}
```

Recent repositories are fetched from the `githubUsername` configured in `content/site.json`. Forks and archived repositories are excluded.

## Local development

Requires Node.js 22 or newer.

```sh
npm ci
npm run tools:sync
npm test
npm start
```

Open `http://localhost:3000`.

`npm run tools:sync` requires Git and network access to GitHub.

## Docker

Build and run locally with Docker Compose:

```sh
cp .env.example .env
docker compose up --build
```

Add Umami values to .env if analytics is wanted.

## Runtime variables

| Variable           | Default        | Purpose                   |
| ------------------ | -------------- | ------------------------- |
| `PORT`             | `3000`         | HTTP port                 |
| `HOST`             | `0.0.0.0`      | Bind address              |
| `UMAMI_SCRIPT_URL` | empty          | Umami script URL          |
| `UMAMI_WEBSITE_ID` | empty          | Umami website ID          |
| `GITHUB_TOKEN`     | empty          | Optional GitHub API token |
| `TOOL_CACHE_DIR`   | `./tool-cache` | Mirrored tool directory   |

## License

[MIT](./LICENSE)
