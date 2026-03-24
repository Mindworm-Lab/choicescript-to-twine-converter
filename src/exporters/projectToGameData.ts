import type { GameProject, Scene, Block, ChoiceOption, IfBranch } from '../types';
import { generateCondition } from '../codegen/generateCondition';
import type {
  GameData,
  IRVariable,
  Passage,
  IRBlock,
  IRChoiceOption,
  IRIfBranch,
} from './types';

export function projectToGameData(project: GameProject): GameData {
  const variables: IRVariable[] = project.variables.map(v => ({
    name: v.name,
    type: v.type,
    initial: v.defaultValue,
  }));

  const passages: Passage[] = [];
  let startPassage = '';

  // Process startup scene first, then the rest
  const ordered = [
    ...project.scenes.filter(s => s.filename === 'startup'),
    ...project.scenes.filter(s => s.filename !== 'startup'),
  ];

  for (const scene of ordered) {
    const scenePassages = buildPassages(scene);
    for (const p of scenePassages) {
      passages.push(p);
    }
    if (!startPassage && scenePassages.length > 0) {
      startPassage = scenePassages[0].id;
    }
  }

  return {
    id: slugify(project.title),
    title: project.title || 'Untitled',
    author: project.author || 'Unknown',
    variables,
    passages,
    startPassage,
  };
}

// ─── Passage splitting ────────────────────────────────────────────────────────

/**
 * Split a scene into one or more passages, cutting at each label block.
 * Labels become passage ID suffixes: "{scene.filename}__{label.name}"
 */
function buildPassages(scene: Scene): Passage[] {
  const passages: Passage[] = [];

  let currentId = scene.filename;
  let currentBlocks: IRBlock[] = [];
  let currentLabel: string | undefined = undefined;

  for (const block of scene.blocks) {
    if (block.kind === 'label') {
      // Flush current passage
      if (currentBlocks.length > 0 || passages.length === 0) {
        passages.push({ id: currentId, sceneId: scene.filename, label: currentLabel, blocks: currentBlocks });
      }
      currentLabel = block.name;
      currentId = `${scene.filename}__${block.name}`;
      currentBlocks = [];
      continue;
    }

    if (block.kind === 'comment') continue;

    const irBlock = convertBlock(block, scene.filename);
    if (irBlock) currentBlocks.push(irBlock);
  }

  // Flush final passage
  passages.push({ id: currentId, sceneId: scene.filename, label: currentLabel, blocks: currentBlocks });

  // Add fallthrough gotos between consecutive passages that don't end with navigation.
  // e.g. stat_alloc has content blocks before *label alloc_hub — SugarCube needs an
  // explicit <<goto>> to bridge them since passages don't fall through automatically.
  const NAV_KINDS = new Set(['goto', 'goto_scene', 'ending', 'choice']);
  function endsWithNav(blocks: IRBlock[]): boolean {
    if (blocks.length === 0) return false;
    const last = blocks[blocks.length - 1];
    return NAV_KINDS.has(last.kind);
  }

  for (let i = 0; i < passages.length - 1; i++) {
    if (!endsWithNav(passages[i].blocks)) {
      passages[i].blocks.push({ kind: 'goto', passageId: passages[i + 1].id });
    }
  }

  // Hoist post-choice tail blocks into each option (SugarCube <<goto>> fires immediately during render)
  for (const p of passages) {
    p.blocks = hoistTailIntoChoices(p.blocks);
  }

  // Flatten nested choices: when a choice option's blocks contain another choice,
  // extract those blocks into a new sub-passage and replace the option with a
  // simple goto. This prevents SugarCube from trying to render nested <<link>>
  // menus inline (which either fires <<goto>> too early or renders awkwardly).
  const counter = { n: 0 };
  const allPassages: Passage[] = [];
  for (const p of passages) {
    const extra: Passage[] = [];
    p.blocks = flattenSubChoices(p.blocks, p.id, scene.filename, counter, extra);
    allPassages.push(p);
    allPassages.push(...extra);
  }

  return allPassages;
}

// ─── Block conversion ─────────────────────────────────────────────────────────

function convertBlock(block: Block, sceneId: string): IRBlock | null {
  switch (block.kind) {
    case 'paragraph':
      return { kind: 'paragraph', text: block.text };

    case 'image':
      return {
        kind: 'image',
        src: block.src,
        ...(block.align !== 'none' ? { align: block.align } : {}),
      };

    case 'set':
      return { kind: 'set', name: block.variable, op: block.operator, expr: block.value };

    case 'goto':
      return { kind: 'goto', passageId: `${sceneId}__${block.label}` };

    case 'goto_scene':
      return {
        kind: 'goto_scene',
        scene: block.sceneName,
        ...(block.label ? { label: block.label } : {}),
      };

    case 'finish':
    case 'ending':
      return { kind: 'ending' };

    case 'choice':
      return {
        kind: 'choice',
        options: block.options.map(opt => convertChoiceOption(opt, sceneId)),
      };

    case 'if':
      return {
        kind: 'if',
        branches: block.branches.map(br => convertIfBranch(br, sceneId)),
      };

    case 'stat_chart':
      return {
        kind: 'stat_chart',
        fields: block.entries.map(e => ({
          display: e.display,
          variable: e.variable,
          label: e.label,
          ...(e.maxVariable ? { maxVariable: e.maxVariable } : {}),
        })),
      };

    case 'label':
    case 'comment':
      return null;
  }
}

