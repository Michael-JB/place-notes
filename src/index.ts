import { App, Events, TFile } from "obsidian";
import { countryByCode } from "./countries";
import type { PlaceNotesSettings } from "./settings";

export interface LocatedNote {
  file: TFile;
  lat: number;
  lon: number;
}

export interface CountryEntry {
  code: string;
  /** Notes with this country and no coordinates: the general ones. */
  general: TFile[];
  /** Notes with this country and coordinates. */
  located: TFile[];
}

/**
 * In-memory view of the vault's place notes, rebuilt from Obsidian's
 * metadata cache. Emits "changed" after every rebuild.
 */
export class PlaceIndex extends Events {
  countries = new Map<string, CountryEntry>();
  located: LocatedNote[] = [];

  constructor(
    private app: App,
    private settings: () => PlaceNotesSettings,
  ) {
    super();
  }

  rebuild(): void {
    const cache = this.app.metadataCache;
    const { countryProperty, coordinatesProperty } = this.settings();
    const countries = new Map<string, CountryEntry>();
    const located: LocatedNote[] = [];

    for (const file of this.app.vault.getMarkdownFiles()) {
      const fm = cache.getFileCache(file)?.frontmatter;
      if (!fm) continue;

      const loc = parseCoordinatesProperty(fm[coordinatesProperty]);
      if (loc) located.push({ file, ...loc });

      const country = countryByCode(fm[countryProperty]);
      if (country) {
        let entry = countries.get(country.code);
        if (!entry) {
          entry = { code: country.code, general: [], located: [] };
          countries.set(country.code, entry);
        }
        (loc ? entry.located : entry.general).push(file);
      }
    }

    const byName = (a: TFile, b: TFile) => a.basename.localeCompare(b.basename);
    for (const e of countries.values()) {
      e.general.sort(byName);
      e.located.sort(byName);
    }

    this.countries = countries;
    this.located = located;
    this.trigger("changed");
  }

  /** Notes for a country, general ones first. */
  notesFor(code: string): TFile[] {
    const e = this.countries.get(code);
    return e ? [...e.general, ...e.located] : [];
  }

  isEmpty(): boolean {
    return this.countries.size === 0 && this.located.length === 0;
  }
}

/** Accepts `[latitude, longitude]` with numbers or numeric strings. */
export function parseCoordinatesProperty(value: unknown): { lat: number; lon: number } | null {
  if (!Array.isArray(value) || value.length !== 2) return null;
  const lat = Number(value[0]);
  const lon = Number(value[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return { lat, lon };
}
