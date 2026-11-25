import importlib.util
from pathlib import Path
import unittest
import io
import hashlib
import tempfile
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('sync_data', Path(__file__).resolve().parents[1] / 'scripts' / 'sync_data.py')
sync = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sync)


class PublicDataTests(unittest.TestCase):
    def test_rod_times_bounds_order_and_recent_window(self):
        payload = {'overlay_ready': True, 'bounds': [95, 4, 108, 22.5], 'frames': [
            {'local_rel': f'frames/frame_{i}.png', 'sha256': 'a' * 64,
             'time_utc': f'2026-11-25T{i:02d}:00Z'} for i in range(20)]}
        rows = sync.rod_frames(payload)
        self.assertEqual(len(rows), 13)
        self.assertEqual(rows[0]['frame_time'], '2026-11-25T07:00:00+00:00')
        self.assertEqual(rows[-1]['bounds'], [[4, 95], [22.5, 108]])

    def test_rod_rejects_unreferenced_images_and_unsafe_paths(self):
        with self.assertRaises(ValueError):
            sync.rod_frames({'overlay_ready': False, 'bounds': [95, 4, 108, 22.5]})
        payload = {'overlay_ready': True, 'bounds': [95, 4, 108, 22.5], 'frames': [
            {'local_rel': '../private.png', 'sha256': 'a'*64, 'time_utc': '2026-11-25T09:00Z'}]}
        self.assertEqual(sync.rod_frames(payload), [])

    def test_rod_checks_content_hash_before_publishing_local_png(self):
        binary = b'\x89PNG\r\n\x1a\nradar-test'
        digest = hashlib.sha256(binary).hexdigest()
        payload = {'overlay_ready': True, 'bounds': [95, 4, 108, 22.5], 'frames': [
            {'local_rel': 'frames/test.png', 'sha256': digest, 'time_utc': '2026-11-25T09:00Z'}]}
        with tempfile.TemporaryDirectory() as folder, patch.object(sync, 'OUT', Path(folder)), patch.object(sync, 'open_url', return_value=io.BytesIO(binary)):
            row = sync.download_rod(payload)[0]
            self.assertEqual(row['image_url'], 'data/live/radar/rod-' + digest[:16] + '.png')
            self.assertNotIn('sha256', row)
            self.assertEqual((Path(folder)/'radar'/('rod-' + digest[:16] + '.png')).read_bytes(), binary)
        payload['frames'][0]['sha256'] = 'a'*64
        with tempfile.TemporaryDirectory() as folder, patch.object(sync, 'OUT', Path(folder)), patch.object(sync, 'open_url', return_value=io.BytesIO(binary)):
            with self.assertRaises(ValueError):
                sync.download_rod(payload)

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
