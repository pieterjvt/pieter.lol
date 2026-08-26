import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptsDir, '..');
const defaultConfigPath = path.join(rootDir, 'content/tools.json');
const configPath = path.resolve(process.env.TOOLS_CONFIG_PATH || defaultConfigPath);
const defaultTargetRoot = path.join(rootDir, 'tool-cache');
const targetRoot = path.resolve(process.env.TOOL_CACHE_DIR || defaultTargetRoot);

const toolsRaw = await fs.readFile(configPath, 'utf8');
const tools = JSON.parse(toolsRaw);

await fs.mkdir(targetRoot, {
    recursive: true
});

for (const tool of tools) {
    if (tool.kind !== 'github') {
        continue;
    }

    validateTool(tool);
    await syncTool(tool);
}

async function syncTool(tool) {
    const target = path.join(targetRoot, tool.slug);
    await fs.rm(target, {
        recursive: true,
        force: true
    });

    const repository = repositoryUrl(tool.repository);
    const ref = tool.ref || 'main';

    console.log(`Cloning ${tool.repository} into ${tool.slug}`);

    await run('git', [
        'clone',
        '--depth',
        '1',
        '--single-branch',
        '--branch',
        ref,
        repository,
        target
    ]);

    await fs.rm(path.join(target, '.git'), {
        recursive: true,
        force: true
    });

    const siteRoot = path.resolve(target, tool.sitePath || '.');
    const indexPath = path.join(siteRoot, 'index.html');

    try {
        await fs.access(indexPath);
    } catch {
        const relativeIndexPath = path.relative(target, indexPath);
        throw new Error(`${tool.slug} does not contain ${relativeIndexPath}`);
    }
}

function repositoryUrl(repository) {
    const isUrl = repository.includes('://');
    const isSsh = repository.startsWith('git@');

    if (isUrl || isSsh) {
        return repository;
    }

    return `https://github.com/${repository}.git`;
}

function validateTool(tool) {
    if (!/^[a-z0-9][a-z0-9-]*$/.test(tool.slug)) {
        throw new Error(`Invalid tool slug: ${tool.slug}`);
    }

    if (!tool.repository) {
        throw new Error(`Missing repository for ${tool.slug}`);
    }

    if (tool.sitePath && path.isAbsolute(tool.sitePath)) {
        throw new Error(`sitePath must be relative for ${tool.slug}`);
    }

    const sitePathParts = (tool.sitePath || '').split(/[\\/]/);
    if (sitePathParts.includes('..')) {
        throw new Error(`sitePath cannot contain .. for ${tool.slug}`);
    }
}

function run(command, args) {
    return new Promise((resolve, reject) => {
        const child = spawn(command, args, {
            stdio: 'inherit'
        });

        child.on('error', reject);
        child.on('exit', (code) => {
            if (code === 0) {
                resolve();
                return;
            }

            reject(new Error(`${command} exited with ${code}`));
        });
    });
}
