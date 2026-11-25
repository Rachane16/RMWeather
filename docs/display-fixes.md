# Display and Windy webcams update — 25 November 2026

## Invisible rain images

MapLibre image sources do **not** accept the `attribution` property used by
tile sources. The previous image configuration produced a style validation
error; the map's error listener consumed it while the timeline still appeared
to work. Removing that unsupported image-source property restores the actual
TMD/SWIRLS pixels. `makeRainSource` is covered by a regression test for accepted
properties and clockwise longitude/latitude corners. TMD/One Data remains named
in the timeline/source information. Raster-tile radar attribution is unchanged.

The existing One Data snapshots, all original observation layers, earlier
basemaps and `legacy.html` are retained. SWIRLS and wind remain enabled initially.
Upstream TMD frames can be old even when the manifest was regenerated recently;
the timeline retains the actual frame timestamp and now explicitly identifies
old upstream frames. The direct TMD manifest was reachable during research but
had the same old forecast cycle, so no silent source replacement was made.

## Terrain and layout

- Mapterhorn elevation colors now distinguish plains, hills and mountains in
  2D, combined with stronger hillshade. This is a real DEM color-relief layer,
  not land-cover colors alone. The color-relief layer is supported by the pinned
  MapLibre 5.6.1; ocean-level DEM values are transparent to retain GEBCO relief.
- Category navigation is centered. Smaller desktop/tablet widths use a centered
  second row; mobile keeps horizontal scrolling with accessible category labels.
- Left MAP LAYERS remains initially open and closable. Data selection stays here.
- A separate right **การแสดงผล** drawer controls the current-weather card,
  Windy weather workspace and seven-day TMD forecast. A second right
  **เครื่องมือแผนที่** tray contains basemaps, zoom, terrain, pitch, north,
  locate and reset. It starts hidden. These tray buttons have explicit labels
  when their text is hidden on mobile.
- The weather card uses condition-appropriate sun/cloud/rain/thunder symbols,
  min/max temperatures, clear metrics and a TMD forecast shortcut. It refreshes
  its selected-coordinate forecast every ten minutes while visible in the tab.
- Windy's weather workspace starts at Songkhla (7.19, 100.59), zoom 8,
  **observed weather radar**, without forcing an incompatible forecast product.
- The seven-day workspace opens directly to the official TMD Songkhla widget.
  Existing Open-Meteo current/daily values are retained for the weather card.

## Windy Webcams API v3

The owner supplied a key with a domain restriction for rachane16.github.io.
It was encrypted into GitHub Actions secret `WINDY_WEBCAMS_API_KEY`; it is never
committed, rendered in the page, printed or included in snapshot files.

`scripts/sync_windy.py` requests `location,player,urls` for country TH and region
**TH.68**, which was verified from Windy's `/regions` endpoint as Songkhla.
Normalization checks the returned country/region, finite plausible coordinates,
and HTTPS player/detail host allowlists. It exports only display fields.
The configured RMWeather origin/referer accompanies backend requests.

Testing found **23 Songkhla webcams**, with day/month/year/lifetime timelapse
players and no `live` player in this response. The UI labels these as Timelapse;
it does not claim continuous live video. Existing water-situation cameras and
Windy cameras have separate layer controls and tabs in the CCTV category.

The public metadata snapshot contains stable player URLs. It deliberately omits
signed image URLs, which expire within minutes on the free plan. Players retain
Windy branding and links, fetch their own current content and unload when the
detail dialog closes. The GitHub workflow refreshes metadata on its existing
approximately five-minute schedule; actual execution can be delayed by GitHub.

Official references:

- https://api.windy.com/webcams/docs
- https://api.windy.com/webcams/pricing
- https://maplibre.org/maplibre-style-spec/sources/#image
- https://maplibre.org/maplibre-style-spec/layers/#color-relief

## Validation

Seven Python tests cover safe snapshots and Songkhla-only Windy normalization;
five Node tests cover hydro normalization, geographic wind and the rain-source
regression. Browser checks include visible rain pixels, elevation relief,
23 Windy cameras and an actual working timelapse, right-side switches, hidden
tools, Windy observed radar at Songkhla, and TMD-first seven-day forecasts.


## Sarabun, map icons and wind visibility

The supplied Sarabun Regular/Medium/SemiBold/Bold files are self-hosted under
`assets/fonts` with their 400/500/600/700 weights and the upstream SIL OFL license.
The UI no longer depends on Google Fonts requests. Vector-basemap labels retain
ELEMNT's PBF glyph stack; HTML UI and tooltips use Sarabun.

Canvas-drawn camera, water, weather and Windy pins replace the undifferentiated
circles. Cameras have a dark camera/count cluster badge, with click-to-zoom;
hover identifies the item. A green/grey badge denotes fresh/old source data,
not a flood warning level. The artwork is original, using the reference's visual
hierarchy; no third-party icon files were copied. Textures are re-added after
style changes and rendered at double resolution.

Wind now uses denser, longer white streaks with a dark outline, making motion
visible on pale terrain, imagery and rain. The original GFS U/V values are
unchanged; visual motion is accelerated. Particle counts are limited on mobile
and in reduced-motion mode. The map-tool tray contains a 1–3 contrast slider.
The wind canvas uses the display's pixel ratio (capped at 2).
