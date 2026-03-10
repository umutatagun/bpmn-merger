import type { DiffEntry, SelectionMap, SubSelectionMap } from './types';

const SEMANTIC_TAGS = new Set([
  'task', 'userTask', 'serviceTask', 'sendTask', 'receiveTask', 'manualTask',
  'businessRuleTask', 'scriptTask', 'startEvent', 'endEvent',
  'intermediateCatchEvent', 'intermediateThrowEvent', 'boundaryEvent',
  'exclusiveGateway', 'inclusiveGateway', 'parallelGateway', 'eventBasedGateway',
  'sequenceFlow', 'subProcess', 'callActivity', 'textAnnotation', 'association', 'lane',
]);

export function buildMergedXml(
  baseXml: string,
  newXml: string,
  entries: DiffEntry[],
  selections: SelectionMap,
  subSelections?: SubSelectionMap,
): string {
  try {
  const parser = new DOMParser();
  const serializer = new XMLSerializer();

  const mergedDoc = parser.parseFromString(newXml, 'application/xml');
  const baseDoc = parser.parseFromString(baseXml, 'application/xml');

  const bpmndiNS = 'http://www.omg.org/spec/BPMN/20100524/DI';

  function findProcessElement(doc: Document, id: string): Element | null {
    const all = doc.getElementsByTagName('*');
    for (let i = 0; i < all.length; i++) {
      if (all[i].getAttribute('id') === id) {
        const ns = all[i].namespaceURI || '';
        if (!ns.includes('DI') && !ns.includes('DC')) return all[i];
      }
    }
    return null;
  }

  function findDiElement(doc: Document, elementId: string): Element | null {
    const shapes = doc.getElementsByTagNameNS(bpmndiNS, 'BPMNShape');
    for (let i = 0; i < shapes.length; i++) {
      if (shapes[i].getAttribute('bpmnElement') === elementId) return shapes[i];
    }
    const edges = doc.getElementsByTagNameNS(bpmndiNS, 'BPMNEdge');
    for (let i = 0; i < edges.length; i++) {
      if (edges[i].getAttribute('bpmnElement') === elementId) return edges[i];
    }
    return null;
  }

  function getPlane(doc: Document): Element | null {
    const planes = doc.getElementsByTagNameNS(bpmndiNS, 'BPMNPlane');
    return planes.length > 0 ? planes[0] : null;
  }

  // Build a set of excluded element IDs (added elements user doesn't want)
  const excludedIds = new Set<string>();
  for (const entry of entries) {
    const included = selections[entry.id] ?? false;
    if (entry.status === 'added' && !included) {
      excludedIds.add(entry.id);
    }
  }

  // Also collect IDs of boundaryEvents attached to excluded elements
  // (they should be excluded too)
  for (const entry of entries) {
    if (entry.status !== 'added') continue;
    const newEl = findProcessElement(
      parser.parseFromString(newXml, 'application/xml'),
      entry.id,
    );
    if (newEl) {
      const attachedTo = newEl.getAttribute('attachedToRef');
      if (attachedTo && excludedIds.has(attachedTo)) {
        excludedIds.add(entry.id);
      }
    }
  }

  // Collect child elements of excluded subProcesses recursively
  collectSubProcessChildren(mergedDoc, excludedIds);

  // ── Pass 1: handle added-excluded elements ──
  for (const id of excludedIds) {
    const el = findProcessElement(mergedDoc, id);
    if (el) el.parentNode?.removeChild(el);
    const di = findDiElement(mergedDoc, id);
    if (di) di.parentNode?.removeChild(di);
  }

  // ── Pass 2: fix flows that reference excluded elements ──
  // For each sequenceFlow in the merged doc, check if its sourceRef or targetRef
  // points to an excluded element. If so:
  //   - If the flow existed in BASE (modified), revert it to BASE version
  //   - If the flow is new (only in NEW), remove it
  for (const entry of entries) {
    if (entry.tagName !== 'sequenceFlow') continue;

    const mergedFlow = findProcessElement(mergedDoc, entry.id);
    if (!mergedFlow) continue;

    const sourceRef = mergedFlow.getAttribute('sourceRef');
    const targetRef = mergedFlow.getAttribute('targetRef');

    const referencesExcluded =
      (sourceRef && excludedIds.has(sourceRef)) ||
      (targetRef && excludedIds.has(targetRef));

    if (!referencesExcluded) continue;

    if (entry.status === 'added') {
      // Flow only exists in NEW and references an excluded element → remove
      mergedFlow.parentNode?.removeChild(mergedFlow);
      const di = findDiElement(mergedDoc, entry.id);
      if (di) di.parentNode?.removeChild(di);
    } else if (entry.status === 'modified') {
      // Flow exists in BASE but was modified to point to/from excluded element
      // → revert to BASE version (restores original sourceRef/targetRef)
      const baseFlow = findProcessElement(baseDoc, entry.id);
      if (baseFlow) {
        const imported = mergedDoc.importNode(baseFlow, true);
        mergedFlow.parentNode?.replaceChild(imported, mergedFlow);
        // Revert DI too (waypoints may differ)
        const baseDi = findDiElement(baseDoc, entry.id);
        const mergedDi = findDiElement(mergedDoc, entry.id);
        if (baseDi && mergedDi) {
          const importedDi = mergedDoc.importNode(baseDi, true);
          mergedDi.parentNode?.replaceChild(importedDi, mergedDi);
        }
      }
    }
  }

  // ── Pass 3: also catch any flows NOT in the diff entries ──
  // (flows that the diff didn't detect but still reference excluded elements)
  const allFlows = mergedDoc.getElementsByTagName('*');
  const flowsToCheck: Element[] = [];
  for (let i = 0; i < allFlows.length; i++) {
    const ln = allFlows[i].localName || allFlows[i].nodeName.split(':').pop()!;
    if (ln === 'sequenceFlow') flowsToCheck.push(allFlows[i]);
  }
  for (const flow of flowsToCheck) {
    const sourceRef = flow.getAttribute('sourceRef');
    const targetRef = flow.getAttribute('targetRef');

    const srcExcluded = sourceRef && excludedIds.has(sourceRef);
    const tgtExcluded = targetRef && excludedIds.has(targetRef);

    if (!srcExcluded && !tgtExcluded) continue;

    const flowId = flow.getAttribute('id');
    if (!flowId) continue;

    // Check if BASE has this flow
    const baseFlow = findProcessElement(baseDoc, flowId);
    if (baseFlow) {
      // Revert to BASE
      const imported = mergedDoc.importNode(baseFlow, true);
      flow.parentNode?.replaceChild(imported, flow);
      const baseDi = findDiElement(baseDoc, flowId);
      const mergedDi = findDiElement(mergedDoc, flowId);
      if (baseDi && mergedDi) {
        const importedDi = mergedDoc.importNode(baseDi, true);
        mergedDi.parentNode?.replaceChild(importedDi, mergedDi);
      }
    } else {
      // New flow that references excluded element → remove
      flow.parentNode?.removeChild(flow);
      const di = findDiElement(mergedDoc, flowId);
      if (di) di.parentNode?.removeChild(di);
    }
  }

  // ── Pass 4: fix incoming/outgoing child references on elements ──
  // BPMN elements have <incoming> and <outgoing> child elements that list flow IDs.
  // After removing/reverting flows, clean up stale references.
  // Collect all flow IDs that still exist in merged
  const existingFlowIds = new Set<string>();
  const allMergedEls = mergedDoc.getElementsByTagName('*');
  for (let i = 0; i < allMergedEls.length; i++) {
    const ln = allMergedEls[i].localName || allMergedEls[i].nodeName.split(':').pop()!;
    if (ln === 'sequenceFlow') {
      const fid = allMergedEls[i].getAttribute('id');
      if (fid) existingFlowIds.add(fid);
    }
  }

  // Remove <incoming>/<outgoing> refs that point to non-existent flows
  for (let i = allMergedEls.length - 1; i >= 0; i--) {
    const el = allMergedEls[i];
    const ln = el.localName || el.nodeName.split(':').pop()!;
    if (ln === 'incoming' || ln === 'outgoing') {
      const refId = el.textContent?.trim();
      if (refId && !existingFlowIds.has(refId)) {
        el.parentNode?.removeChild(el);
      }
    }
  }

  // ── Pass 4.5: clean gateway "default" attributes referencing removed flows ──
  const gatewayTags = new Set(['exclusiveGateway', 'inclusiveGateway']);
  const allGatewayEls = mergedDoc.getElementsByTagName('*');
  for (let i = 0; i < allGatewayEls.length; i++) {
    const el = allGatewayEls[i];
    const ln = el.localName || el.nodeName.split(':').pop()!;
    if (!gatewayTags.has(ln)) continue;
    const defaultFlow = el.getAttribute('default');
    if (defaultFlow && !existingFlowIds.has(defaultFlow)) {
      el.removeAttribute('default');
    }
  }

  // ── Pass 5: restore missing <incoming>/<outgoing> refs for reverted flows ──
  // After reverting flows to BASE versions, the target/source elements need
  // their <incoming>/<outgoing> updated if the BASE flow points to them
  for (let i = 0; i < allMergedEls.length; i++) {
    const ln = allMergedEls[i].localName || allMergedEls[i].nodeName.split(':').pop()!;
    if (ln !== 'sequenceFlow') continue;
    const flow = allMergedEls[i];
    const flowId = flow.getAttribute('id');
    const sourceRef = flow.getAttribute('sourceRef');
    const targetRef = flow.getAttribute('targetRef');
    if (!flowId) continue;

    // Ensure source element has <outgoing> for this flow
    if (sourceRef) {
      const srcEl = findProcessElement(mergedDoc, sourceRef);
      if (srcEl && !hasFlowRef(srcEl, 'outgoing', flowId)) {
        addFlowRef(mergedDoc, srcEl, 'outgoing', flowId);
      }
    }
    // Ensure target element has <incoming> for this flow
    if (targetRef) {
      const tgtEl = findProcessElement(mergedDoc, targetRef);
      if (tgtEl && !hasFlowRef(tgtEl, 'incoming', flowId)) {
        addFlowRef(mergedDoc, tgtEl, 'incoming', flowId);
      }
    }
  }

  // ── Pass 6: handle other entry types (modified-excluded, removed-included) ──
  // Also handle sub-selections for modified elements (partial attribute/child merge)
  const REF_TAGS = new Set(['incoming', 'outgoing']);
  for (const entry of entries) {
    const included = selections[entry.id] ?? false;

    if (entry.status === 'modified' && !included) {
      // User chose BASE version — replace element content with BASE version
      const mergedEl = findProcessElement(mergedDoc, entry.id);
      const baseEl = findProcessElement(baseDoc, entry.id);
      if (mergedEl && baseEl) {
        const imported = mergedDoc.importNode(baseEl, true);
        mergedEl.parentNode?.replaceChild(imported, mergedEl);
      }
    }

    // Partial sub-selection merge for modified elements
    if (entry.status === 'modified' && included && subSelections && entry.subChanges) {
      const mergedEl = findProcessElement(mergedDoc, entry.id);
      const baseEl = findProcessElement(baseDoc, entry.id);
      if (mergedEl && baseEl) {
        for (let si = 0; si < entry.subChanges.length; si++) {
          const sc = entry.subChanges[si];
          const key = sc.kind === 'attr'
            ? `${entry.id}::attr::${sc.name}`
            : `${entry.id}::child::${si}`;
          const useNew = subSelections[key] ?? true;
          if (useNew) continue; // merged doc already has NEW version

          if (sc.kind === 'attr') {
            // Revert this attribute to BASE value
            if (sc.baseValue === null) {
              mergedEl.removeAttribute(sc.name);
            } else {
              mergedEl.setAttribute(sc.name, sc.baseValue);
            }
          } else {
            // Revert child element to BASE version
            // Find the matching child in merged (NEW) and replace with BASE
            const mergedChildren = Array.from(mergedEl.children);
            const baseChildren = Array.from(baseEl.children);
            for (const mc of mergedChildren) {
              const tag = mc.localName || mc.nodeName.split(':').pop()!;
              if (REF_TAGS.has(tag)) continue;
              const mcKey = mc.getAttribute('id') || `${tag}`;
              if (sc.kind === 'child' && sc.tag === tag) {
                // Found matching child - check if it's the right one
                const bcMatch = baseChildren.find(bc => {
                  const btag = bc.localName || bc.nodeName.split(':').pop()!;
                  if (btag !== tag) return false;
                  const bkey = bc.getAttribute('id') || btag;
                  return bkey === mcKey || btag === sc.tag;
                });
                if (bcMatch) {
                  const imported = mergedDoc.importNode(bcMatch, true);
                  mergedEl.replaceChild(imported, mc);
                  break;
                } else if (sc.baseSnippet === null) {
                  // Child was added in NEW but sub-selection says use BASE (remove it)
                  mergedEl.removeChild(mc);
                  break;
                }
              }
            }
            // If child only exists in BASE and sub-selection says use BASE, add it
            if (sc.baseSnippet !== null && sc.newSnippet === null) {
              for (const bc of baseChildren) {
                const btag = bc.localName || bc.nodeName.split(':').pop()!;
                if (btag === sc.tag) {
                  mergedEl.appendChild(mergedDoc.importNode(bc, true));
                  break;
                }
              }
            }
          }
        }
      }
    }

    if (entry.status === 'removed' && included) {
      // User wants to keep the removed element — add BASE element + DI
      const baseEl = findProcessElement(baseDoc, entry.id);
      if (baseEl) {
        const processes = mergedDoc.getElementsByTagNameNS(
          'http://www.omg.org/spec/BPMN/20100524/MODEL', 'process'
        );
        const process = processes.length > 0
          ? processes[0]
          : mergedDoc.documentElement;
        process.appendChild(mergedDoc.importNode(baseEl, true));

        const baseDi = findDiElement(baseDoc, entry.id);
        if (baseDi) {
          const plane = getPlane(mergedDoc);
          if (plane) plane.appendChild(mergedDoc.importNode(baseDi, true));
        }
      }
    }
  }

  // ── Pass 7: restore flows from BASE for gateways left with no outgoing/incoming ──
  const allGatewayTagNames = ['exclusiveGateway', 'inclusiveGateway', 'parallelGateway', 'eventBasedGateway'];
  const allElsForGwCheck = mergedDoc.getElementsByTagName('*');
  for (let i = 0; i < allElsForGwCheck.length; i++) {
    const el = allElsForGwCheck[i];
    const ln = el.localName || el.nodeName.split(':').pop()!;
    if (!allGatewayTagNames.includes(ln)) continue;

    const gwId = el.getAttribute('id');
    if (!gwId) continue;

    // Count outgoing refs
    let outgoingCount = 0;
    let incomingCount = 0;
    for (let c = 0; c < el.children.length; c++) {
      const cln = el.children[c].localName || el.children[c].nodeName.split(':').pop()!;
      if (cln === 'outgoing') outgoingCount++;
      if (cln === 'incoming') incomingCount++;
    }

    const baseGw = findProcessElement(baseDoc, gwId);
    if (!baseGw) continue;

    // Restore missing outgoing flows from BASE
    if (outgoingCount === 0) {
      restoreFlowsFromBase('outgoing', baseGw, mergedDoc, baseDoc, findProcessElement, findDiElement, getPlane);
    }

    // Restore missing incoming flows from BASE
    if (incomingCount === 0) {
      restoreFlowsFromBase('incoming', baseGw, mergedDoc, baseDoc, findProcessElement, findDiElement, getPlane);
    }
  }

  // ── Pass 8: clean up lane flowNodeRef entries pointing to removed elements ──
  const allLaneEls = mergedDoc.getElementsByTagName('*');
  // Collect all existing element IDs in merged doc
  const allExistingIds = new Set<string>();
  for (let i = 0; i < allLaneEls.length; i++) {
    const eid = allLaneEls[i].getAttribute('id');
    if (eid) allExistingIds.add(eid);
  }
  for (let i = allLaneEls.length - 1; i >= 0; i--) {
    const el = allLaneEls[i];
    const ln = el.localName || el.nodeName.split(':').pop()!;
    if (ln === 'flowNodeRef') {
      const refId = el.textContent?.trim();
      if (refId && !allExistingIds.has(refId)) {
        el.parentNode?.removeChild(el);
      }
    }
  }

  // ── Pass 9: clean up associations with broken sourceRef/targetRef ──
  const allAssocEls = mergedDoc.getElementsByTagName('*');
  const assocToRemove: Element[] = [];
  for (let i = 0; i < allAssocEls.length; i++) {
    const el = allAssocEls[i];
    const ln = el.localName || el.nodeName.split(':').pop()!;
    if (ln !== 'association') continue;

    const sourceRef = el.getAttribute('sourceRef');
    const targetRef = el.getAttribute('targetRef');

    const srcExists = sourceRef ? findProcessElement(mergedDoc, sourceRef) !== null : true;
    const tgtExists = targetRef ? findProcessElement(mergedDoc, targetRef) !== null : true;

    if (!srcExists || !tgtExists) {
      assocToRemove.push(el);
    }
  }
  for (const assoc of assocToRemove) {
    const assocId = assoc.getAttribute('id');
    assoc.parentNode?.removeChild(assoc);
    if (assocId) {
      const di = findDiElement(mergedDoc, assocId);
      if (di) di.parentNode?.removeChild(di);
    }
  }

  let xml = serializer.serializeToString(mergedDoc);
  if (!xml.startsWith('<?xml')) {
    xml = '<?xml version="1.0" encoding="UTF-8"?>\n' + xml;
  }
  return xml;
  } catch (err) {
    throw new Error(
      `BPMN merge failed: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

function collectSubProcessChildren(doc: Document, excludedIds: Set<string>): void {
  function collectChildren(parent: Element): void {
    for (let i = 0; i < parent.children.length; i++) {
      const child = parent.children[i];
      const ln = child.localName || child.nodeName.split(':').pop()!;
      if (SEMANTIC_TAGS.has(ln)) {
        const childId = child.getAttribute('id');
        if (childId) {
          excludedIds.add(childId);
        }
      }
      // Recurse into nested subProcesses
      if (ln === 'subProcess') {
        collectChildren(child);
      }
    }
  }

  for (const id of [...excludedIds]) {
    const el = findProcessElementInDoc(doc, id);
    if (!el) continue;
    const ln = el.localName || el.nodeName.split(':').pop()!;
    if (ln === 'subProcess') {
      collectChildren(el);
    }
  }
}

function restoreFlowsFromBase(
  direction: 'incoming' | 'outgoing',
  baseGw: Element,
  mergedDoc: Document,
  baseDoc: Document,
  findProcessElement: (doc: Document, id: string) => Element | null,
  findDiElement: (doc: Document, elementId: string) => Element | null,
  getPlane: (doc: Document) => Element | null,
): void {
  const bpmnModelNS = 'http://www.omg.org/spec/BPMN/20100524/MODEL';

  for (let c = 0; c < baseGw.children.length; c++) {
    const child = baseGw.children[c];
    const cln = child.localName || child.nodeName.split(':').pop()!;
    if (cln !== direction) continue;

    const flowId = child.textContent?.trim();
    if (!flowId) continue;

    // Check if this flow already exists in merged doc
    if (findProcessElement(mergedDoc, flowId)) continue;

    // Restore the flow from BASE
    const baseFlow = findProcessElement(baseDoc, flowId);
    if (!baseFlow) continue;

    // Also check target/source element exists or restore it
    const refAttr = direction === 'outgoing' ? 'targetRef' : 'sourceRef';
    const refId = baseFlow.getAttribute(refAttr);
    if (refId && !findProcessElement(mergedDoc, refId)) {
      // Restore the target/source element from BASE
      const baseRefEl = findProcessElement(baseDoc, refId);
      if (baseRefEl) {
        const processes = mergedDoc.getElementsByTagNameNS(bpmnModelNS, 'process');
        const process = processes.length > 0 ? processes[0] : mergedDoc.documentElement;
        process.appendChild(mergedDoc.importNode(baseRefEl, true));

        const baseDi = findDiElement(baseDoc, refId);
        if (baseDi) {
          const plane = getPlane(mergedDoc);
          if (plane) plane.appendChild(mergedDoc.importNode(baseDi, true));
        }
      }
    }

    // Restore the flow itself
    const processes = mergedDoc.getElementsByTagNameNS(bpmnModelNS, 'process');
    const process = processes.length > 0 ? processes[0] : mergedDoc.documentElement;
    process.appendChild(mergedDoc.importNode(baseFlow, true));

    const baseDi = findDiElement(baseDoc, flowId);
    if (baseDi) {
      const plane = getPlane(mergedDoc);
      if (plane) plane.appendChild(mergedDoc.importNode(baseDi, true));
    }

    // Also add the flow ref to the gateway in merged doc
    const mergedGw = findProcessElement(mergedDoc, baseGw.getAttribute('id')!);
    if (mergedGw && !hasFlowRef(mergedGw, direction, flowId)) {
      addFlowRef(mergedDoc, mergedGw, direction, flowId);
    }
  }
}

function findProcessElementInDoc(doc: Document, id: string): Element | null {
  const all = doc.getElementsByTagName('*');
  for (let i = 0; i < all.length; i++) {
    if (all[i].getAttribute('id') === id) {
      const ns = all[i].namespaceURI || '';
      if (!ns.includes('DI') && !ns.includes('DC')) return all[i];
    }
  }
  return null;
}

function hasFlowRef(element: Element, type: 'incoming' | 'outgoing', flowId: string): boolean {
  const children = element.children;
  for (let i = 0; i < children.length; i++) {
    const ln = children[i].localName || children[i].nodeName.split(':').pop()!;
    if (ln === type && children[i].textContent?.trim() === flowId) return true;
  }
  return false;
}

function addFlowRef(doc: Document, element: Element, type: 'incoming' | 'outgoing', flowId: string): void {
  // Create the element in the same namespace as the parent
  const ns = element.namespaceURI;
  const prefix = element.prefix;
  const tagName = prefix ? `${prefix}:${type}` : type;
  const ref = ns ? doc.createElementNS(ns, tagName) : doc.createElement(type);
  ref.textContent = flowId;
  element.appendChild(ref);
}
