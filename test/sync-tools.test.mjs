import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(testDir, '..');

test('tool sync shallow-clones a static repository', async () => {
    const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'tool-sync-test-'));
    const source = path.join(temp, 'source');
    const cache = path.join(temp, 'cache');

    await fs.mkdir(source);
    await run('git', ['init', '-b', 'main'], source);
    await fs.writeFile(path.join(source, 'index.html'), '<!doctype html><title>fixture</title>');
    await run('git', ['add', '.'], source);
    await run(
        'git',
        ['-c', 'user.name=Test', '-c', 'user.email=test@example.com', 'commit', '-m', 'fixture'],
        source
    );

    const configPath = path.join(temp, 'tools.json');
    const config = [
        {
            kind: 'github',
            slug: 'fixture',
            title: 'Fixture',
            description: 'Fixture',
            label: 'html',
            repository: `file://${source}`,
            ref: 'main',
            sitePath: '.'
        }
    ];

    await fs.writeFile(configPath, JSON.stringify(config, null, 4));

    await run(process.execPath, ['scripts/sync-tools.mjs'], rootDir, {
        TOOLS_CONFIG_PATH: configPath,
        TOOL_CACHE_DIR: cache
    });

    const indexPath = path.join(cache, 'fixture/index.html');
    const gitPath = path.join(cache, 'fixture/.git');

    assert.equal(await fs.readFile(indexPath, 'utf8'), '<!doctype html><title>fixture</title>');
    await assert.rejects(fs.access(gitPath));
});

function run(command, args, cwd, env = {}) {
    return new Promise((resolve, reject) => {
        const child = spawn(command, args, {
            cwd,
            env: {
                ...process.env,
                ...env
            },
            stdio: ['ignore', 'pipe', 'pipe']
        });
        let stderr = '';

        child.stderr.on('data', (chunk) => {
            stderr += chunk;
        });
        child.on('error', reject);
        child.on('exit', (code) => {
            if (code === 0) {
                resolve();
                return;
            }

            reject(new Error(`${command} failed with ${code}: ${stderr}`));
        });
    });
}
