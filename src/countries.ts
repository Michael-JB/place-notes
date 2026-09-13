import countriesData from "../data/countries.json";

export interface Country {
  code: string; // ISO 3166-1 alpha-2
  name: string;
}

export const COUNTRIES = countriesData as Country[];

const byCode = new Map(COUNTRIES.map((c) => [c.code, c]));

/** Returns the country for a frontmatter value, or undefined if it is not a valid code. */
export function countryByCode(value: unknown): Country | undefined {
  if (typeof value !== "string") return undefined;
  return byCode.get(value.trim().toUpperCase());
}
