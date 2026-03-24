import { saveAs } from 'file-saver';
import type { GameProject } from '../types';
import { projectToGameData } from '../exporters/projectToGameData';
import { exportSugarCube } from '../exporters/sugarcube/index';

function slug(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'project';
}

export function exportTwine(project: GameProject): string[] {
  const warnings: string[] = [];

  if (!project.scenes.some(s => s.filename === 'startup')) {
    warnings.push('No startup scene found.');
  }

  const gameData = projectToGameData(project);
  const html = exportSugarCube(gameData, project.exportStyle);
  const blob = new Blob([html], { type: 'text/html' });
  saveAs(blob, `${slug(project.title)}.html`);

  return warnings;
}
