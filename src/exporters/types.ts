// Intermediate Representation — format-agnostic game data (SugarCube exporter input)

export interface GameData {
  id: string;
  title: string;
  author: string;
  variables: IRVariable[];
  passages: Passage[];
  startPassage: string;
}

export interface IRVariable {
  name: string;
  type: 'number' | 'boolean' | 'string';
  initial: number | boolean | string;
}

export interface Passage {
  id: string;
  sceneId: string;
  label?: string;
  blocks: IRBlock[];
}

export type IRBlock =
  | IRParagraphBlock
  | IRChoiceBlock
  | IRSetBlock
  | IRIfBlock
  | IRGotoSceneBlock
  | IRGotoBlock
  | IRStatChartBlock
  | IREndingBlock
  | IRPageBreakBlock
  | IRLineBreakBlock;

export interface IRParagraphBlock { kind: 'paragraph'; text: string }
export interface IRSetBlock { kind: 'set'; name: string; op: string; expr: string }
export interface IRChoiceBlock { kind: 'choice'; options: IRChoiceOption[] }
export interface IRIfBlock { kind: 'if'; branches: IRIfBranch[] }
export interface IRGotoSceneBlock { kind: 'goto_scene'; scene: string; label?: string }
export interface IRGotoBlock { kind: 'goto'; passageId: string }
export interface IRStatChartBlock { kind: 'stat_chart'; fields: IRStatChartField[] }
export interface IREndingBlock { kind: 'ending' }
export interface IRPageBreakBlock { kind: 'page_break' }
export interface IRLineBreakBlock { kind: 'line_break' }

export interface IRChoiceOption {
  text: string;
  condition: string | null;
  conditionType: 'selectable' | 'if_hide' | null;
  blocks: IRBlock[];
}

export interface IRIfBranch {
  condition: string | null;
  blocks: IRBlock[];
}

export interface IRStatChartField {
  display: 'text' | 'percent';
  variable: string;
  label: string;
  maxVariable?: string;
}
