export interface ExportStyle {
  sidebarBg:   string;
  sidebarText: string;
  storyBg:     string;
  storyText:   string;
  accentColor: string;
  barColor:    string;
  fontFamily:  string;
  fontSize:    "small" | "medium" | "large";
}

export const DEFAULT_EXPORT_STYLE: ExportStyle = {
  sidebarBg:   "#1a1c2a",
  sidebarText: "#c8cce8",
  storyBg:     "#0f1117",
  storyText:   "#c8cce8",
  accentColor: "#9eadd4",
  barColor:    "#82c47e",
  fontFamily:  "'Palatino Linotype', Palatino, serif",
  fontSize:    "medium",
};

export type GameProject = {
  id: string;
  title: string;
  author: string;
  scenes: Scene[];
  variables: Variable[];
  achievements: Achievement[];
  nodePositions?: Record<string, { x: number; y: number }>;
  exportStyle?: ExportStyle;
};

export type Scene = {
  id: string;
  filename: string;
  title: string;
  blocks: Block[];
};

export type Variable = {
  id: string;
  name: string;
  type: "number" | "boolean" | "string";
  defaultValue: string | number | boolean;
  description: string;
};

export type Achievement = {
  id: string;
  key: string;
  visibility: "visible" | "hidden";
  points: number;
  title: string;
  beforeText: string;
  afterText: string;
};

export type Block =
  | { kind: "paragraph"; id: string; text: string }
  | { kind: "image"; id: string; src: string; align: "left" | "right" | "center" | "none" }
  | { kind: "choice"; id: string; options: ChoiceOption[] }
  | { kind: "if"; id: string; branches: IfBranch[] }
  | { kind: "set"; id: string; variable: string; operator: "=" | "+=" | "-=" | "*=" | "/="; value: string }
  | { kind: "label"; id: string; name: string }
  | { kind: "goto"; id: string; label: string }
  | { kind: "goto_scene"; id: string; sceneName: string; label: string }
  | { kind: "finish"; id: string }
  | { kind: "ending"; id: string }
  | { kind: "comment"; id: string; text: string }
  | { kind: "stat_chart"; id: string; title: string; entries: StatChartEntry[] };

export type ChoiceOption = {
  id: string;
  text: string;
  conditionMode: "simple" | "advanced";
  conditions: Condition[];
  conditionRaw: string;
  visibility: "if" | "selectable_if";
  blocks: Block[];
};

export type IfBranch = {
  id: string;
  conditionMode: "simple" | "advanced";
  condition: Condition | null;
  conditionRaw: string;
  blocks: Block[];
};

export type Condition = {
  variable: string;
  operator: "=" | "!=" | "<" | "<=" | ">" | ">=";
  value: string;
};

export type StatChartEntry = {
  id: string;
  display: "text" | "percent";
  variable: string;
  label: string;
  maxVariable?: string;
};

export type BlockKind = Block["kind"];
