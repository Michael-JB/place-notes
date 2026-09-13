import { App, PluginSettingTab, SettingDefinitionItem } from "obsidian";
import type PlaceNotesPlugin from "./main";

export interface PlaceNotesSettings {
  /** Folder for new place notes. Empty means Obsidian's default location for new notes. */
  newNoteFolder: string;
}

export const DEFAULT_SETTINGS: PlaceNotesSettings = {
  newNoteFolder: "",
};

export class PlaceNotesSettingTab extends PluginSettingTab {
  constructor(app: App, plugin: PlaceNotesPlugin) {
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
    ];
  }
}
