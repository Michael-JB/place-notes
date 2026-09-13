# Place Notes

An Obsidian plugin that lets you tie notes to places on a map. Works
entirely offline, on desktop and mobile.

![The map view](docs/screenshot.png)

## How it works

A place note is an ordinary Markdown note with two optional properties:

```yaml
---
country: PT                      # ISO 3166-1 alpha-2
coordinates: [38.7169, -9.1399]  # latitude, longitude
---
```

Nothing else is required: no folders, tags, templates or plugin-owned
data. Remove the plugin and your notes are exactly as they were.

## Install

Not yet in the community plugin list. To install manually, download
`main.js`, `manifest.json` and `styles.css` from the latest release into
`<your vault>/.obsidian/plugins/place-notes/` and enable the plugin in
Settings -> Community plugins.

## Data and licenses

The plugin code is MIT licensed. It bundles:

- Country outlines from [Natural Earth](https://www.naturalearthdata.com/)
  (public domain).
- Country codes, city and town names from
  [GeoNames](https://www.geonames.org/), licensed under
  [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
