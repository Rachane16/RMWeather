# RadarGIS, ThaiWater and webcam scope

The default map remains Positron with RainViewer and animated blue GFS wind. Wind contrast is fixed at 3; the two user-facing wind settings have been removed. Desktop retains its initial catalogue; mobile keeps all popups closed.

The catalogue order is rain/wind, radar imagery, Songkhla cameras/stations, then national observations. The mirrored quick layer menu uses the same catalogue. The playback launcher and player are centered on the whole map with or without the sidebar.

## TMD RadarGIS

`scripts/sync_radargis.py` reads `https://radargis.tmd.go.th/api/overlays` and `/api/rainfall-accumulation`. The verified HTTPS hostname is used rather than `www2`, which failed hostname verification during investigation. TLS verification remains enabled. The public endpoints required no API key at verification time; these are website endpoints, not a versioned API contract or a guarantee of uptime/licensing.

The optional RadarGIS layer offers dBZ, rain rate, lightning risk, their nowcasts, and 3/6/12/24-hour accumulations. Upstream lightning risk is derived from reflectivity; it is not a lightning detector feed. Forecast issue time is derived from valid time minus lead time. Frames from different forecast runs are never combined. Observation and forecast times remain distinct, and accumulation completeness is displayed.

JSON and images did not provide cross-origin headers at verification. Actions publishes validated PNGs on the same origin as the website. A content-derived Actions cache reuses images until the upstream catalog changes. URLs are restricted to the source host and expected paths, bounds and zoned times are validated, and failed updates retain cached products with an error status. Old image assets are pruned only after a replacement catalog is assembled. Upstream checks are scheduled every five minutes; the browser refreshes published catalogs every minute. Actions scheduling, publishing and source processing can add delay.

Some GitHub runners received HTTP 403 while others could read the same public endpoints. The collector identifies RMWeather, supplies the public-map referrer and can parse the map's embedded initial JSON catalog without executing scripts. Only successful, complete refreshes save a new cache; a failed catalog fetch restores the most recent successful cache rather than an older empty cache. A dated public fallback in `data/radargis-fallback` supplies initial images when no successful runner cache exists. Fallback images keep their actual observation/forecast times and failures remain visible; they are not relabeled as fresh observations.

## ThaiWater details

National rainfall, river level and dam layers still load independently. Normalization retains station IDs, address, agency, sponsor, basin, source timestamps and measurement units. Unzoned station timestamps are interpreted as ICT. Date-only dam reports stay date-only.

Water cards display the upstream situation, distance to bank, water elevation, bank elevation and riverbed elevation. Bank calculations are only used when the datum is compatible. Missing values stay unknown. Rainfall cards show 24-hour and available 1-hour totals, agency and station sponsor. Reservoir cards display storage, normal capacity, usable water, inflow and release with daily units. No missing measurements, station sponsors, trends or graphs are fabricated.

## Windy webcams

`sync_windy.py` requests country TH and paginates within the free-plan offset limit, retaining the original translated region and region code. The envelope reports truncation if the free-plan cap is reached. Only safe display metadata and stable Windy player/detail URLs are exported; the API key remains an Actions secret and temporary signed images are not published.

The Songkhla CCTV layer combines HatyaiClimate/OneData cameras with Windy cameras in TH.68. The national Windy layer contains Thailand cameras; Songkhla duplicates are suppressed on the map only while the combined CCTV layer is enabled. Each popup still uses the correct source/player.

## Validation

Python and Node tests exercise scope filtering, independent overlays, datum and missing-value handling, source timestamps, camera deduplication, forecast run/time validation, cache reuse and failed-refresh retention. Browser checks cover real station metadata, playback/product switching, centered controls and clean mobile startup.
