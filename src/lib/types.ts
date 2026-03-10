export type DiffStatus = 'unchanged' | 'added' | 'modified' | 'removed';

export interface DiffEntry {
  id: string;
  tagName: string;
  name: string;
  status: DiffStatus;
  baseOuterHTML: string | null;
  newOuterHTML: string | null;
}

export type SelectionMap = Record<string, boolean>;
