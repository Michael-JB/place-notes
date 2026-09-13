import { App, PluginSettingTab, Setting } from "obsidian";
import type PlaceNotesPlugin from "./main";

export interface PlaceNotesSettings {
  /** Folder for new place notes. Empty means Obsidian's default location for new notes. */
  newNoteFolder: string;
}

export const DEFAULT_SETTINGS: PlaceNotesSettings = {
  newNoteFolder: "",
};

export class PlaceNotesSettingTab extends PluginSettingTab {
  constructor(
    app: App,
    private plugin: PlaceNotesPlugin,
  ) {
    super(app, plugin);
  }

  override display(): void {
    this.containerEl.empty();
    new Setting(this.containerEl)
      .setName("New place notes folder")
      .setDesc("Where notes created from the map go. Leave empty to use Obsidian's default location for new notes.")
      .addText((text) =>
        text
          .setPlaceholder("e.g. Places")
          .setValue(this.plugin.settings.newNoteFolder)
          .onChange(async (value) => {
            this.plugin.settings.newNoteFolder = value;
            await this.plugin.saveSettings();
          }),
      );
  }
}
