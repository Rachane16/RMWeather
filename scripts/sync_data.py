"""Build a public, read-only snapshot for GitHub Pages. No credentials required."""
import concurrent.futures
import base64
import datetime as dt
import json
import hashlib
import math
import re
import ssl
from pathlib import Path
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'data' / 'live'
BASE = 'https://onedata-surv.dida.psu.ac.th'
SOURCES = {
    'cameras': '/api/v1/data/cameras',
    'water': '/api/v1/data/rid/stations/latest',
    'trends': '/api/v1/data/rid/stations/trend',
    'weather': '/api/v1/data/tmd/observation',
    'wind': '/api/v1/data/wind',
    'radar': '/api/v1/data/tmd/weather-map?kind=observ&limit=100',
    'nowcast': '/api/v1/data/tmd/weather-map?kind=swirls&limit=100',
    'rod': 'https://www.oas.psu.ac.th/rodplatform/RODDSS/radar_catalog_48h.php',
}
# Export only display fields; administrative flags and user identifiers stay upstream.
FIELDS = {
    'cameras': 'camera_slug camera_name_th location image_url is_active group_name last_captured_at status source_img_url source_page_url sponsor_name sponsor_url',
    'water': 'station_code station_name_th amphur_name province_name latitude longitude observed_at level level_percent q brae alert_yellow alert_red',
    'trends': 'station_code level_now level_prev delta trend',
    'weather': 'wmo th en province_name lat lon observed_at t rh p wd ws rain3 rain24 vis',
    'radar': 'objectid base_time frame_time image_url is_now bounds',
    'nowcast': 'objectid base_time frame_time image_url is_now bounds',
    'rod': 'frame_time image_url bounds',
}
ROD_IMAGES = 'https://www.oas.psu.ac.th/rodplatform/live/tmd_radar/'


def source_url(name):
    path = SOURCES[name]
    return path if path.startswith('https://') else BASE + path


def open_url(request, timeout):
    context = ssl.create_default_context()
    # Some Windows installations lack the issuer used by the PSU server.
    # Add the maintained CA bundle; certificate verification stays enabled.
    try:
        import certifi
        context.load_verify_locations(cafile=certifi.where())
    except ImportError:
        pass
    return urllib.request.urlopen(request, timeout=timeout, context=context)


def rod_frames(payload):
    if not isinstance(payload, dict):
        raise ValueError('Invalid ROD catalog')
    bounds = payload.get('bounds')
    if not payload.get('overlay_ready') or not isinstance(bounds, list) or len(bounds) != 4:
        raise ValueError('ROD radar has no georeference')
    if not all(isinstance(x, (float, int)) and math.isfinite(x) for x in bounds):
        raise ValueError('Invalid radar bounds')
    west, south, east, north = bounds
    if not (-180 <= west < east <= 180 and -90 <= south < north <= 90):
        raise ValueError('Invalid radar bounds')
    frames = {}
    for frame in payload.get('frames', []):
        path, digest = frame.get('local_rel', ''), frame.get('sha256', '')
        if not re.fullmatch(r'frames/[A-Za-z0-9_-]+\.png', path) or not re.fullmatch(r'[a-f0-9]{64}', digest):
            continue
        try:
            stamp = dt.datetime.fromisoformat(frame.get('time_utc', '').replace('Z', '+00:00'))
            if stamp.tzinfo is None:
                continue
        except (TypeError, ValueError):
            continue
        frames[stamp] = {'frame_time': stamp.astimezone(dt.timezone.utc).isoformat(),
                         'bounds': [[south, west], [north, east]], 'path': path, 'sha256': digest}
    return [frames[key] for key in sorted(frames)][-13:]


