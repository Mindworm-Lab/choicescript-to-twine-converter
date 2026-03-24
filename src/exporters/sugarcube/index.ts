import type { GameData, IRBlock, IRIfBranch, IRChoiceOption, IRStatChartField } from '../types';
import type { ExportStyle } from '../../types';
import { DEFAULT_EXPORT_STYLE } from '../../types';
import { translateExpr, translateSetExpr, translateText } from './operators';
import { buildHtml } from './template';


/**
 * Convert a GameData IR into a Twine SugarCube 2 HTML string.
 * The SugarCube runtime is bundled at build time — no network fetch needed.
 */
export function exportSugarCube(game: GameData, style?: ExportStyle): string {
  const s: ExportStyle = { ...DEFAULT_EXPORT_STYLE, ...(style ?? {}) };
  const passageMap = new Map<string, string>(); // id → markup

  // StoryTitle
  passageMap.set('StoryTitle', game.title);

  // StoryInit — initialize all variables
  const initLines: string[] = game.variables.map(v => {
    const val = v.type === 'string' ? `"${v.initial}"` : String(v.initial);
    return `<<set $${v.name} = ${val}>>`;
  });
  passageMap.set('StoryInit', initLines.join('\n'));

  // StoryCaption — shown in SugarCube's left sidebar, re-evaluated every passage.
  // Collect all stat_chart fields from every passage and render them there instead of inline.
  const captionMarkup = buildStoryCaption(game);
  if (captionMarkup) passageMap.set('StoryCaption', captionMarkup);

  // StoryStyle — inject export theme (colors, font) as CSS overrides
  const fontSizeRule = s.fontSize === 'small' ? 'font-size:0.875em;'
                     : s.fontSize === 'large'  ? 'font-size:1.15em;'
                     : '';
  const storyStyle = [
    `#ui-bar-body{background-color:${s.sidebarBg};color:${s.sidebarText};}`,
    `#ui-bar-body .macro-label,#ui-bar-body .cs-label{color:${s.sidebarText};}`,
    `body{background-color:${s.storyBg};color:${s.storyText};font-family:${s.fontFamily};${fontSizeRule}}`,
    `#passages p{margin:0 0 0.38em 0;line-height:1.56;}`,
    `a.link-internal{color:${s.accentColor};}`,
    `.cs-fill{background:${s.barColor};}`,
    `.cs-image-wrap{margin:0.75em 0;}`,
    `.cs-image-wrap img{display:block;max-width:100%;height:auto;border-radius:4px;}`,
    `.cs-image-left img{margin-right:auto;}`,
    `.cs-image-center img{margin-left:auto;margin-right:auto;}`,
    `.cs-image-right img{margin-left:auto;}`,
  ].join('\n');
  passageMap.set('StoryStyle', storyStyle);

  // Convert each passage (stat_chart blocks are skipped inline — they live in the sidebar)
  for (const passage of game.passages) {
    const markup = blocksToMarkup(passage.blocks, passage.sceneId, game);
    passageMap.set(passage.id, markup);
  }

  return buildHtml(game, passageMap);
}

// ─── Block → SugarCube markup ─────────────────────────────────────────────────

function blocksToMarkup(blocks: IRBlock[], sceneId: string, game: GameData): string {
  return blocks.map(b => blockToMarkup(b, sceneId, game)).filter(Boolean).join('\n');
}

