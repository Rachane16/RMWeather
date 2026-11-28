"""Transfer the experimental cache through its authenticated private API only."""
import argparse
import base64
import json
import os
from pathlib import Path
import re
import ssl
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'data' / 'live' / 'development'
PATTERN = re.compile(r'(?:manifest|health|ecmwf_ifs|google_weathernext3_ensemble_mean|best_match|ecmwf_aifs025_single|icon_global|gfs_global|ukmo_global_deterministic_10km|meteofrance_arpege_world|jma_gsm|cma_grapes_global)\.json')


def validate(files):
    decoded = {}
    for name, item in files.items():
        if not PATTERN.fullmatch(name):
            raise ValueError('Unexpected snapshot filename')
        content = base64.b64decode(item['data'], validate=True)
        if name.endswith('.png'):
            if not content.startswith(b'\x89PNG\r\n\x1a\n'):
                raise ValueError('Invalid PNG')
        else:
            json.loads(content)
        decoded[name] = content
    required = {'manifest.json', 'health.json'}
    if not required.issubset(decoded):
        raise ValueError('Incomplete private snapshot')
    return decoded


def transfer(restore=False, folder=OUT, config=None):
    config = config or os.environ
    origin = config.get('DEVELOPMENT_ACCESS_URL', 'https://rmweather-development-access.rachane-16.chatgpt.site').rstrip('/')
    if not origin.startswith('https://'):
        raise ValueError('HTTPS required')
    token = config.get('DEVELOPMENT_UPLOAD_TOKEN')
    if not token:
        raise ValueError('Private uploader not configured')
    headers = {'User-Agent': 'Mozilla/5.0 (compatible; RMWeather/1.0; +https://rachane16.github.io/RMWeather/)',
               'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json'}
    body = None
    if not restore:
        files = {path.relative_to(folder).as_posix(): {'data': base64.b64encode(path.read_bytes()).decode('ascii')}
                 for path in folder.rglob('*') if path.is_file() and PATTERN.fullmatch(path.relative_to(folder).as_posix())}
        validate(files)
        body = json.dumps({'files': files}, separators=(',', ':')).encode()
    request = urllib.request.Request(origin + '/admin/snapshot', headers=headers, data=body)
    context = ssl.create_default_context()
    try:
        import certifi
        context.load_verify_locations(cafile=certifi.where())
    except ImportError:
        pass
    with urllib.request.urlopen(request, timeout=90, context=context) as response:
        content = response.read(8*1024*1024+1)
    if len(content) > 8*1024*1024:
        raise ValueError('Snapshot too large')
    payload = json.loads(content)
    if restore:
        decoded = validate(payload['files'])
        root = folder.resolve()
        for name, value in decoded.items():
            target = (root/name).resolve()
            if not target.is_relative_to(root):
                raise ValueError('Snapshot path outside private cache')
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(value)
        print('Restored private experimental cache:', len(decoded), 'files')
    else:
        if not payload.get('ok'):
            raise ValueError('Upload did not complete')
        print('Updated private experimental cache:', payload.get('files'), 'files')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--restore', action='store_true')
    parser.add_argument('--folder', type=Path, default=OUT)
    parser.add_argument('--stdin-config', action='store_true')
    args = parser.parse_args()
    if args.stdin_config:
        import sys
        # The execution helper sends configuration on hidden stdin, never argv.
        config = json.loads(sys.stdin.readline())
    else:
        config = None
    transfer(args.restore, args.folder, config)