function convertChoiceOption(opt: ChoiceOption, sceneId: string): IRChoiceOption {
  const condition = resolveCondition(opt.conditionMode, opt.conditions, opt.conditionRaw);
  const conditionType = condition === null
    ? null
    : opt.visibility === 'if' ? 'if_hide' : 'selectable';

  return {
    text: opt.text,
    condition,
    conditionType,
    blocks: opt.blocks.flatMap(b => {
      if (b.kind === 'comment') return [];
      const ir = convertBlock(b, sceneId);
      return ir ? [ir] : [];
    }),
  };
}

function convertIfBranch(branch: IfBranch, sceneId: string): IRIfBranch {
  const condition = resolveCondition(branch.conditionMode, branch.condition ? [branch.condition] : [], branch.conditionRaw);

  return {
    condition,
    blocks: branch.blocks.flatMap(b => {
      if (b.kind === 'comment') return [];
      const ir = convertBlock(b, sceneId);
      return ir ? [ir] : [];
    }),
  };
}

function resolveCondition(
  mode: 'simple' | 'advanced',
  conditions: import('../types').Condition[],
  raw: string,
): string | null {
  if (mode === 'advanced') {
    return raw.trim() || null;
  }
  // simple mode: use first condition only (single-condition UI)
  if (conditions.length === 0) return null;
  return generateCondition(conditions[0]);
}

// ─── Flatten nested choices into sub-passages ────────────────────────────────

/**
 * When a choice option contains a nested choice, extract the option's entire
 * block list into a new anonymous passage and replace the option's blocks with
 * a single `goto` pointing to it.
 *
 * SugarCube <<link>> bodies execute inline — nested <<link>> menus don't behave
 * like passage navigation. Extracting them into real passages gives the correct
 * "choose → new screen → sub-choose" Twine behaviour.
 */
function flattenSubChoices(
  blocks: IRBlock[],
  baseId: string,
  sceneId: string,
  counter: { n: number },
  extra: Passage[],
): IRBlock[] {
  return blocks.map(block => {
    if (block.kind === 'choice') {
      const newOptions = block.options.map(opt => {
        // Recursively flatten deeper levels first
        const flatBlocks = flattenSubChoices(opt.blocks, baseId, sceneId, counter, extra);
        // If the original option blocks contain a choice, extract to sub-passage
        if (!opt.blocks.some(b => b.kind === 'choice')) {
          return { ...opt, blocks: flatBlocks };
        }
        const subId = `${baseId}__sub${counter.n++}`;
        extra.push({ id: subId, sceneId, label: undefined, blocks: flatBlocks });
        return { ...opt, blocks: [{ kind: 'goto' as const, passageId: subId }] };
      });
      return { ...block, options: newOptions };
    }
    if (block.kind === 'if') {
      return {
        ...block,
        branches: block.branches.map(br => ({
          ...br,
          blocks: flattenSubChoices(br.blocks, baseId, sceneId, counter, extra),
        })),
      };
    }
    return block;
  });
}

// ─── Hoist tail into choices ──────────────────────────────────────────────────

/**
 * If a choice block is followed by additional blocks at the same level, inject
 * those "tail" blocks into each option that has no navigation of its own.
 *
 * In ChoiceScript, *choice is blocking — blocks after it only run once a choice is made.
 * In SugarCube, <<goto>> fires immediately during rendering, so any blocks that follow
 * a *choice at the same level must live inside each <<link>> handler instead.
 */
function hoistTailIntoChoices(blocks: IRBlock[]): IRBlock[] {
  // First, recurse into nested option and branch blocks so inner choices are
  // processed before we hoist tails at this level.
  blocks = blocks.map(block => {
    if (block.kind === 'choice') {
      return {
        ...block,
        options: block.options.map(opt => ({
          ...opt,
          blocks: hoistTailIntoChoices(opt.blocks),
        })),
      };
    }
    if (block.kind === 'if') {
      return {
        ...block,
        branches: block.branches.map(br => ({
          ...br,
          blocks: hoistTailIntoChoices(br.blocks),
        })),
      };
    }
    return block;
  });

  // Then handle any tail blocks after the first choice at this level.
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    if (block.kind !== 'choice') continue;

    const tail = blocks.slice(i + 1);
    if (tail.length === 0) return blocks;

    const newOptions = (block as Extract<IRBlock, { kind: 'choice' }>).options.map(opt => {
      const hasNav = opt.blocks.some(
        b => b.kind === 'goto' || b.kind === 'goto_scene' || b.kind === 'ending'
      );
      if (hasNav) return opt;
      return { ...opt, blocks: [...opt.blocks, ...tail] };
    });

    return [...blocks.slice(0, i), { ...block, options: newOptions }];
  }
  return blocks;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function slugify(s: string): string {
  return s.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || 'untitled';
}