function blockToMarkup(block: IRBlock, sceneId: string, game: GameData): string {
  switch (block.kind) {
    case 'paragraph':
      return `<p>${translateText(block.text)}</p>`;

    case 'image': {
      const alignClass = block.align ? ` cs-image-${block.align}` : '';
      const escapedSrc = block.src.replace(/"/g, '&quot;');
      return `<p class="cs-image-wrap${alignClass}"><img src="${escapedSrc}" alt=""></p>`;
    }

    case 'page_break':
      return '<hr class="cs-page-break">';

    case 'line_break':
      return '<br>';

    case 'set': {
      const rhs = translateSetExpr(block.name, block.expr);
      if (block.op === '=') {
        return `<<set $${block.name} = ${rhs}>>`;
      } else {
        return `<<set $${block.name} ${block.op} (${rhs})>>`;
      }
    }

    case 'ending':
      return `<p class="cs-ending">The End</p>\n<p>[[Restart the game->StoryTitle]]</p>`;

    case 'goto':
      return `<<goto "${block.passageId}">>`;

    case 'goto_scene': {
      const target = block.label
        ? `${block.scene}__${block.label}`
        : block.scene;
      return `<<goto "${target}">>`;
    }

    case 'stat_chart':
      return ''; // Rendered in StoryCaption sidebar instead

    case 'if':
      return ifMarkup(block.branches, sceneId, game);

    case 'choice':
      return choiceMarkup(block.options, sceneId, game);
  }
}

// ─── StoryCaption (sidebar stats) ────────────────────────────────────────────

/**
 * Priority order for sidebar stats. Variables earlier in this list appear first.
 * Anything not listed is sorted to the bottom in discovery order.
 */
const STAT_PRIORITY: string[] = [
  // Core survival stats — always front and centre
  'energy', 'max_energy', 'food_supply', 'money',
  // Garden
  'garden_health', 'crops_planted', 'crops_ready', 'days_since_planting',
  // Skills
  'farming_skill', 'animal_skill', 'building_skill',
  // Livestock
  'chickens', 'goats', 'rabbits', 'eggs',
  // Structures (booleans — only shown when true)
  'has_tool_shed', 'has_chicken_coop', 'has_barn',
  'has_root_cellar', 'has_greenhouse', 'has_smokehouse',
  // Time
  'day', 'season', 'year',
];

/**
 * Collect all stat_chart fields from every passage (deduped by variable name),
 * sort by STAT_PRIORITY, and render as the StoryCaption sidebar passage.
 */
function buildStoryCaption(game: GameData): string {
  const seen = new Set<string>();
  const fields: IRStatChartField[] = [];

  function collectFromBlocks(blocks: IRBlock[]): void {
    for (const block of blocks) {
      if (block.kind === 'stat_chart') {
        for (const f of block.fields) {
          if (!seen.has(f.variable)) {
            seen.add(f.variable);
            fields.push(f);
          }
        }
      } else if (block.kind === 'if') {
        for (const br of block.branches) collectFromBlocks(br.blocks);
      } else if (block.kind === 'choice') {
        for (const opt of block.options) collectFromBlocks(opt.blocks);
      }
    }
  }

  for (const passage of game.passages) {
    collectFromBlocks(passage.blocks);
  }

  if (fields.length === 0) return '';

  // Sort by priority; unlisted fields keep their relative discovery order at the end
  fields.sort((a, b) => {
    const pa = STAT_PRIORITY.indexOf(a.variable);
    const pb = STAT_PRIORITY.indexOf(b.variable);
    if (pa === -1 && pb === -1) return 0;
    if (pa === -1) return 1;
    if (pb === -1) return -1;
    return pa - pb;
  });

  // Build a type lookup so boolean vars get ✓/✗ and are hidden when false
  const varTypes = new Map(game.variables.map(v => [v.name, v.type]));

  // .cs-fill color is owned by StoryStyle (theme-controlled) — not set here
  const style = `<style>
/* Reset SugarCube-injected span wrappers around <<if>> blocks */
#story-caption span{display:contents;margin:0;padding:0;font-size:inherit;line-height:inherit}
.cs-stats{display:block;font-size:0.67rem;letter-spacing:0.02em;margin:6px 0 0;line-height:1}
.cs-row{display:flex;justify-content:space-between;align-items:center;padding:4px 0;border-bottom:1px solid rgba(255,255,255,0.05);margin:0}
.cs-k{color:rgba(210,188,148,0.52);text-transform:uppercase;font-size:0.59rem;letter-spacing:0.07em;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding-right:6px;margin:0}
.cs-v{font-family:'Courier New',monospace;font-weight:700;color:#ede0c4;font-size:0.69rem;flex-shrink:0;text-align:right;margin:0}
.cs-v-t{color:#82c47e}
.cs-prow{display:block;padding:4px 0 5px;border-bottom:1px solid rgba(255,255,255,0.05);margin:0}
.cs-ph{display:flex;justify-content:space-between;align-items:center;margin-bottom:3px}
.cs-bar{height:3px;background:rgba(255,255,255,0.07);border-radius:2px;overflow:hidden}
.cs-fill{height:100%;border-radius:2px}
</style>`;

  return style + '\n' + statChartMarkup(fields, varTypes);
}

// ─── Stat chart ───────────────────────────────────────────────────────────────

function statChartMarkup(
  fields: IRStatChartField[],
  varTypes: Map<string, string> = new Map(),
): string {
  const lines = ['<div class="cs-stats">'];
  for (const f of fields) {
    const isBoolean = varTypes.get(f.variable) === 'boolean';

    if (f.display === 'percent') {
      const maxAttr = f.maxVariable ? ` data-pct-max="${f.maxVariable}"` : '';
      lines.push(
        `<<if $${f.variable}>>`,
        `<div class="cs-prow">`,
        `<div class="cs-ph"><span class="cs-k">${f.label}</span> <span class="cs-v"><<print $${f.variable}>></span></div>`,
        `<div class="cs-bar"><div class="cs-fill" data-pct-var="${f.variable}"${maxAttr}></div></div>`,
        `</div>`,
        `<</if>>`,
      );
    } else if (isBoolean) {
      lines.push(
        `<<if $${f.variable}>><div class="cs-row"><span class="cs-k">${f.label}</span> <span class="cs-v cs-v-t">✓</span></div><</if>>`,
      );
    } else {
      lines.push(
        `<<if $${f.variable}>><div class="cs-row"><span class="cs-k">${f.label}</span> <span class="cs-v"><<print $${f.variable}>></span></div><</if>>`,
      );
    }
  }
  lines.push('</div>');

  lines.push(
    `<<run setTimeout(function(){`,
    `document.querySelectorAll('#story-caption [data-pct-var]').forEach(function(el){`,
    `var v=el.getAttribute('data-pct-var');`,
    `var n=+State.variables[v]||0;`,
    `var maxVar=el.getAttribute('data-pct-max');`,
    `var m=maxVar&&State.variables[maxVar]?+State.variables[maxVar]:100;`,
    `el.style.width=Math.min(100,Math.max(0,n/m*100))+'%';`,
    `});`,
    `},0)>>`,
  );

  return lines.join('');
}

// ─── *if block ────────────────────────────────────────────────────────────────

function ifMarkup(branches: IRIfBranch[], sceneId: string, game: GameData): string {
  const parts: string[] = [];
  for (let i = 0; i < branches.length; i++) {
    const br = branches[i];
    const body = blocksToMarkup(br.blocks, sceneId, game);
    if (i === 0) {
      parts.push(`<<if ${translateExpr(br.condition!)}>>`, body);
    } else if (br.condition === null) {
      parts.push('<<else>>', body);
    } else {
      parts.push(`<<elseif ${translateExpr(br.condition)}>>`, body);
    }
  }
  parts.push('<</if>>');
  return parts.join('\n');
}

// ─── *choice block ────────────────────────────────────────────────────────────

function choiceMarkup(options: IRChoiceOption[], sceneId: string, game: GameData): string {
  const parts: string[] = ['<ul class="cs-choices">'];

  for (const opt of options) {
    const linkMarkup = renderOptionAsLink(opt, sceneId, game);
    if (opt.conditionType === 'if_hide') {
      parts.push(`<<if ${translateExpr(opt.condition!)}>><li>${linkMarkup}</li><</if>>`);
    } else {
      parts.push(`<li>${linkMarkup}</li>`);
    }
  }

  parts.push('</ul>');
  return parts.join('\n');
}

function renderOptionAsLink(opt: IRChoiceOption, sceneId: string, game: GameData): string {
  const text = translateText(opt.text);
  const body = opt.blocks;

  const destination = findDestination(body, sceneId);
  const actionBlocks = body.filter(b => b.kind !== 'goto_scene' && b.kind !== 'goto' && b.kind !== 'ending');
  const actions = blocksToMarkup(actionBlocks, sceneId, game);

  let inner = '';
  if (actions.trim()) inner = actions + '\n';
  if (destination) inner += `<<goto "${destination}">>`;
  if (!destination && body.some(b => b.kind === 'ending')) {
    inner += `<p class="cs-ending">The End</p>`;
  }

  const linkText = text.replace(/"/g, '\\"');
  const link = `<<link "${linkText}">>\n${inner}\n<</link>>`;

  if (opt.condition && opt.conditionType === 'selectable') {
    return `<<if ${translateExpr(opt.condition)}>>${link}<<else>><span class="cs-disabled">${text}</span><</if>>`;
  }

  return link;
}

function findDestination(blocks: IRBlock[], _sceneId: string): string | null {
  for (let i = blocks.length - 1; i >= 0; i--) {
    const b = blocks[i];
    if (b.kind === 'goto_scene') {
      return b.label ? `${b.scene}__${b.label}` : b.scene;
    }
    if (b.kind === 'goto') return b.passageId;
    if (b.kind === 'ending') return null;
    if (b.kind === 'if') {
      for (const br of b.branches) {
        const d = findDestination(br.blocks, _sceneId);
        if (d) return d;
      }
    }
  }
  return null;
}
