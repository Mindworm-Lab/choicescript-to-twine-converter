import sugarCubeTemplate from 'virtual:sugarcube-template';
import type { GameData } from '../types';

/**
 * Build a fully self-contained SugarCube 2 HTML file by injecting the game's
 * story data into the bundled SugarCube runtime template.
 *
 * The template was extracted from the official format.js at build time (no CDN
 * dependency at runtime). Placeholders replaced:
 *   {{STORY_NAME}}           → game title
 *   {{STORY_DATA}}           → <tw-storydata> element with all passages
 *   {{STORY_FORMAT_VERSION}} → 2.37.3
 */
export function buildHtml(game: GameData, passages: Map<string, string>): string {
  const storyData = buildStoryData(game, passages);

  // Use regex with /g to catch every occurrence ({{STORY_NAME}} appears twice in the template).
  // Use function callbacks instead of string replacements so that $ characters inside
  // storyData (from SugarCube markup like $money) are never misread as replacement patterns.
  const title = escapeAttr(game.title);
  return sugarCubeTemplate
    .replace(/\{\{STORY_NAME\}\}/g, () => title)
    .replace(/\{\{STORY_DATA\}\}/g, () => storyData)
    .replace(/\{\{STORY_FORMAT_VERSION\}\}/g, () => '2.37.3');
}

/** Build the <tw-storydata>…</tw-storydata> block that SugarCube reads. */
function buildStoryData(game: GameData, passages: Map<string, string>): string {
  const passageElements = buildPassageElements(passages, game.startPassage);
  return `<tw-storydata name="${escapeAttr(game.title)}" startnode="1" creator="cyoa-base" creator-version="1.0.0" format="SugarCube" format-version="2.37.3" ifid="${generateIfid()}" options="" hidden>\n${passageElements}\n</tw-storydata>`;
}

function buildPassageElements(passages: Map<string, string>, startPassage: string): string {
  const entries = [...passages.entries()];
  let pid = 1;

  // startPassage must be pid=1 to match startnode="1"
  const sorted = [
    ...entries.filter(([id]) => id === startPassage),
    ...entries.filter(([id]) => id !== startPassage),
  ];

  return sorted.map(([id, content]) => {
    const tags = getPassageTags(id);
    const el = `<tw-passagedata pid="${pid}" name="${escapeAttr(id)}" tags="${tags}" position="${pid * 150},100" size="100,100">${escapeContent(content)}</tw-passagedata>`;
    pid++;
    return el;
  }).join('\n');
}

function getPassageTags(id: string): string {
  if (id === 'CSWidgets') return 'widget';
  return '';
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Passage content in tw-passagedata must be HTML-encoded; SugarCube decodes it on load. */
function escapeContent(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function generateIfid(): string {
  const hex = () => Math.floor(Math.random() * 16).toString(16).toUpperCase();
  const seg = (n: number) => Array.from({ length: n }, hex).join('');
  return `${seg(8)}-${seg(4)}-${seg(4)}-${seg(4)}-${seg(12)}`;
}
