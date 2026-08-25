# Vendored browser dependencies

## Leaflet 1.9.4

- Source: https://leafletjs.com/download.html
- License: BSD-2-Clause (`leaflet/LICENSE`)
- Files: unmodified stable distribution JavaScript and CSS
- Integrity: the SHA-256 hashes match the values published on the official
  Leaflet download page.

Leaflet runs locally. The demo's optional OpenStreetMap basemap requests raster
tiles from `tile.openstreetmap.org` while online.

## h3-js 4.5.0

- Source: https://github.com/uber/h3-js/releases/tag/v4.5.0
- Package: `h3-js@4.5.0` from the npm registry
- License: Apache-2.0 (`h3-js/LICENSE` and `h3-js/NOTICE`)
- Files: unmodified official browser ES module and source map
- Integrity: npm package SHA-512 verified against the registry metadata

H3 indexing and cell-boundary generation run locally in the browser. Case
coordinates are not sent to Uber or another H3 service.
