import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const sourceDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(sourceDir, '..');

export async function loadConfig() {
    const sitePath = path.join(rootDir, 'content/site.json');
    const toolsPath = path.join(rootDir, 'content/tools.json');

    const [siteRaw, toolsRaw] = await Promise.all([
        fs.readFile(sitePath, 'utf8'),
        fs.readFile(toolsPath, 'utf8')
    ]);

    const site = JSON.parse(siteRaw);
    const tools = JSON.parse(toolsRaw);
    validateTools(tools);

    return {
        rootDir,
        site,
        tools,
        publicDir: path.join(rootDir, 'public'),
        toolCacheDir: path.resolve(process.env.TOOL_CACHE_DIR || path.join(rootDir, 'tool-cache')),
        umami: {
            websiteId: process.env.UMAMI_WEBSITE_ID || '',
            scriptUrl: process.env.UMAMI_SCRIPT_URL || '',
            recorderScriptUrl: process.env.UMAMI_RECORDER_SCRIPT_URL || '',
            dataAttributes: parseUmamiDataAttributes(process.env.UMAMI_DATA_ATTRIBUTES || '')
        }
    };
}

function parseUmamiDataAttributes(value) {
    if (!value.trim()) {
        return {};
    }

    const attributes = {};

    for (const entry of value.split(',')) {
        const trimmed = entry.trim();

        if (!trimmed) {
            continue;
        }

        const separatorIndex = trimmed.indexOf('=');

        if (separatorIndex === -1) {
            throw new Error(`Invalid UMAMI_DATA_ATTRIBUTES entry: ${trimmed}. Expected key=value`);
        }

        const key = trimmed.slice(0, separatorIndex).trim();
        const attributeValue = trimmed.slice(separatorIndex + 1).trim();

        if (!key) {
            throw new Error(`Invalid UMAMI_DATA_ATTRIBUTES entry: ${trimmed}. Key cannot be empty`);
        }

        attributes[key] = attributeValue;
    }

    return attributes;
}

function validateTools(tools) {
    if (!Array.isArray(tools)) {
        throw new Error('content/tools.json must contain an array');
    }

    const slugs = new Set();

    for (const tool of tools) {
        validateTool(tool, slugs);
        slugs.add(tool.slug);
    }
}

function validateTool(tool, slugs) {
    if (!/^[a-z0-9][a-z0-9-]*$/.test(tool.slug || '')) {
        throw new Error(`Invalid tool slug: ${tool.slug || '<missing>'}`);
    }

    if (slugs.has(tool.slug)) {
        throw new Error(`Duplicate tool slug: ${tool.slug}`);
    }

    if (!['github', 'link'].includes(tool.kind)) {
        throw new Error(`Invalid tool kind for ${tool.slug}`);
    }

    if (tool.kind === 'github' && !tool.repository) {
        throw new Error(`Missing repository for ${tool.slug}`);
    }

    if (tool.kind === 'link' && !tool.url) {
        throw new Error(`Missing URL for ${tool.slug}`);
    }

    if (tool.sitePath && path.isAbsolute(tool.sitePath)) {
        throw new Error(`sitePath must be relative for ${tool.slug}`);
    }

    const sitePathParts = (tool.sitePath || '').split(/[\\/]/);
    if (sitePathParts.includes('..')) {
        throw new Error(`sitePath cannot contain .. for ${tool.slug}`);
    }
}
