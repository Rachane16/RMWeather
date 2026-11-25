import importlib.util
from pathlib import Path
import unittest

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
        rows = windy.normalize_webcams({'webcams': [camera(), camera('TH.49')]})
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]['region'], 'สงขลา')

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
