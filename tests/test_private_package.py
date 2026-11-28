import base64
import json
from pathlib import Path
import tempfile
import unittest
from scripts.package_public import package
from scripts.development_storage import validate


class PrivatePackageTests(unittest.TestCase):
    def test_pages_artifact_never_contains_experimental_snapshots(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root/'assets').mkdir()
            (root/'assets'/'public.js').write_text('public')
            for name in ('index.html', 'legacy.html'):
                (root/name).write_text('<html>public</html>')
            for name in ('live/wind.json', 'live/development/clpp.json', 'development-fallback/stations.json'):
                path = root/'data'/name
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text('{}')
            package(root, root/'output')
            self.assertTrue((root/'output/data/live/wind.json').exists())
            self.assertFalse((root/'output/data/live/development').exists())
            self.assertFalse((root/'output/data/development-fallback').exists())

    def test_dirty_output_fails_closed_instead_of_publishing_old_private_files(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root/'assets').mkdir()
            (root/'data').mkdir()
            for name in ('index.html', 'legacy.html'):
                (root/name).write_text('<html></html>')
            private = root/'output/data/live/development/clpp.json'
            private.parent.mkdir(parents=True)
            private.write_text('{}')
            with self.assertRaises(ValueError):
                package(root, root/'output')

    def snapshot(self):
        items = {'ecmwf_ifs.json': {'id': 'ecmwf_ifs'}, 'manifest.json': {}, 'health.json': {}}
        return {name: {'data': base64.b64encode(json.dumps(value).encode()).decode()} for name, value in items.items()}

    def test_model_only_snapshot_rejects_traversal_and_retired_data(self):
        self.assertIn('ecmwf_ifs.json', validate(self.snapshot()))
        for name in ('../secret.txt', 'clpp.json', 'provinces.json', 'stations.json', 'frames/clpp-'+('a'*20)+'.png'):
            files = self.snapshot()
            files[name] = {'data': base64.b64encode(b'{}').decode()}
            with self.assertRaises(ValueError):
                validate(files)
        files = self.snapshot()
        del files['manifest.json']
        with self.assertRaises(ValueError):
            validate(files)
