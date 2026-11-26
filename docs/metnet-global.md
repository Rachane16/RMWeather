# Global MetNet: access review

Reviewed 26 November 2026. No MetNet data have been integrated or advertised as a working RMWeather layer.

- Google Research describes global precipitation nowcasts at 5 km, 15-minute timesteps and up to 12 hours lead time. Its README says production runs initialize every 30 minutes; the linked Early Access form describes hourly refreshes. Verify the actual cadence once access is approved.
- The published access route is the Google Earth Engine asset `projects/global-precipitation-nowcast/assets/metnet_nowcast`, subject to approval through the Google Nowcasting Dataset Early Access form and the associated terms. A public, anonymous map-tile or JSON endpoint suitable for this site has not been verified.
- Google Maps Platform Weather API is a separate processed-weather service using several inputs. Its output should not be labelled a direct Global MetNet precipitation layer.
- The open-source model repository does not supply pretrained weights or a ready-to-run production inference pipeline. Cloning it does not provide live forecast access.
- A future integration should use an approved Earth Engine identity/project on the private server, confirm permitted redistribution, inspect native precipitation units/valid times, cache region-limited output, preserve attribution and disclose the forecast issue/valid time. Do not put Google credentials in Pages assets or submit an access application on the owner's behalf without their instruction.

Sources:

- [Google Research model and dataset README](https://github.com/google-research/google-research/blob/master/global_metnet/README.md)
- [Weather Lab documentation](https://developers.google.com/weathernext/guides/weatherlab)
- [Dataset Early Access form](https://docs.google.com/forms/d/e/1FAIpQLSeObgf53sXtaZaim08YZYiP_KFTbiIiWYzzs1_LXCeQIKuqlw/viewform)
- [Google Weather API FAQ](https://developers.google.com/maps/documentation/weather/faq)
