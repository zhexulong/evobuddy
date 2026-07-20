// ─── Shared validation ──────────────────────────────────────────────

const VALID_EDGE_KINDS = new Set([
  'spawned-from',
  'requested-by',
  'reviews',
  'guides',
]);

/**
 * Throw if `value` is not a non-empty string.
 * @param {unknown} value
 * @param {string} name
 */
function requireString(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`required non-empty string: ${name}`);
  }
}

// ─── Factory ───────────────────────────────────────────────────────

/**
 * Create an in-memory graph store.
 *
 * @param {{ now?: () => string }} [options]
 * @returns {GraphStore}
 */
export function createGraphStore(options = {}) {
  const { now } = options;

  /** @type {Map<string, ContextNode>} */
  const nodes = new Map();
  /** @type {Map<string, ContextEdge>} */
  const edges = new Map();

  // ── addNode ──────────────────────────────────────────────────────

  /**
   * @param {ContextNodeInput} input
   * @returns {ContextNode}
   */
  function addNode(input) {
    requireString(input.id, 'id');
    requireString(input.platform, 'platform');
    requireString(input.sessionRef, 'sessionRef');
    requireString(input.label, 'label');

    if (nodes.has(input.id)) {
      throw new Error(`duplicate node id: ${input.id}`);
    }

    /** @type {ContextNode} */
    const node = {
      id: input.id,
      platform: input.platform,
      sessionRef: input.sessionRef,
      label: input.label,
      createdAt: now ? now() : new Date().toISOString(),
    };

    // Attach optional fields only when present (forbidden-fields check
    // relies on them being absent from the returned object).
    if (input.rolloutRef !== undefined) {
      node.rolloutRef = input.rolloutRef;
    }
    if (input.turnRef !== undefined) {
      node.turnRef = input.turnRef;
    }
    if (input.manifestId !== undefined) {
      node.manifestId = input.manifestId;
    }

    nodes.set(input.id, node);
    return node;
  }

  // ── addEdge ──────────────────────────────────────────────────────

  /**
   * @param {ContextEdgeInput} input
   * @returns {ContextEdge}
   */
  function addEdge(input) {
    requireString(input.id, 'id');
    requireString(input.kind, 'kind');
    requireString(input.from, 'from');
    requireString(input.to, 'to');

    if (!VALID_EDGE_KINDS.has(input.kind)) {
      throw new Error(`unknown edge kind: ${input.kind}`);
    }

    if (!nodes.has(input.from)) {
      throw new Error(`unknown node id: ${input.from}`);
    }
    if (!nodes.has(input.to)) {
      throw new Error(`unknown node id: ${input.to}`);
    }

    if (edges.has(input.id)) {
      throw new Error(`duplicate edge id: ${input.id}`);
    }

    /** @type {ContextEdge} */
    const edge = {
      id: input.id,
      kind: input.kind,
      from: input.from,
      to: input.to,
    };

    edges.set(input.id, edge);
    return edge;
  }

  // ── getNode ──────────────────────────────────────────────────────

  /**
   * @param {string} id
   * @returns {ContextNode | undefined}
   */
  function getNode(id) {
    return nodes.get(id);
  }

  // ── toJSON ───────────────────────────────────────────────────────

  /**
   * Returns a snapshot of current nodes and edges in insertion order.
   * @returns {{ nodes: ContextNode[], edges: ContextEdge[] }}
   */
  function toJSON() {
    return {
      nodes: [...nodes.values()],
      edges: [...edges.values()],
    };
  }

  return { addNode, addEdge, getNode, toJSON };
}

// ─── Type definitions (JSDoc only) ─────────────────────────────────

/**
 * @typedef {object} ContextNode
 * @property {string} id
 * @property {string} platform
 * @property {string} sessionRef
 * @property {string} [rolloutRef]
 * @property {string} [turnRef]
 * @property {string} label
 * @property {string} createdAt
 * @property {string} [manifestId]
 */

/**
 * @typedef {object} ContextNodeInput
 * @property {string} id
 * @property {string} platform
 * @property {string} sessionRef
 * @property {string} [rolloutRef]
 * @property {string} [turnRef]
 * @property {string} label
 * @property {string} [manifestId]
 */

/**
 * @typedef {object} ContextEdge
 * @property {string} id
 * @property {'spawned-from' | 'requested-by' | 'reviews' | 'guides'} kind
 * @property {string} from
 * @property {string} to
 */

/**
 * @typedef {object} ContextEdgeInput
 * @property {string} id
 * @property {'spawned-from' | 'requested-by' | 'reviews' | 'guides'} kind
 * @property {string} from
 * @property {string} to
 */

/**
 * @typedef {object} GraphStore
 * @property {(input: ContextNodeInput) => ContextNode} addNode
 * @property {(input: ContextEdgeInput) => ContextEdge} addEdge
 * @property {(id: string) => ContextNode | undefined} getNode
 * @property {() => { nodes: ContextNode[], edges: ContextEdge[] }} toJSON
 */
