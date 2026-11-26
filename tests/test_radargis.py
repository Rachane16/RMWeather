import importlib.util
import io
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
import sync_radargis as radar


def frame(stamp='2026-11-26 02:15 UTC', **extra):
    return {'group': '01 dBZ Overlay', 'title': 'dBZ', 'valid_time': stamp,
            'bounds': [[4, 91], [22, 110]], 'url': '/products/dbz/test.png?v=1', **extra}


class RadarGISTests(unittest.TestCase):
    def test_embedded_public_map_catalog_is_json_only(self):
        html = '<script>let overlays=' + json.dumps([frame()]) + '; window.untrusted=true;</script>'
        with patch.object(radar, 'open_url', return_value=io.BytesIO(html.encode())):
            result = radar.embedded_catalog()
        self.assertEqual(len(result['overlays']), 1)
        self.assertEqual(result['overlays'][0]['valid_time'], '2026-11-26 02:15 UTC')

    def test_untrusted_urls_bad_bounds_and_unzoned_times_are_excluded(self):
        catalog = {'overlays': {'overlays': [frame(), frame(url='https://evil.example/products/a.png'),
                   frame(bounds=[[22, 110], [4, 91]]), frame(stamp='2026-11-26T02:15')]}}
        rows = radar.products_from_catalog(catalog)
        self.assertEqual(len(rows), 1)
        self.assertEqual(len(rows[0]['frames']), 1)
        self.assertEqual(rows[0]['frames'][0]['frame_time'], '2026-11-26T02:15:00+00:00')

    def test_forecasts_use_issue_time_for_staleness_and_keep_only_one_run(self):
        group = '04 dBZ Nowcast Overlay'
        catalog = {'overlays': {'overlays': [frame('2026-11-26 01:30 UTC', group=group, title='T+15'),
                   frame('2026-11-26 02:30 UTC', group=group, title='T+15'),
                   frame('2026-11-26 03:15 UTC', group=group, title='T+60')]}}
        p = radar.products_from_catalog(catalog)[0]
        self.assertEqual(len(p['frames']), 2)
        self.assertEqual(p['frames'][1]['base_time'], '2026-11-26T02:15:00+00:00')
        self.assertEqual(p['frames'][1]['lead_minutes'], 60)

    def test_cache_reuses_png_without_hitting_upstream(self):
        binary = b'\x89PNG\r\n\x1a\nfixture'
        with tempfile.TemporaryDirectory() as folder, patch.object(radar, 'OUT', Path(folder)), patch.object(radar, 'open_url', return_value=io.BytesIO(binary)) as request:
            first = radar.cache_image({'remote_url': 'https://radargis.tmd.go.th/products/test.png?v=1'})
            second = radar.cache_image({'remote_url': 'https://radargis.tmd.go.th/products/test.png?v=1'})
            self.assertEqual(first, second)
            self.assertEqual(request.call_count, 1)

    def test_accumulation_has_explicit_time_and_incomplete_frame_count(self):
        catalog = {'accumulation': {'24': {'bounds': [[4, 91], [22, 110]], 'filename': 'rain_24h.png', 'end_ict': '2026-11-26T07:00', 'frames': 95, 'expected': 96}}}
        p = radar.products_from_catalog(catalog)[0]
        self.assertEqual(p['frames'][0]['frame_time'], '2026-11-26T00:00:00+00:00')
        self.assertEqual(p['frames'][0]['available_frames'], 95)
        self.assertEqual(p['id'], 'accum-24')

    def test_failed_refresh_retains_previous_frames_with_failure_status(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder);out = root/'data';out.mkdir()
            catalog = root/'catalog.json';catalog.write_text(json.dumps({'errors': ['TimeoutError']}))
            previous = {'data': {'products': [{'id': 'dbz', 'frames': [{'image_url': 'data/live/radargis/test.png', 'frame_time': '2026-11-26T02:15Z'}]}]}}
            (out/'radargis.json').write_text(json.dumps(previous))
            with patch.object(radar, 'OUT', out), patch.object(radar, 'CATALOG', catalog):
                radar.main()
            result = json.loads((out/'radargis.json').read_text(encoding='utf-8'))
            self.assertFalse(result['ok'])
            self.assertEqual(result['data']['products'], previous['data']['products'])
