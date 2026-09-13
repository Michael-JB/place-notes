# Contributing

## Development

```sh
npm install
npm run dev      # rebuilds main.js on change
npm run build    # typecheck and production build
npm run data     # regenerate data/ from upstream sources (needs network)
```

To try it, symlink or copy `main.js`, `manifest.json` and `styles.css`
into a vault's `.obsidian/plugins/place-notes/` folder.

## Releasing

Uses [Release Please](https://github.com/googleapis/release-please).

Use [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) and
get the audience right: `feat`, `fix`, `perf` and `revert` commits appear in
the changelog, so word those for users. `chore`, `docs`, `style`, `refactor`,
`test`, `build` and `ci` commits are for developers.

Update `versions.json` by hand when `minAppVersion` changes.
