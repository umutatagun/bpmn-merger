import type { DiffEntry, DiffStatus } from './types';

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

function normalizeOuterHTML(el: Element): string {
  const s = new XMLSerializer();
  return s.serializeToString(el).replace(/\s+/g, ' ').trim();
}

export function parseBpmn(xml: string): Document {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'application/xml');
  const err = doc.querySelector('parsererror');
  if (err) throw new Error('Invalid BPMN XML: ' + err.textContent);
  return doc;
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
      status = normalizeOuterHTML(baseEl) === normalizeOuterHTML(newEl)
        ? 'unchanged'
        : 'modified';
    } else if (newEl) {
      status = 'added';
    } else {
      status = 'removed';
    }

    const el = newEl || baseEl!;
    entries.push({
      id,
      tagName: localName(el),
      name: el.getAttribute('name') || id,
      status,
      baseOuterHTML: baseEl ? new XMLSerializer().serializeToString(baseEl) : null,
      newOuterHTML: newEl ? new XMLSerializer().serializeToString(newEl) : null,
    });
  }

  // Sort: changed items first, then by id
  const order: Record<DiffStatus, number> = { added: 0, modified: 1, removed: 2, unchanged: 3 };
  entries.sort((a, b) => order[a.status] - order[b.status] || a.id.localeCompare(b.id));

  return entries;
}
