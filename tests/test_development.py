import unittest
from scripts.sync_development import model_frames, clpp_frames


class DevelopmentDataTests(unittest.TestCase):
    def row(self, rain=None, direction=90):
        return {'hourly': {'time': [3600, 7200, 10800], 'precipitation': rain or [0, 1, 2],
                           'wind_speed_10m': [3, 3, 3], 'wind_direction_10m': [direction]*3}}

    def test_accumulation_is_three_hour_total_and_wind_is_vector_ms(self):
        frames = model_frames([self.row(), self.row(direction=270)], {'nx': 2, 'ny': 1})
        self.assertEqual(frames[0]['rain'], [3, 3])
        self.assertEqual(frames[0]['u'], [-3, 3])
        self.assertEqual(frames[0]['start'], 0)
        self.assertEqual(frames[0]['time'], 10800)

    def test_missing_rain_does_not_become_zero(self):
        frames = model_frames([self.row([None, 1, 2]), self.row()], {'nx': 2, 'ny': 1})
        self.assertIsNone(frames[0]['rain'][0])

    def test_incomplete_grid_is_rejected(self):
        with self.assertRaises(ValueError):
            model_frames([self.row()], {'nx': 2, 'ny': 2})

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
