# Natural Terrain and weather workspace

Updated 25 November 2026. The existing datasets and `legacy.html` are retained.

The main map now uses MapLibre GL JS 5.6.1, rather than a MapLibre basemap inside
Leaflet. Rain image sources, clustered CCTV and station GeoJSON sources share the
same camera, including pitch and bearing. Sources are restored after each style
change; changing basemap preserves center, zoom, bearing, terrain mode and layers.
GFS particles interpolate the original geographic U/V grid and project each step
through the map camera. The animation is accelerated for readability; the source
values remain m/s. Reduced-motion mode uses fewer particles.

## Default view

- MAP LAYERS opens at startup and can be closed and reopened.
- SWIRLS forecast rain, GFS wind and the current-weather panel are enabled.
- Other existing datasets are available from the catalogue and category tabs.
- `rm-basemap-v2` stores an explicit basemap choice. First visits and users
  migrating from the previous basemap preference start with Natural Terrain.
- A 2D/3D button enables terrain (1.2× exaggeration), a pitch slider supports
  0–70 degrees, and a north button resets bearing. Desktop right-drag and mobile
  MapLibre touch gestures also rotate/tilt. The default is top-down 2D hillshade.

## Sources and credits

- ELEMNT Topographic style, adapted with cream land, pale-blue water, quieter
  roads and Thai-first labels. Thai label availability depends on OSM coverage.
  Original: https://carto.elemnt.earth/2026-06-24_topographic/style.json
  Usage: https://carto.elemnt.earth/USE.md
- OSM PMTiles using the Protomaps-derived schema, served by ELEMNT; PMTiles 4.3.0.
  The required Powered by ELEMNT link is shown bottom left and OSM/Protomaps
  attribution remains in the MapLibre attribution control.
- Mapterhorn public Terrarium DEM, 512 px, maxzoom 12, global ~30 m coverage.
  Separate source instances serve hillshade and terrain to avoid shared DEM
  rendering artefacts. Source: https://mapterhorn.com/data-access
  Attribution: https://mapterhorn.com/attribution
- GEBCO shaded relief via its public WMS, beneath opaque OSM land and translucent
  ocean fills. This is a raster depiction of bathymetry, not an underwater 3D
  terrain mesh or a navigation chart. The current GEBCO_2026 service, EPSG:3857,
  PNG images and wildcard CORS were verified; raster zoom is capped at 8.
  https://www.gebco.net/data-products/gebco-web-services/web-map-service
- All five earlier basemap choices are retained. Styling does not change the
  website's upstream observation/snapshot refresh schedule.

## Additional weather categories

The reference https://ron-youtube.pages.dev/ embeds Windy and TMD directly.
RMWeather uses these original services, not a copy of that site's camera feed:

- Optional Windy Embed centered on the selected forecast coordinate, with
  forecast rain, wind, temperature, cloud, pressure and observed radar choices.
  It is a separate interactive map, not a raw Windy data API in the RM layers.
  Existing Windy branding and links remain visible. Closing unloads the iframe.
- Seven-day Open-Meteo table for the selected coordinate; API forecast_days=7.
- Optional official TMD seven-day widget, initially Songkhla, with a province
  selector. It is loaded only when chosen and scrolls horizontally on small
  screens. TMD area rainfall percentages differ from Open-Meteo point rain
  probabilities; their displays and sources are kept separate.

Both categories can be toggled from the top navigation or MAP LAYERS. Only one
large weather workspace is open at once. Closing it preserves the main layers.
The Open-Meteo table remains available even if an external iframe is unavailable.

## Windy webcams: pending a key

The owner confirmed they do not yet have a Windy Webcams API key and prefer the
free plan. No Windy camera count or working camera feed is claimed or fabricated.
The catalogue links to https://api.windy.com/webcams/pricing to obtain a key.
Free access permits linked images or an embedded timelapse player, limited image
size and image URLs valid for 15 minutes according to the current pricing page.
Docs: https://api.windy.com/webcams/docs . Once a key is available, the next
integration must request camera metadata and filter actual Songkhla locations,
retain Windy attribution, and refresh expiring images. Do not commit a key.

## Verification

Browser checks cover initial open/close catalogue, SWIRLS default, actual Thai
terrain labels, 3D/pitch, CCTV details and clusters, original satellite basemap,
working Windy embed, Songkhla TMD seven-day forecast and mobile 390×844 layout.
Node tests cover geographic wind interpolation and missing/out-of-grid values;
existing national water/rain/dam normalization and snapshot tests remain in CI.