def download_rod(payload):
    frames = rod_frames(payload)
    if not frames:
        raise ValueError('No usable ROD radar frames')
    folder = OUT / 'radar'
    folder.mkdir(exist_ok=True)
    for frame in frames:
        request = urllib.request.Request(ROD_IMAGES + frame.pop('path'), headers={'User-Agent': 'RMWeather public radar display'})
        with open_url(request, timeout=25) as response:
            binary = response.read(5000000)
        digest = frame.pop('sha256')
        if not binary.startswith(b'\x89PNG\r\n\x1a\n') or hashlib.sha256(binary).hexdigest() != digest:
            raise ValueError('ROD radar image checksum mismatch')
        filename = 'rod-' + digest[:16] + '.png'
        (folder / filename).write_bytes(binary)
        frame['image_url'] = 'data/live/radar/' + filename
    return sanitize('rod', frames)


def public_image_url(value):
    if value and value.startswith('/api/data/'):
        return BASE + value.replace('/api/data/', '/api/v1/data/', 1)
    return value


def sanitize(name, payload):
    if name == 'wind':
        if not isinstance(payload, dict) or len(payload.get('records', [])) != 2:
            raise ValueError('Invalid wind grid')
        return {k: payload.get(k) for k in ('model', 'refTime', 'forecastHour', 'validTime', 'records', 'stale', 'source')}
    if not isinstance(payload, list):
        raise ValueError(f'{name}: expected list')
    rows = [{k: row.get(k) for k in FIELDS[name].split()} for row in payload]
    for row in rows:
        if 'image_url' in row:
            row['image_url'] = public_image_url(row['image_url'])
    return rows


def download(name):
    request = urllib.request.Request(source_url(name), headers={'User-Agent': 'RMWeather/2 public weather dashboard', 'Accept': 'application/json'})
    with open_url(request, timeout=35) as response:
        payload = json.load(response)
    if name == 'rod':
        return download_rod(payload)
    if name in ('radar', 'nowcast'):
        # URL mode currently returns broken 404 image routes. The same public API
        # returns PNG bytes when image=url is omitted; publish those with Pages.
        if not isinstance(payload, list):
            raise ValueError('Expected radar frames')
        if name == 'nowcast' and payload:
            latest = max(row.get('base_time') or '' for row in payload)
            payload = [row for row in payload if row.get('base_time') == latest]
        frames = {}
        for row in sorted(payload, key=lambda r: r.get('base_time') or ''):
            frames[row.get('frame_time')] = row
        payload = sorted(frames.values(), key=lambda r: r.get('frame_time') or '')[-24:]
        folder = OUT / 'radar'
        folder.mkdir(exist_ok=True)
        for row in payload:
            binary = base64.b64decode(row.get('image_bytes') or '', validate=True)
            if not binary.startswith(b'\x89PNG\r\n\x1a\n'):
                raise ValueError('Invalid radar PNG')
            filename = f"{name}-{int(row['objectid'])}.png"
            (folder / filename).write_bytes(binary)
            row['image_url'] = 'data/live/radar/' + filename
    return sanitize(name, payload)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    now = dt.datetime.now(dt.timezone.utc).isoformat()
    manifest = {'generated_at': now, 'source': BASE, 'datasets': {}}
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        jobs = {pool.submit(download, name): name for name in SOURCES}
        for job in concurrent.futures.as_completed(jobs):
            name = jobs[job]
            try:
                data = job.result()
                envelope = {'fetched_at': now, 'source': source_url(name), 'data': data}
                (OUT / f'{name}.json').write_text(json.dumps(envelope, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
                manifest['datasets'][name] = {'ok': True, 'count': len(data) if isinstance(data, list) else None}
                print(f'{name}: OK')
            except Exception as error:
                manifest['datasets'][name] = {'ok': False, 'error': type(error).__name__}
                print(f'{name}: failed ({type(error).__name__})')
    (OUT / 'manifest.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
    if not any(item['ok'] for item in manifest['datasets'].values()):
        raise SystemExit('All sources failed; refusing to publish an empty snapshot')


if __name__ == '__main__':
    main()
