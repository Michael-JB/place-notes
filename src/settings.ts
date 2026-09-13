import { App, PluginSettingTab, SettingDefinitionItem } from "obsidian";
import type PlaceNotesPlugin from "./main";

export interface PlaceNotesSettings {
  /** Folder for new place notes. Empty means Obsidian's default location for new notes. */
  newNoteFolder: string;
  /** Frontmatter property holding the ISO country code. */
  countryProperty: string;
  /** Frontmatter property holding [latitude, longitude]. */
  coordinatesProperty: string;
}

export const DEFAULT_SETTINGS: PlaceNotesSettings = {
  newNoteFolder: "",
  countryProperty: "country",
  coordinatesProperty: "coordinates",
};

const PROPERTY_NAME = /^[A-Za-z0-9_-]+$/;

function validatePropertyName(value: string): string | void {
  if (!PROPERTY_NAME.test(value.trim())) return "Use letters, digits, - and _ only.";
}

export class PlaceNotesSettingTab extends PluginSettingTab {
  constructor(
    app: App,
    private plugin: PlaceNotesPlugin,
  ) {
    super(app, plugin);
  }

  override getSettingDefinitions(): SettingDefinitionItem[] {
    return [
      {
        name: "New place notes folder",
        desc: "Where notes created from the map go. Leave empty to use Obsidian's default location for new notes.",
        control: {
          type: "folder",
          key: "newNoteFolder",
          defaultValue: DEFAULT_SETTINGS.newNoteFolder,
          placeholder: "e.g. Places",
        },
      },
      {
        name: "Country property",
        desc: "Property holding the ISO 3166-1 alpha-2 country code.",
        control: {
          type: "text",
          key: "countryProperty",
          defaultValue: DEFAULT_SETTINGS.countryProperty,
          placeholder: DEFAULT_SETTINGS.countryProperty,
          validate: validatePropertyName,
        },
      },
      {
        name: "Coordinates property",
        desc: "Property holding [latitude, longitude].",
        control: {
          type: "text",
          key: "coordinatesProperty",
          defaultValue: DEFAULT_SETTINGS.coordinatesProperty,
          placeholder: DEFAULT_SETTINGS.coordinatesProperty,
          validate: validatePropertyName,
        },
      },
    ];
  }

  override async setControlValue(key: string, value: unknown): Promise<void> {
    await super.setControlValue(key, typeof value === "string" ? value.trim() : value);
    this.plugin.index.rebuild();
  }
}
