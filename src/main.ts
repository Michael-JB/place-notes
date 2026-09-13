import { debounce, MarkdownView, Notice, Plugin, TFile, WorkspaceLeaf } from "obsidian";
import { CountrySuggestModal } from "./commands/setCountry";
import { NameModal, PlacePicker, type PickedPlace } from "./commands/placePicker";
import { PlaceIndex } from "./index";
import { PlaceMapView, VIEW_TYPE_MAP } from "./map/view";
import { createPlaceNote, setCountryOnNote, setCoordinatesOnNote, type NewPlace } from "./notes";
import { PlaceNotesSettingTab, DEFAULT_SETTINGS, type PlaceNotesSettings } from "./settings";

export default class PlaceNotesPlugin extends Plugin {
  override settings: PlaceNotesSettings = DEFAULT_SETTINGS;
  index!: PlaceIndex;

  override async onload(): Promise<void> {
    await this.loadSettings();
    this.index = new PlaceIndex(this.app);

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
      id: "set-country",
      name: "Set country of current note",
      checkCallback: (checking) => this.withActiveNote(checking, (file) => this.setCountry(file)),
    });

    this.addCommand({
      id: "set-coordinates",
      name: "Set coordinates of current note",
      checkCallback: (checking) => this.withActiveNote(checking, (file) => this.setCoordinates(file)),
    });

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
      const { file, created } = await createPlaceNote(this.app, this.settings, place, context);
      if (!created) new Notice(`Opened existing note "${file.basename}"`);
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

  private setCountry(file: TFile): void {
    new CountrySuggestModal(this.app, (country) => {
      setCountryOnNote(this.app, file, country.code).catch((e) => new Notice(`Could not set country: ${message(e)}`));
    }).open();
  }

  private setCoordinates(file: TFile): void {
    new PlacePicker(this.app, { countries: false, placeholder: "Town or city…" }, (picked) => {
      void this.applyCoordinates(file, picked);
    }).open();
  }

  private async applyCoordinates(file: TFile, picked: PickedPlace): Promise<void> {
    if (picked.kind === "country") return;
    try {
      await setCoordinatesOnNote(this.app, file, picked.lat, picked.lon);
      if (picked.kind === "town") await setCountryOnNote(this.app, file, picked.countryCode);
    } catch (e) {
      new Notice(`Could not set coordinates: ${message(e)}`);
    }
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
