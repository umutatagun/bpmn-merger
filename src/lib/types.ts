export type DiffStatus = 'unchanged' | 'added' | 'modified' | 'removed';

export interface AttrChange {
  kind: 'attr';
  name: string;
  baseValue: string | null;
  newValue: string | null;
}

export interface ChildChange {
  kind: 'child';
  tag: string;
  label: string;
  baseSnippet: string | null;
  newSnippet: string | null;
}

export type SubChange = AttrChange | ChildChange;

export interface DiffEntry {
  id: string;
  tagName: string;
  name: string;
  status: DiffStatus;
  baseOuterHTML: string | null;
  newOuterHTML: string | null;
  subChanges?: SubChange[];
}

export type SelectionMap = Record<string, boolean>;

/**
 * For modified elements: tracks which sub-changes to take from NEW (true) vs BASE (false).
 * Key format: `${elementId}::attr::${attrName}` or `${elementId}::child::${index}`
 */
export type SubSelectionMap = Record<string, boolean>;
