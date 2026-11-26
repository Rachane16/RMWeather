import unittest
import datetime as dt
from scripts.sync_development import model_frames, clpp_frames, GRID, MODELS, MODEL_CACHE_HOURS, forecast_window, model_grid


class DevelopmentDataTests(unittest.TestCase):
    def row(self, rain=None, direction=90):
        return {'hourly': {'time': [3600, 7200, 10800], 'precipitation': rain or [0, 1, 2],
                           'wind_speed_10m': [3, 3, 3], 'wind_direction_10m': [direction]*3}}

    def test_rate_is_three_hour_mean_not_three_hour_total_and_wind_is_vector_ms(self):
        frames = model_frames([self.row(), self.row(direction=270)], {'nx': 2, 'ny': 1})
        self.assertEqual(frames[0]['rain'], [1, 1])
        self.assertEqual(frames[0]['u'], [-3, 3])
        self.assertEqual(frames[0]['start'], 0)
        self.assertEqual(frames[0]['time'], 10800)

    def test_missing_rain_does_not_become_zero(self):
        frames = model_frames([self.row([None, 1, 2]), self.row()], {'nx': 2, 'ny': 1})
        self.assertIsNone(frames[0]['rain'][0])

    def test_incomplete_grid_is_rejected(self):
        with self.assertRaises(ValueError):
            model_frames([self.row()], {'nx': 2, 'ny': 2})

    def test_thailand_and_seas_covered_by_every_model_without_exceeding_free_budget(self):
        for model in MODELS:
            g = model_grid(model)
            south, east = g['north']-(g['ny']-1)*g['step'], g['west']+(g['nx']-1)*g['step']
            for lat, lon in [(20.5, 100), (5.6, 101), (8, 96), (10, 103), (5, 109), (2, 100)]:
                self.assertTrue(south <= lat <= g['north'] and g['west'] <= lon <= east)
            self.assertAlmostEqual(g['west'], 82)
            self.assertAlmostEqual(east, 124)
            self.assertAlmostEqual(g['north'], 30)
            self.assertAlmostEqual(south, -6)
            self.assertLessEqual(g['step'], 3)
        self.assertNotIn('ecmwf_ifs025', MODELS)
        self.assertIn('ecmwf_ifs', MODELS)
        self.assertIn('google_weathernext3_ensemble_mean', MODELS)
        self.assertIn('best_match', MODELS)
        self.assertIn('ukmo_global_deterministic_10km', MODELS)
        self.assertEqual(len(MODELS), 10)
        one_cycle = sum(model_grid(m)['nx']*model_grid(m)['ny'] for m in MODELS)
        self.assertLessEqual(one_cycle, 5000)
        self.assertLessEqual(one_cycle*24/MODEL_CACHE_HOURS, 9000)

    def test_unavailable_forecast_tail_is_omitted_instead_of_a_blank_last_frame(self):
        row = self.row()
        row['hourly']['time'] += [14400, 18000, 21600]
        for name in ('precipitation', 'wind_speed_10m', 'wind_direction_10m'):
            row['hourly'][name] += [None]*3
        frames = model_frames([row], {'nx': 1, 'ny': 1})
        self.assertEqual(len(frames), 1)

    def test_all_batches_share_a_fixed_99_hour_utc_window_with_complete_three_hour_rain(self):
        begin, end = forecast_window(dt.datetime(2026, 11, 26, 23, 59, tzinfo=dt.timezone.utc))
        self.assertEqual(begin, '2026-11-26T22:00')
        self.assertEqual(dt.datetime.fromisoformat(end)-dt.datetime.fromisoformat(begin), dt.timedelta(hours=98))

    def frame(self, **changes):
        frame = {'time': 0, 'time_utc': '1970-01-01T00:00:00Z', 'kind': 'present',
                 'offset_min': 0, 'url': '/api/frames/0.png?v=1', 'bounds': [[4, 91], [22, 110]]}
        return {**frame, **changes}

    def test_explicit_utc_and_dynamic_image_query_are_preserved(self):
        frames = clpp_frames({'frames': [self.frame()]})
        self.assertEqual(frames[0]['time'], 0)
        self.assertTrue(frames[0]['source_url'].endswith('?v=1'))

    def test_ambiguous_times_or_untrusted_image_hosts_are_rejected(self):
        for changes in ({'time_utc': '1970-01-01T00:00:00'}, {'time': 25200},
                        {'url': 'https://example.org/api/frames/a.png'}, {'bounds': [[22, 91], [4, 110]]}):
            with self.assertRaises(ValueError):
                clpp_frames({'frames': [self.frame(**changes)]})
