# Place Notes

Tie notes to places on a world map. Works entirely offline, on desktop
and mobile. Simple, unopiniated and markdown-native.

![The map view](docs/screenshot.png)

## How it works

A place note is an ordinary Markdown note with two optional properties:

```yaml
---
country: PT                      # ISO 3166-1 alpha-2
coordinates: [38.7169, -9.1399]  # latitude, longitude
---
```

The interactive map view lets you easily find and create these notes.

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
