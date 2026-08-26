import fs from 'node:fs/promises';
import path from 'node:path';
import nunjucks from 'nunjucks';

const root = path.resolve('src/views');

async function findTemplates(directory) {
    const entries = await fs.readdir(directory, {
        withFileTypes: true
    });

    const templates = [];

    for (const entry of entries) {
        const entryPath = path.join(directory, entry.name);

        if (entry.isDirectory()) {
            const nested = await findTemplates(entryPath);
            templates.push(...nested);
            continue;
        }

        if (entry.name.endsWith('.njk')) {
            templates.push(entryPath);
        }
    }

    return templates;
}

const templates = await findTemplates(root);

for (const file of templates) {
    const source = await fs.readFile(file, 'utf8');

    nunjucks.precompileString(source, {
        name: path.relative(root, file)
    });
}

console.log(`Checked ${templates.length} Nunjucks templates.`);
