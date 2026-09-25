// Abrir/salvar projeto. No Electron usa os diálogos nativos (window.casa3d); no navegador
// (modo dev:web) cai em download/upload de arquivo.

import { loadProject } from '@shared/core/model/project';
import type { Project } from '@shared/core/model/types';
import type { Casa3DApi } from '../../../preload';

declare global {
  interface Window {
    casa3d?: Casa3DApi;
  }
}

export async function openProjectFile(): Promise<{ project: Project; path: string | null } | null> {
  if (window.casa3d) {
    const res = await window.casa3d.openProject();
    return res ? { project: loadProject(res.data), path: res.path } : null;
  }
  const file = await new Promise<File | null>((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.casa3d,application/json';
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.click();
  });
  if (!file) return null;
  return { project: loadProject(JSON.parse(await file.text())), path: file.name };
}

export async function saveProjectFile(project: Project, path: string | null, saveAs = false): Promise<string | null> {
  if (window.casa3d) return window.casa3d.saveProject(path, project, saveAs);
  const name = (path ?? `${project.name}.casa3d`).replace(/^.*[\\/]/, '');
  const url = URL.createObjectURL(new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name.endsWith('.casa3d') ? name : `${name}.casa3d`;
  a.click();
  URL.revokeObjectURL(url);
  return a.download;
}
