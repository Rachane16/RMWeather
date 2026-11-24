import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('sync_data', Path(__file__).resolve().parents[1] / 'scripts' / 'sync_data.py')
sync = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sync)


class PublicDataTests(unittest.TestCase):
    def test_admin_fields_are_never_exported(self):
        rows = sync.sanitize('water', [{'level': None, 'manual_flag_by': 'private', 'pending_at': 'private'}])
        self.assertIsNone(rows[0]['level'])
        self.assertNotIn('manual_flag_by', rows[0])
        self.assertNotIn('pending_at', rows[0])

    def test_image_route_uses_source_origin(self):
        rows = sync.sanitize('cameras', [{'image_url': '/api/data/camera-image?camera_slug=hatyainai'}])
        self.assertEqual(rows[0]['image_url'], sync.BASE + '/api/v1/data/camera-image?camera_slug=hatyainai')

    def test_rejects_malformed_responses(self):
        for name, value in [('water', {}), ('wind', {'records': []})]:
            with self.assertRaises(ValueError):
                sync.sanitize(name, value)

    def test_radar_exports_no_base64_and_preserves_local_image(self):
        rows = sync.sanitize('radar', [{'objectid': 123, 'image_url': 'data/live/radar/radar-123.png', 'image_bytes': 'large-private-build-field'}])
        self.assertEqual(rows[0]['image_url'], 'data/live/radar/radar-123.png')
        self.assertNotIn('image_bytes', rows[0])
