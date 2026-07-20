/**
 * Create a deterministic kebab-case identifier from a prefix and seed string.
 * Lowercases both inputs, replaces non-alphanumeric characters in the seed
 * with hyphens, collapses consecutive hyphens, and strips leading/trailing hyphens.
 *
 * @param {string} prefix
 * @param {string} seed
 * @returns {string}
 */
export function makeId(prefix, seed) {
  const normPrefix = prefix.toLowerCase().trim();

  const normSeed = seed
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');

  return normSeed ? `${normPrefix}-${normSeed}` : normPrefix;
}

/**
 * Create a deterministic run identifier from an optional Date.
 *
 * @param {Date} [now]
 * @returns {string}
 */
export function makeRunId(now) {
  const iso = (now || new Date()).toISOString();
  return makeId('run', iso);
}
