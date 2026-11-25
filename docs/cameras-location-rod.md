# Camera rendering, moving wind and location — 25 November 2026

Camera clusters were missing on Positron because its glyph server returns 404
for `Noto Sans Medium/0-255.pbf`. Single camera pins rendered while groups of
cameras disappeared. The cluster count is now rendered into a local canvas
sprite through MapLibre's `styleimagemissing` handler. It requires no remote
font and is regenerated after every basemap style change. Existing camera pins,
clustering, expansion clicks and details are retained.

CCTV images prefer One Data's captured-image route, with the original source
as a one-time fallback. The detail image reserves its space while loading.
Windy webcams retain their public day/timelapse player, source link and timestamps.

Wind now animates by default, including on devices whose OS requests reduced
motion, as explicitly requested by the user. An independent "เคลื่อนไหวลม"
switch in map controls allows a static field. Animation pauses in hidden tabs.
GFS interpolation and physical values are unchanged; shorter, finer trails
reduce clutter. Native image radar frames update in place, identical frames
are not reloaded, and canceled map requests do not produce false radar warnings.
Playback waits for a pending image. Observed-source freshness uses its latest
frame, so choosing a historical frame does not falsely mark the provider stale.

The new right-side list mirrors the left catalogue's groups and independent
visibility. The left catalogue uses three smaller cards per row. The supplied
droplet PNG is the favicon and the logo has a WEATHER & WATER MONITOR tagline.

The page requests browser geolocation once at startup, at normal accuracy,
with a ten-second timeout. Granted coordinates update the native map, local
forecast and Windy. They are held only in the page session, never written to
the repository or public snapshots. Denial/unavailability retains Hat Yai and
a usable location button. The subsequent compact-workspace update makes Windy prefer the current device
fix, refresh its location when opened, and provide a back-to-main-map button.
Its floating glass controls leave Windy's own logo and zoom controls visible.

## RODDSS radar

Public entry point: https://www.oas.psu.ac.th/rodplatform/RODDSS/
Catalog: https://www.oas.psu.ac.th/rodplatform/RODDSS/radar_catalog_48h.php
Images: https://www.oas.psu.ac.th/rodplatform/live/tmd_radar/frames/

The inspected catalog exposes TMD Composite images, UTC/ICT frame times,
SHA-256 hashes and georeferenced bounds `[95, 4, 108, 22.5]` (west/south/east/north).
The latest frame at inspection was 16:15 ICT. These are observed radar frames,
not SWIRLS forecast frames. The upstream application can show 48 hours; RMWeather
publishes only the latest 13 frames (about three hours) to limit repeated image
transfers. RainViewer remains the default and all rain providers can coexist.

The catalog did not send a CORS header. GitHub Actions therefore fetches its
allowlisted metadata and PNGs into same-origin public files. Each PNG must match
its catalog checksum. Paths, timestamps and bounds are validated; arbitrary URLs
and traversal paths are rejected. The optional certifi CA bundle is installed
by the deploy job so the PSU HTTPS chain verifies on Windows and Linux. TLS
certificate checks remain enabled.

One Data's TMD/SWIRLS products are retained with their original frame times and
old-frame warnings; no old imagery is relabeled as current.

Validation includes regression tests for cluster glyph independence, in-place
image playback, animation/pause, location grant/denial/races and radar metadata,
hashes and bounds. Live source fetches and actual map overlays were checked in
the browser, along with camera stills, Windy playback and responsive controls.
