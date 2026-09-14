import {
  AbstractInputSuggest,
  App,
  ButtonComponent,
  FuzzyMatch,
  FuzzySuggestModal,
  Modal,
  Notice,
  prepareFuzzySearch,
  TextComponent,
} from "obsidian";
import citiesData from "../../data/cities.json";
import { COUNTRIES, countryByCode, countryByNameOrCode, type Country } from "../countries";

/** name, ascii name (or ""), country code, lat, lon, population */
type CityRow = [string, string, string, number, number, number];

const CITIES = citiesData as CityRow[];

export type PickedPlace =
  | { kind: "country"; country: Country }
  | { kind: "town"; name: string; countryCode: string; lat: number; lon: number }
  | { kind: "coordinates"; lat: number; lon: number; countryCode?: string };

type Item = { kind: "manual" } | { kind: "country"; country: Country } | { kind: "town"; row: CityRow };

const pin = (item: Item): FuzzyMatch<Item> => ({ item, match: { score: 0, matches: [] } });
const MANUAL = pin({ kind: "manual" });

export interface PlacePickerOptions {
  /** Offer whole countries as well as towns. */
  countries: boolean;
  /** Restrict countries and towns to this country. */
  countryCode?: string;
  placeholder?: string;
}

/** One picker over countries and towns, with a pinned option to enter coordinates by hand. */
export class PlacePicker extends FuzzySuggestModal<Item> {
  private items: Item[];
  private pinned: FuzzyMatch<Item>[];
  private countryCode?: string;

  constructor(
    app: App,
    options: PlacePickerOptions,
    private onPick: (picked: PickedPlace) => void,
  ) {
    super(app);
    this.limit = 50;
    const only = options.countryCode;
    this.countryCode = only;
    const onlyName = only ? countryByCode(only)?.name ?? only : undefined;
    this.setPlaceholder(
      options.placeholder ?? (onlyName ? `City or town in ${onlyName}…` : "Country, city or town…"),
    );
    const countries = only ? COUNTRIES.filter((c) => c.code === only) : COUNTRIES;
    const towns = only ? CITIES.filter((row) => row[2] === only) : CITIES;
    this.items = [
      ...countries.filter(() => options.countries).map((country): Item => ({ kind: "country", country })),
      ...towns.map((row): Item => ({ kind: "town", row })),
    ];

    // Pinned actions: the country's general note when narrowed, and manual coordinates.
    this.pinned = [
      ...(only && options.countries ? countries.map((country): FuzzyMatch<Item> => pin({ kind: "country", country })) : []),
      MANUAL,
    ];

    const what = only
      ? `${towns.length.toLocaleString()} towns in ${onlyName}`
      : `${countries.length} countries and ${towns.length.toLocaleString()} towns`;
    this.setInstructions([{ command: "", purpose: `Type to search ${what}` }]);
  }

  /**
   * Nothing to browse: an empty box shows only the pinned actions, typing
   * searches the whole list with the actions kept at the end.
   */
  override getSuggestions(query: string): FuzzyMatch<Item>[] {
    if (query.trim() === "") return [...this.pinned];
    return [...super.getSuggestions(query), ...this.pinned];
  }

  getItems(): Item[] {
    return this.items;
  }

  getItemText(item: Item): string {
    switch (item.kind) {
      case "manual":
        return "Enter coordinates manually";
      case "country":
        return `${item.country.name} ${item.country.code}`;
      case "town": {
        const [name, ascii, cc] = item.row;
        return `${name} ${ascii} ${countryByCode(cc)?.name ?? cc}`;
      }
    }
  }

  override renderSuggestion(match: FuzzyMatch<Item>, el: HTMLElement): void {
    const item = match.item;
    switch (item.kind) {
      case "manual":
        el.createDiv({ text: "Enter coordinates manually…" });
        el.createDiv({ cls: "place-notes-suggestion-note", text: "Latitude and longitude" });
        break;
      case "country":
        el.createDiv({ text: item.country.name });
        el.createDiv({ cls: "place-notes-suggestion-note", text: "General note about the country" });
        break;
      case "town": {
        const [name, , cc] = item.row;
        el.createDiv({ text: name });
        el.createDiv({ cls: "place-notes-suggestion-note", text: countryByCode(cc)?.name ?? cc });
      }
    }
  }

