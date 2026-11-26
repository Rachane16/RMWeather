import importlib.util
from pathlib import Path
import unittest
import io
import json
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('sync_windy', Path(__file__).resolve().parents[1] / 'scripts' / 'sync_windy.py')
windy = importlib.util.module_from_spec(spec)
spec.loader.exec_module(windy)


def camera(region='TH.68', **fields):
    return {'webcamId': 1, 'title': 'Songkhla', 'status': 'active',
            'location': {'country_code': 'TH', 'region_code': region,
                         'latitude': 7.19, 'longitude': 100.59},
            'player': {'day': 'https://webcams.windy.com/webcams/public/player?webcamId=1&playerType=day'},
            'urls': {'detail': 'https://webcams.windy.com/webcams/1'}, **fields}


class WindyTests(unittest.TestCase):
    def test_only_actual_songkhla_region_is_exported(self):
        rows = windy.normalize_webcams({'webcams': [camera(), camera('TH.49')]}, songkhla_only=True)
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]['region'], 'สงขลา')

    def test_nationwide_keeps_other_thai_regions_but_rejects_foreign_cameras(self):
        foreign = camera(location={'country_code': 'MY', 'region_code': 'MY.01', 'latitude': 7, 'longitude': 100})
        rows = windy.normalize_webcams({'webcams': [camera(), camera('TH.49'), foreign]})
        self.assertEqual(len(rows), 2)
        self.assertEqual(rows[0]['region_code'], 'TH.68')
        self.assertEqual(rows[1]['region_code'], 'TH.49')

    def test_only_safe_display_metadata_and_players_are_exported(self):
        item = camera(api_key='private', images={'signed': 'expiring'})
        rows = windy.normalize_webcams({'webcams': [item]})
        self.assertNotIn('api_key', rows[0])
        self.assertNotIn('images', rows[0])
        self.assertNotIn('live', rows[0]['players'])
        self.assertIn('day', rows[0]['players'])

    def test_rejects_bad_coordinates_and_untrusted_embed_urls(self):
        invalid = camera(player={'day': 'https://malicious.example/frame'})
        other = camera(location={'country_code': 'TH', 'region_code': 'TH.68',
                                 'latitude': float('nan'), 'longitude': 100.59})
        self.assertEqual(windy.normalize_webcams({'webcams': [invalid, other]}), [])

    def test_country_pagination_reads_beyond_first_page_and_deduplicates(self):
        first = [camera(webcamId=i) for i in range(50)]
        second = [camera(webcamId=49), camera('TH.49', webcamId=50)]
        replies = [io.BytesIO(json.dumps({'webcams': first, 'total': 52}).encode()),
                   io.BytesIO(json.dumps({'webcams': second, 'total': 52}).encode())]
        with patch.object(windy.urllib.request, 'urlopen', side_effect=replies) as call:
            rows, total, truncated = windy.fetch_webcams('test-key')
        self.assertEqual(len(rows), 51)
        self.assertEqual(total, 52)
        self.assertFalse(truncated)
        urls = [args.args[0].full_url for args in call.call_args_list]
        self.assertIn('offset=50', urls[1])
        self.assertIn('countries=TH', urls[1])
        self.assertNotIn('test-key', urls[1])
