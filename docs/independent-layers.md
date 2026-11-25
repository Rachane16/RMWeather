# Independent map layers — 25 November 2026

RMWeather now starts with One Data Positron, RainViewer radar and GFS wind.
The v3 basemap preference starts everyone on Positron once, then remembers their
subsequent basemap selection. The left catalogue opens on desktop arrival. The later compact-workspace update
keeps all mobile control windows closed on arrival.

RID, national water, 24-hour rain, dams, station weather and both camera networks
have independent visibility and data sources. National requests have a separate
generation counter per provider; late responses cannot replace another source,
or overwrite a newer response from the same source. Failed refreshes retain the
previous measurements with their original observation times. Popups capture the
clicked source to keep rainfall in mm and dam storage in percent.

National water uses larger blue points, rain smaller teal points and dams larger
purple points. Concentric point sizes help show coincident water/rain stations.
Camera networks retain their existing pins and clustering.

TMD, SWIRLS and RainViewer can also be enabled together. Each has a separate
MapLibre raster source; the timeline selects which enabled provider it controls.
Other enabled providers stay on their latest loaded frame. Source times and old
frame warnings remain visible; no missing coverage is synthesized.

RainViewer's current public documentation lists Universal Blue, color ID 2:
https://www.rainviewer.com/api/color-schemes.html
The map uses this palette at 46% opacity, preserving intensity colors rather than
inventing a TMD conversion. The legend follows the official Universal Blue CSV at 15–55 dBZ, with the same
46% opacity. It indicates reflectivity rather than an invented rainfall-rate conversion.
https://www.rainviewer.com/files/rainviewer_api_colors_table.csv
https://www.rainviewer.com/api/weather-maps-api.html

A separate basemap panel includes a hillshade switch using the existing
Mapterhorn DEM. It affects the selected basemap without changing its camera;
3D elevation, pitch and rotation remain separate map-view controls. The switch
starts off to keep Positron clean. Natural terrain's own relief layers follow
the same switch. Mapterhorn attribution is displayed by the map renderer.

Wind uses the existing bilinear GFS U/V field with fine blue/cyan streaks. The
animation is accelerated for readability; the field's physical values remain
unchanged. Hidden-tab behavior is retained. The subsequent camera/location update makes
animation the default and provides an explicit pause switch.

The user-provided transparent logo is bundled locally. The header clock uses
Asia/Bangkok and Thai Buddhist calendar dates. Windy remains an independent,
resizable weather-map workspace starting with observed radar over Songkhla.

Validation: Python ingestion tests, Node wind/MapLibre source tests, concurrent
national-source and popup-unit regression tests, plus browser checks of actual
points, hillshade, radar playback, Windy and responsive controls.
