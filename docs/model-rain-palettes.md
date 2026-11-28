# Shared forecast rain colours

All ten model maps and their legend use `data/config/model-rain-palettes.json`.
The active profile is `tmd-rate-v1`. The original forecast grids, timestamps,
three-hour mean rates and point-popup values are not rewritten or converted to dBZ.

For forecast mean rates in mm/h, the TMD rain-rate categories are light 0.1–5,
moderate >5–25, heavy >25–50, and very heavy >50. Values below 0.1 are transparent;
missing values remain missing. The TMD document prints the next categories as
5.1, 25.1 and 50.1; continuous model values use the preceding upper bound as the
exclusive lower bound, so decimal forecasts have no gaps. The colour shades are
selected from the TMD RadarGIS palette, with green for light, yellow to orange for
moderate, red for heavy and magenta for very heavy. These are forecast averages
classified using rain-rate criteria, not instantaneous radar measurements.

Source: [TMD training manual, printed page 73 / PDF page 79](https://ubonmet.tmd.go.th/files/KM-base/KM-2566-1.pdf#page=79).
Radar dBZ legends and daily accumulated-rain criteria are independent.
The optional three-hour-total formatter multiplies rate boundaries by three;
it describes equivalent three-hour mean intensity, not TMD daily rainfall classes.
The current map still displays mean rate and its point popup retains both values.

## Restore the previous display

Change only `active_profile` to `windy-reference-v1` in the JSON and publish.
The renderer and legend both switch on the next page/app load. No data refresh,
grid migration, APK reinstall or native code edit is needed. Both profiles remain
stored in version control and in the deployed configuration; there is no public
palette selector. This is a display-configuration registry, not private credentials
or a new database service.

The archived profile retains the original thresholds 0 / 0.6 / 3 / 12 / 50 / 200,
all six RGB colours, continuous interpolation, transparency and saturation exactly.
The loader validates the active profile, retries failed loads and blocks model
rendering until map and legend can use the same configuration. Texture cache keys
include the palette ID. Native Android uses the same website/configuration.
