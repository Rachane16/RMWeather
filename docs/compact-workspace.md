# Compact desktop and mobile workspace — 25 November 2026

Control-window state is now independent from map-data visibility. Desktop starts
with the left catalogue open. Mobile starts without any open window, with only
Positron, RainViewer and animated GFS wind enabled. Mobile has a compact header,
its own basemap preference and smaller, independently scrolling popups.

The weather card is closed by default on both layouts and is opened from the
layer/display panel. The display launcher uses the layers icon. The basemap
launcher is separate at the lower right, above map attribution.

The image timeline is an opt-in dropdown behind "ภาพและเวลา". Loading or enabling
a rain source never opens it automatically. All source options can be selected,
including a currently disabled source; selection enables that source and leaves
other map data intact. Closing the dropdown stops playback and restores the
latest available frame. Its compact summary always reports the provider's actual
latest frame time, rather than substituting the wall clock for an observation.

Other control popups replace one another, while an explicitly opened catalogue
remains until closed. Data-layer visibility is independent of these windows. The catalogue and display headers have close buttons only; other tool controls
remain above scrolling content. Search does not autofocus on phones. Returning
to the mobile default closes popups. Controls leave room for source attribution.

Windy retains its full interactive map and attribution, with a small floating
control box on the left. The box minimizes to a layers icon and begins as that icon on mobile.
The "กลับแผนที่หลัก" button closes Windy. On opening, Windy prefers the device
location and asks for a refreshed fix unless one is already pending. A temporary
Hat Yai fallback remains usable, with an explicit location-status caption.

A valid geolocation fix creates or updates one blue MapLibre DOM marker. It
survives basemap changes and can be clicked to recenter. Denial never invents a
current-location pin at Hat Yai. Coordinates remain in the page session; there
is no background location watch and no coordinate publishing. The source-data
ingestion, CCTV/Windy integrations and independent observation layers remain
unchanged.

Validation includes state-transition regressions for both layouts, preservation
of hidden timeline state during layer changes, device-location preference in
Windy, and marker validation/reuse/recentering. Browser checks cover 1280px
desktop, 390×844 and 320×640 mobile layouts, actual rain-source switching,
historical-frame selection and latest-frame restoration, popup minimization,
weather access through layers, the Windy back button and readable attribution.
The test browser denied device geolocation; location-marker behavior was tested
with deterministic fixes rather than fabricating a real device location.


The main category bar is available on phones as a horizontally scrollable row.
Selecting CCTV, water, wind, rain or stations replaces the prior category overlays.
Clicking Overview restores RainViewer, wind, Songkhla CCTV, RID water and stations.
Layer catalogue switches still support independent overlapping data sets. The
seven-day forecast has been removed from the category bar; it remains available
through Display Layers.


The catalogue now remains open until the user closes it, including after map
clicks, layer changes and opening another control. Main categories toggle off on
a repeated click. On phones category clicks update map points/overlays without
opening the results drawer; details are opened explicitly through map points or
catalogue detail actions. Display Layers shares the catalogue green theme and
mirrors its order, including Windy beside RainViewer and wind; weather widgets
are below the data controls. Forecast table width is capped at 1600px on wide
screens. Direct zoom buttons sit above the separate basemap launcher.
