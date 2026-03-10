import type { DiffEntry, DiffStatus, SubChange } from './types';

const SEMANTIC_TAGS = new Set([
  'task', 'userTask', 'serviceTask', 'sendTask', 'receiveTask', 'manualTask',
  'businessRuleTask', 'scriptTask', 'startEvent', 'endEvent',
  'intermediateCatchEvent', 'intermediateThrowEvent', 'boundaryEvent',
  'exclusiveGateway', 'inclusiveGateway', 'parallelGateway', 'eventBasedGateway',
  'sequenceFlow', 'subProcess', 'callActivity', 'textAnnotation', 'association', 'lane',
]);

function localName(el: Element): string {
  return el.localName || el.nodeName.split(':').pop()!;
}

function extractSemanticElements(doc: Document): Map<string, Element> {
  const map = new Map<string, Element>();
  const all = doc.getElementsByTagName('*');
  for (let i = 0; i < all.length; i++) {
    const el = all[i];
    const ln = localName(el);
    if (SEMANTIC_TAGS.has(ln)) {
      const id = el.getAttribute('id');
      if (id) map.set(id, el);
    }
  }
  return map;
}

/**
 * Produce a normalized string for comparison that ignores <incoming>/<outgoing>
 * ref children, since those are structural bookkeeping driven by connected flows,
 * not meaningful changes to the element itself.
 */
function semanticFingerprint(el: Element): string {
  const s = new XMLSerializer();
  // Clone so we don't mutate the original DOM
  const clone = el.cloneNode(true) as Element;
  // Remove incoming/outgoing children from the clone
  const toRemove: Element[] = [];
  for (let i = 0; i < clone.children.length; i++) {
    const ln = clone.children[i].localName || clone.children[i].nodeName.split(':').pop()!;
    if (ln === 'incoming' || ln === 'outgoing') {
      toRemove.push(clone.children[i]);
    }
  }
  for (const child of toRemove) {
    clone.removeChild(child);
  }
  return s.serializeToString(clone).replace(/\s+/g, ' ').trim();
}

export function parseBpmn(xml: string): Document {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'application/xml');
  const err = doc.querySelector('parsererror');
  if (err) throw new Error('Invalid BPMN XML: ' + err.textContent);
  return doc;
}

// Tags that are structural refs, not meaningful child content
const REF_TAGS = new Set(['incoming', 'outgoing']);

function computeSubChanges(baseEl: Element, newEl: Element): SubChange[] {
  const changes: SubChange[] = [];
  const s = new XMLSerializer();

  // 1. Compare attributes
  const allAttrNames = new Set<string>();
  for (let i = 0; i < baseEl.attributes.length; i++) allAttrNames.add(baseEl.attributes[i].name);
  for (let i = 0; i < newEl.attributes.length; i++) allAttrNames.add(newEl.attributes[i].name);

  // Skip 'id' since it's the identity key
  allAttrNames.delete('id');

  for (const name of allAttrNames) {
    const bv = baseEl.getAttribute(name);
    const nv = newEl.getAttribute(name);
    if (bv !== nv) {
      changes.push({ kind: 'attr', name, baseValue: bv, newValue: nv });
    }
  }

  // 2. Compare meaningful child elements (skip incoming/outgoing refs)
  const baseChildren = getSemanticChildren(baseEl);
  const newChildren = getSemanticChildren(newEl);

  const allChildKeys = new Set([...baseChildren.keys(), ...newChildren.keys()]);

  for (const key of allChildKeys) {
    const bc = baseChildren.get(key);
    const nc = newChildren.get(key);
    const bcStr = bc ? s.serializeToString(bc).replace(/\s+/g, ' ').trim() : null;
    const ncStr = nc ? s.serializeToString(nc).replace(/\s+/g, ' ').trim() : null;

    if (bcStr !== ncStr) {
      const el = nc || bc!;
      const tag = localName(el);
      const label = el.getAttribute('name') || el.getAttribute('id') || key;
      changes.push({ kind: 'child', tag, label, baseSnippet: bcStr, newSnippet: ncStr });
    }
  }

  return changes;
}

function getSemanticChildren(el: Element): Map<string, Element> {
  const map = new Map<string, Element>();
  for (let i = 0; i < el.children.length; i++) {
    const child = el.children[i];
    const tag = localName(child);
    if (REF_TAGS.has(tag)) continue;
    const key = child.getAttribute('id') || `${tag}[${i}]`;
    map.set(key, child);
  }
  return map;
}

export function diffBpmn(baseXml: string, newXml: string): DiffEntry[] {
  const baseDoc = parseBpmn(baseXml);
  const newDoc = parseBpmn(newXml);

  const baseElements = extractSemanticElements(baseDoc);
  const newElements = extractSemanticElements(newDoc);

  const allIds = new Set([...baseElements.keys(), ...newElements.keys()]);
  const entries: DiffEntry[] = [];

  for (const id of allIds) {
    const baseEl = baseElements.get(id);
    const newEl = newElements.get(id);

    let status: DiffStatus;
    if (baseEl && newEl) {
      status = semanticFingerprint(baseEl) === semanticFingerprint(newEl)
        ? 'unchanged'
        : 'modified';
    } else if (newEl) {
      status = 'added';
    } else {
      status = 'removed';
    }

    const el = newEl || baseEl!;
    const subChanges = status === 'modified' && baseEl && newEl
      ? computeSubChanges(baseEl, newEl)
      : undefined;

    entries.push({
      id,
      tagName: localName(el),
      name: el.getAttribute('name') || id,
      status,
      baseOuterHTML: baseEl ? new XMLSerializer().serializeToString(baseEl) : null,
      newOuterHTML: newEl ? new XMLSerializer().serializeToString(newEl) : null,
      subChanges,
    });
  }

  // Sort: changed items first, then by id
  const order: Record<DiffStatus, number> = { added: 0, modified: 1, removed: 2, unchanged: 3 };
  entries.sort((a, b) => order[a.status] - order[b.status] || a.id.localeCompare(b.id));

  return entries;
}
