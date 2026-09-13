import { App, normalizePath, TFile, TFolder } from "obsidian";
import type { PlaceNotesSettings } from "./settings";

export interface NewPlace {
  name: string;
  countryCode?: string;
  coordinates?: { lat: number; lon: number };
}

/**
 * Creates a place note named after the place with its properties filled in.
 * If a note with that name already exists it is returned unchanged.
 */
export async function createPlaceNote(
  app: App,
  settings: PlaceNotesSettings,
  place: NewPlace,
  contextPath: string,
): Promise<{ file: TFile; created: boolean }> {
  const name = safeFileName(place.name);

  const existing = app.metadataCache.getFirstLinkpathDest(name, contextPath);
  if (existing) return { file: existing, created: false };

  const folder = await resolveFolder(app, settings.newNoteFolder, contextPath);
  const path = normalizePath(folder ? `${folder}/${name}.md` : `${name}.md`);
  const file = await app.vault.create(path, frontmatterFor(place));
  return { file, created: true };
}

function frontmatterFor(place: NewPlace): string {
  const lines = ["---"];
  if (place.countryCode) lines.push(`country: ${place.countryCode}`);
  if (place.coordinates) lines.push(`coordinates: [${place.coordinates.lat}, ${place.coordinates.lon}]`);
  lines.push("---", "");
  return lines.join("\n");
}

/** Strips characters Obsidian does not allow in file names. */
function safeFileName(name: string): string {
  return name
    .replace(/[\\/:*?"<>|#^[\]]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function resolveFolder(app: App, configured: string, contextPath: string): Promise<string> {
  const wanted = normalizePath(configured.trim());
  if (!wanted || wanted === "/") {
    const parent = app.fileManager.getNewFileParent(contextPath);
    return parent.isRoot() ? "" : parent.path;
  }
  const existing = app.vault.getAbstractFileByPath(wanted);
  if (existing instanceof TFolder) return wanted;
  if (existing) throw new Error(`"${wanted}" is a file, not a folder`);
  await app.vault.createFolder(wanted);
  return wanted;
}

export async function setCountryOnNote(app: App, file: TFile, code: string): Promise<void> {
  await app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
    fm["country"] = code;
  });
}

export async function setCoordinatesOnNote(app: App, file: TFile, lat: number, lon: number): Promise<void> {
  await app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
    fm["coordinates"] = [lat, lon];
  });
}
