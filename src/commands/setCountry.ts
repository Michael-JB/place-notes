import { App, FuzzySuggestModal } from "obsidian";
import { COUNTRIES, type Country } from "../countries";

export class CountrySuggestModal extends FuzzySuggestModal<Country> {
  constructor(
    app: App,
    private onPick: (country: Country) => void,
  ) {
    super(app);
    this.setPlaceholder("Country…");
  }

  getItems(): Country[] {
    return COUNTRIES;
  }

  getItemText(country: Country): string {
    return `${country.name} ${country.code}`;
  }

  onChooseItem(country: Country): void {
    this.onPick(country);
  }
}
