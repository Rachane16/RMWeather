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
    def test_live_schema_uses_valid_time_not_buggy_epoch_or_latest_update(self):
        raw = json.loads((Path(__file__).parent/'fixtures'/'radargis-live-schema.json').read_text(encoding='utf-8'))
        products = radar.products_from_catalog({'overlays': raw})
        self.assertEqual(len(products), 6)
        self.assertEqual(sum(len(p['frames']) for p in products), 60)
        latest = next(p for p in products if p['id']=='dbz')['frames'][-1]
        self.assertEqual(latest['frame_time'], '2026-11-26T07:45:00+00:00')
        import datetime as dt
        self.assertEqual(dt.datetime.fromisoformat(latest['frame_time']).astimezone(dt.timezone(dt.timedelta(hours=7))).hour, 14)
        self.assertTrue(latest['remote_url'].endswith(raw['overlays'][7]['url'].split('?')[1]))
        first = raw['overlays'][0]
        self.assertEqual(dt.datetime.fromisoformat(radar.utc_stamp(first['valid_time'])).timestamp()-first['valid_dt_ts'], 7*3600)
        raw['latest_update']='2099-01-01';raw['overlays'][0]['valid_dt_iso']='2099-01-01';raw['overlays'][0]['valid_dt_ts']=0
        self.assertEqual(radar.products_from_catalog({'overlays':raw})[0]['frames'][0]['frame_time'],'2026-11-26T06:00:00+00:00')

    def test_valid_time_without_suffix_is_utc_by_contract(self):
        self.assertEqual(radar.utc_stamp('2026-11-26T07:45:00'),'2026-11-26T07:45:00+00:00')

    def test_version_query_is_kept_in_request_and_cache_identity(self):
        binary=b'\x89PNG\r\n\x1a\nfixture'
        with tempfile.TemporaryDirectory() as folder, patch.object(radar,'OUT',Path(folder)), patch.object(radar,'open_url',side_effect=lambda *a,**k:io.BytesIO(binary)) as request:
            first=radar.cache_image({'remote_url':radar.BASE+'/products/test.png?v=1'})
            second=radar.cache_image({'remote_url':radar.BASE+'/products/test.png?v=2'})
            self.assertNotEqual(first['image_url'],second['image_url'])
            self.assertTrue(first['source_url'].endswith('?v=1'))
            self.assertTrue(request.call_args_list[1].args[0].full_url.endswith('?v=2'))

    def test_embedded_public_map_catalog_is_json_only(self):
        html = '<script>let overlays=' + json.dumps([frame()]) + '; window.untrusted=true;</script>'
        with patch.object(radar, 'open_url', return_value=io.BytesIO(html.encode())):
            result = radar.embedded_catalog()
        self.assertEqual(len(result['overlays']), 1)
        self.assertEqual(result['overlays'][0]['valid_time'], '2026-11-26 02:15 UTC')

    def test_untrusted_urls_bad_bounds_and_unzoned_times_are_excluded(self):
        catalog = {'overlays': {'overlays': [frame(), frame(url='https://evil.example/products/a.png'),
                   frame(bounds=[[22, 110], [4, 91]]), frame(stamp='not-a-time')]}}
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

    def test_first_failed_refresh_uses_dated_public_seed_without_faking_frame_time(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder);out = root/'output';out.mkdir()
            seed = root/'data'/'radargis-fallback';seed.mkdir(parents=True)
            name = 'a'*24+'.png';(seed/name).write_bytes(b'\x89PNG\r\n\x1a\nfixture')
            old = {'fetched_at':'2026-11-26T02:30Z', 'data':{'products':[{'id':'dbz','frames':[{'image_url':'data/live/radargis/'+name,'frame_time':'2026-11-26T02:15Z'}]}]}}
            (seed/'catalog.json').write_text(json.dumps(old))
            catalog = root/'catalog.json';catalog.write_text(json.dumps({'errors':['HTTPError HTTP 403']}))
            with patch.object(radar,'ROOT',root),patch.object(radar,'OUT',out),patch.object(radar,'CATALOG',catalog):
                radar.main()
            result=json.loads((out/'radargis.json').read_text(encoding='utf-8'))
            self.assertFalse(result['ok']);self.assertEqual(result['retained_from'],old['fetched_at'])
            self.assertEqual(result['data']['products'][0]['frames'][0]['frame_time'],'2026-11-26T02:15Z')
            self.assertTrue((out/'radargis'/name).exists())
