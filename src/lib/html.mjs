const HTML_REPLACEMENTS = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
};

export function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (character) => {
        return HTML_REPLACEMENTS[character];
    });
}

export function escapeAttribute(value) {
    return escapeHtml(value);
}

export function slugify(value) {
    let slug = String(value).toLowerCase().trim();
    slug = slug.replace(/[^a-z0-9]+/g, '-');
    slug = slug.replace(/^-|-$/g, '');

    return slug;
}
