// Regenerates the bundled datasets in data/. Run with `npm run data`.
// Network is needed here and only here; the plugin itself is offline.
//
// Sources:
//   GeoNames countryInfo.txt and cities15000.zip  (CC BY 4.0)
//   Natural Earth 1:110m admin 0 countries (public domain)

import { execSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { topology } from "topojson-server";

const OUT = new URL("../data/", import.meta.url).pathname;
const GEONAMES = "https://download.geonames.org/export/dump/";
const NATURAL_EARTH_TAG = "v5.1.2";
const NATURAL_EARTH = `https://raw.githubusercontent.com/nvkelso/natural-earth-vector/${NATURAL_EARTH_TAG}/geojson/ne_110m_admin_0_countries.geojson`;

// One row per line so that pull request diffs read as added and removed places.
function rows(list) {
  return `[\n${list.map((r) => JSON.stringify(r)).join(",\n")}\n]\n`;
}

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
const codeSet = new Set(countries.map((c) => c.code));

writeFileSync(join(OUT, "countries.json"), rows(countries));
console.log(`countries.json: ${countries.length} countries`);

// --- world map ------------------------------------------------------------

const geojson = JSON.parse(await fetchText(NATURAL_EARTH));
let unmatched = [];
const features = geojson.features.map((f) => {
  const p = f.properties;
  const name = p.NAME ?? "";
  const iso = codeSet.has(p.ISO_A2_EH) ? p.ISO_A2_EH : null;
  if (!iso) unmatched.push(name);
  return { type: "Feature", geometry: f.geometry, properties: { name, iso } };
});
const atlas = topology({ countries: { type: "FeatureCollection", features } }, 1e4);
writeFileSync(join(OUT, "countries-110m.json"), JSON.stringify(atlas));
console.log(
  `countries-110m.json: ${features.length} shapes from Natural Earth ${NATURAL_EARTH_TAG}` +
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

writeFileSync(join(OUT, "cities.json"), rows(cities));
console.log(`cities.json: ${cities.length} places`);
