import { debounce, MarkdownView, Notice, Plugin, TFile, WorkspaceLeaf } from "obsidian";
import { NameModal, PlacePicker, type PickedPlace } from "./commands/placePicker";
import { PlaceIndex } from "./index";
import { PlaceMapView, VIEW_TYPE_MAP } from "./map/view";
import { applyPlace, createPlaceNote, type NewPlace } from "./notes";
import { PlaceNotesSettingTab, DEFAULT_SETTINGS, type PlaceNotesSettings } from "./settings";

export default class PlaceNotesPlugin extends Plugin {
  override settings: PlaceNotesSettings = DEFAULT_SETTINGS;
  index!: PlaceIndex;

  override async onload(): Promise<void> {
    await this.loadSettings();
    this.index = new PlaceIndex(this.app, () => this.settings);

    this.registerView(VIEW_TYPE_MAP, (leaf) => new PlaceMapView(leaf, this));
    this.addRibbonIcon("map", "Open map", () => void this.openMap());
    this.addSettingTab(new PlaceNotesSettingTab(this.app, this));

    this.addCommand({
      id: "open-map",
      name: "Open map",
      callback: () => void this.openMap(),
    });

    this.addCommand({
      id: "new-place",
      name: "New place note",
      callback: () => this.newPlace(),
    });

    this.addCommand({
      id: "add-to-map",
      name: "Add to map",
      checkCallback: (checking) => this.withActiveNote(checking, (file) => this.addToMap(file)),
    });

    // Right-click on a note in the file explorer, and the note's "more options" menu.
    this.registerEvent(
      this.app.workspace.on("file-menu", (menu, file) => {
        if (!(file instanceof TFile) || file.extension !== "md") return;
        menu.addItem((item) =>
          item
            .setTitle("Add to map")
            .setIcon("map-pin")
            .onClick(() => this.addToMap(file)),
        );
      }),
    );

    const rebuild = debounce(() => this.index.rebuild(), 200, true);
    this.app.workspace.onLayoutReady(() => {
      this.index.rebuild();
      this.registerEvent(this.app.metadataCache.on("changed", rebuild));
      this.registerEvent(this.app.metadataCache.on("deleted", rebuild));
      this.registerEvent(this.app.vault.on("rename", rebuild));
    });
  }

  async openMap(): Promise<void> {
    const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE_MAP)[0];
    const leaf: WorkspaceLeaf = existing ?? this.app.workspace.getLeaf("tab");
    if (!existing) await leaf.setViewState({ type: VIEW_TYPE_MAP, active: true });
    await this.app.workspace.revealLeaf(leaf);
  }

  /** The primary flow: pick a place, get a note named after it, open it. */
  newPlace(countryCode?: string): void {
    new PlacePicker(this.app, { countries: true, countryCode }, (picked) => {
      if (picked.kind === "coordinates") {
        new NameModal(this.app, (name) => void this.createAndOpen({ name, countryCode, coordinates: picked })).open();
        return;
      }
      void this.createAndOpen(toNewPlace(picked));
    }).open();
  }

  private async createAndOpen(place: NewPlace): Promise<void> {
    try {
      const context = this.app.workspace.getActiveFile()?.path ?? "";
      const { file, outcome } = await createPlaceNote(this.app, this.settings, place, context);
      if (outcome === "adopted") new Notice(`Added place properties to existing note "${file.basename}"`);
      if (outcome === "existing") new Notice(`Opened existing place note "${file.basename}"`);
      await this.app.workspace.getLeaf("tab").openFile(file);
    } catch (e) {
      new Notice(`Could not create place note: ${message(e)}`);
    }
  }

  /** Runs `action` on the active Markdown note, or reports whether one exists when checking. */
  private withActiveNote(checking: boolean, action: (file: TFile) => void): boolean {
    const file = this.app.workspace.getActiveViewOfType(MarkdownView)?.file;
    if (!file) return false;
    if (!checking) action(file);
    return true;
  }

  /** Writes place properties into an existing note so it shows on the map. */
  private addToMap(file: TFile): void {
    new PlacePicker(this.app, { countries: true, placeholder: `Add "${file.basename}" to: country, city or town…` }, (picked) => {
      const place = picked.kind === "coordinates" ? { coordinates: picked } : toNewPlace(picked);
      applyPlace(this.app, this.settings, file, place).catch((e) => new Notice(`Could not add to map: ${message(e)}`));
    }).open();
  }

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, (await this.loadData()) as Partial<PlaceNotesSettings>);
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }
}

function toNewPlace(picked: Exclude<PickedPlace, { kind: "coordinates" }>): NewPlace {
  if (picked.kind === "country") return { name: picked.country.name, countryCode: picked.country.code };
  return { name: picked.name, countryCode: picked.countryCode, coordinates: { lat: picked.lat, lon: picked.lon } };
}

function message(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