  onChooseItem(item: Item): void {
    switch (item.kind) {
      case "manual":
        new CoordinatesModal(this.app, this.countryCode, (lat, lon, countryCode) =>
          this.onPick({ kind: "coordinates", lat, lon, countryCode }),
        ).open();
        break;
      case "country":
        this.onPick({ kind: "country", country: item.country });
        break;
      case "town": {
        const [name, , countryCode, lat, lon] = item.row;
        this.onPick({ kind: "town", name, countryCode, lat, lon });
      }
    }
  }
}

/** Accepts "lat, lon", "lat lon", or a geo: URI. */
export function parseCoordinates(text: string): { lat: number; lon: number } | null {
  const m = text
    .trim()
    .replace(/^geo:/i, "")
    .match(/^(-?\d+(?:\.\d+)?)\s*[,;\s]\s*(-?\d+(?:\.\d+)?)/);
  if (!m) return null;
  const lat = Number(m[1]);
  const lon = Number(m[2]);
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return { lat, lon };
}

class CoordinatesModal extends Modal {
  constructor(
    app: App,
    private initialCountryCode: string | undefined,
    private onPick: (lat: number, lon: number, countryCode?: string) => void,
  ) {
    super(app);
  }

  override onOpen(): void {
    this.setTitle("Coordinates");
    const { contentEl } = this;
    contentEl.createEl("p", { text: "Latitude and longitude, e.g. 38.7169, -9.1399" });

    const input = new TextComponent(contentEl).setPlaceholder("latitude, longitude");
    input.inputEl.addClass("place-notes-coordinates-input");

    contentEl.createEl("p", { text: "Country (optional)" });
    const countryInput = new TextComponent(contentEl).setPlaceholder("Start typing a country…");
    countryInput.inputEl.addClass("place-notes-coordinates-input");
    const initial = countryByCode(this.initialCountryCode);
    if (initial) countryInput.setValue(initial.name);
    new CountryInputSuggest(this.app, countryInput.inputEl);

    const submit = () => {
      const coords = parseCoordinates(input.getValue());
      if (!coords) {
        new Notice("Could not read coordinates. Use latitude, longitude.");
        return;
      }
      const countryText = countryInput.getValue().trim();
      const country = countryByNameOrCode(countryText);
      if (countryText && !country) {
        new Notice(`Unknown country "${countryText}". Pick one from the suggestions or leave it empty.`);
        return;
      }
      this.close();
      this.onPick(coords.lat, coords.lon, country?.code);
    };

    for (const el of [input.inputEl, countryInput.inputEl]) {
      el.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.isComposing) submit();
      });
    }

    const buttons = contentEl.createDiv({ cls: "modal-button-container" });
    new ButtonComponent(buttons).setButtonText("OK").setCta().onClick(submit);

    input.inputEl.focus();
  }

  override onClose(): void {
    this.contentEl.empty();
  }
}

/** Inline country suggestions for a text input. */
class CountryInputSuggest extends AbstractInputSuggest<Country> {
  constructor(
    app: App,
    private input: HTMLInputElement,
  ) {
    super(app, input);
    this.limit = 8;
  }

  protected getSuggestions(query: string): Country[] {
    const search = prepareFuzzySearch(query);
    return COUNTRIES.filter((c) => search(`${c.name} ${c.code}`) !== null);
  }

  renderSuggestion(country: Country, el: HTMLElement): void {
    el.createDiv({ text: country.name });
    el.createDiv({ cls: "place-notes-suggestion-note", text: country.code });
  }

  override selectSuggestion(country: Country): void {
    this.setValue(country.name);
    this.input.dispatchEvent(new Event("input"));
    this.close();
  }
}

/** Asks for a note name, used when a place has none (hand-entered coordinates). */
export class NameModal extends Modal {
  constructor(
    app: App,
    private onSubmit: (name: string) => void,
  ) {
    super(app);
  }

  override onOpen(): void {
    this.setTitle("Name the place");
    const input = new TextComponent(this.contentEl).setPlaceholder("e.g. Hidden beach");
    input.inputEl.addClass("place-notes-coordinates-input");

    const submit = () => {
      const name = input.getValue().trim();
      if (!name) return;
      this.close();
      this.onSubmit(name);
    };
    input.inputEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter") submit();
    });
    const buttons = this.contentEl.createDiv({ cls: "modal-button-container" });
    new ButtonComponent(buttons).setButtonText("Create").setCta().onClick(submit);
    input.inputEl.focus();
  }

  override onClose(): void {
    this.contentEl.empty();
  }
}
