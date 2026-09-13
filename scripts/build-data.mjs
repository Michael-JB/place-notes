// Regenerates the bundled datasets in data/. Run with `npm run data`.
// Network is needed here and only here; the plugin itself is offline.
//
// Sources:
//   GeoNames countryInfo.txt and cities15000.zip  (CC BY 4.0)
//   world-atlas countries-110m.json, derived from Natural Earth (public domain)

import { execSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const OUT = new URL("../data/", import.meta.url).pathname;
const GEONAMES = "https://download.geonames.org/export/dump/";
const WORLD_ATLAS = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return res.text();
}

// --- countries ------------------------------------------------------------

const countryInfo = (await fetchText(GEONAMES + "countryInfo.txt"))
  .split("\n")
  .filter((l) => l && !l.startsWith("#"))
  .map((l) => l.split("\t"));

const countries = countryInfo
  .map((c) => ({ code: c[0], name: c[4] }))
  .sort((a, b) => a.name.localeCompare(b.name));
const numericToCode = new Map(countryInfo.map((c) => [String(Number(c[2])), c[0]]));
const codeSet = new Set(countries.map((c) => c.code));

writeFileSync(join(OUT, "countries.json"), JSON.stringify(countries));
console.log(`countries.json: ${countries.length} countries`);

// --- world map ------------------------------------------------------------

const atlas = JSON.parse(await fetchText(WORLD_ATLAS));
delete atlas.objects.land;
let unmatched = [];
for (const g of atlas.objects.countries.geometries) {
  const name = g.properties?.name ?? "";
  let iso = numericToCode.get(String(Number(g.id))) ?? null;
  if (!iso && name === "Kosovo") iso = "XK";
  if (!iso) unmatched.push(name);
  g.id = undefined;
  g.properties = { name, iso };
}
writeFileSync(join(OUT, "countries-110m.json"), JSON.stringify(atlas));
console.log(
  `countries-110m.json: ${atlas.objects.countries.geometries.length} shapes` +
    (unmatched.length ? `, no ISO code for: ${unmatched.join(", ")}` : ""),
);

// --- cities ---------------------------------------------------------------

const tmp = mkdtempSync(join(tmpdir(), "place-notes-"));
const zip = join(tmp, "cities15000.zip");
const res = await fetch(GEONAMES + "cities15000.zip");
if (!res.ok) throw new Error(`cities15000.zip: ${res.status}`);
writeFileSync(zip, Buffer.from(await res.arrayBuffer()));
execSync(`unzip -o -q "${zip}" -d "${tmp}"`);

// GeoNames columns: 1 name, 2 asciiname, 4 lat, 5 lon, 8 country code, 14 population
const cities = readFileSync(join(tmp, "cities15000.txt"), "utf8")
  .split("\n")
  .filter(Boolean)
  .map((l) => l.split("\t"))
  .filter((c) => codeSet.has(c[8]))
  .map((c) => [
    c[1],
    c[2] === c[1] ? "" : c[2],
    c[8],
    Math.round(Number(c[4]) * 1e4) / 1e4,
    Math.round(Number(c[5]) * 1e4) / 1e4,
    Number(c[14]) || 0,
  ])
  .sort((a, b) => b[5] - a[5]);

writeFileSync(join(OUT, "cities.json"), JSON.stringify(cities));
console.log(`cities.json: ${cities.length} places`);
