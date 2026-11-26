"""Cache the public TMD RadarGIS overlays for same-origin display on Pages."""
import concurrent.futures
import datetime as dt
import hashlib
import json
import math
import os
from pathlib import Path
import re
import sys
import urllib.parse
import urllib.request

from sync_data import open_url

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'data' / 'live'
CATALOG = ROOT / '_radargis_catalog.json'
BASE = 'https://radargis.tmd.go.th'
PRODUCTS = {
    '01 dBZ Overlay': ('dbz', 'เรดาร์ตรวจวัด · dBZ', 'dBZ'),
    '02 Rain Rate Overlay': ('rainrate', 'อัตราฝนตรวจวัด', 'มม./ชม.'),
    '03 Lightning Warning Overlay': ('lightning', 'ความเสี่ยงฟ้าผ่าจากเรดาร์', 'ระดับความเสี่ยง'),
    '04 dBZ Nowcast Overlay': ('dbz-nowcast', 'พยากรณ์เรดาร์ · dBZ', 'dBZ'),
    '05 Rain Rate Nowcast Overlay': ('rainrate-nowcast', 'พยากรณ์อัตราฝน', 'มม./ชม.'),
    '06 Lightning Warning Nowcast Overlay': ('lightning-nowcast', 'พยากรณ์ความเสี่ยงฟ้าผ่า', 'ระดับความเสี่ยง'),
}


def fetch_json(path):
    request = urllib.request.Request(BASE + path, headers={'User-Agent': 'RMWeather public radar display', 'Accept': 'application/json'})
    with open_url(request, timeout=30) as response:
        return json.load(response)


def valid_bounds(bounds):
    try:
        (south, west), (north, east) = bounds
        return all(isinstance(v, (int, float)) and math.isfinite(v) for v in (south, west, north, east)) and -85 <= south < north <= 85 and -180 <= west < east <= 180
    except (TypeError, ValueError):
        return False


def utc_stamp(value):
    if not isinstance(value, str):
        raise ValueError('Missing frame time')
    stamp = dt.datetime.fromisoformat(value.replace(' UTC', '+00:00').replace('Z', '+00:00'))
    if stamp.tzinfo is None:
        raise ValueError('Frame time needs a timezone')
    return stamp.astimezone(dt.timezone.utc).isoformat()


def products_from_catalog(catalog):
    payload = catalog.get('overlays', {})
    rows = payload.get('overlays', [])
    result = []
    for group, (key, label, unit) in PRODUCTS.items():
        frames = {}
        for row in rows:
            if row.get('group') != group or not valid_bounds(row.get('bounds')):
                continue
            url = urllib.parse.urljoin(BASE, row.get('url', ''))
            parsed = urllib.parse.urlparse(url)
            if parsed.scheme != 'https' or parsed.netloc != 'radargis.tmd.go.th' or not re.fullmatch(r'/products/[A-Za-z0-9_/-]+\.png', parsed.path) or '..' in parsed.path:
                continue
            try:
                stamp = utc_stamp(row.get('valid_time'))
            except (TypeError, ValueError):
                continue
            lead = re.search(r'T\+(\d+)', row.get('title', ''))
            lead = int(lead[1]) if lead else 0
            base = (dt.datetime.fromisoformat(stamp) - dt.timedelta(minutes=lead)).isoformat()
            frames[stamp] = {'frame_time': stamp, 'base_time': base, 'bounds': row['bounds'], 'remote_url': url, 'lead_minutes': lead}
        frames = [frames[t] for t in sorted(frames)]
        # Never animate forecasts belonging to different model runs together.
        if 'nowcast' in key and frames:
            newest_base = max(f['base_time'] for f in frames)
            frames = [f for f in frames if f['base_time'] == newest_base]
        if frames:
            result.append({'id': key, 'label': label, 'unit': unit, 'forecast': 'nowcast' in key,
                           'proxy': 'lightning' in key, 'frames': frames[-24:]})
    for hours in (3, 6, 12, 24):
        row = catalog.get('accumulation', {}).get(str(hours))
        if not row or not valid_bounds(row.get('bounds')) or not re.fullmatch(r'[A-Za-z0-9_-]+\.png', row.get('filename', '')):
            continue
        try:
            end = dt.datetime.fromisoformat(row['end_ict']).replace(tzinfo=dt.timezone(dt.timedelta(hours=7))).astimezone(dt.timezone.utc).isoformat()
        except (KeyError, ValueError, TypeError):
            continue
        result.append({'id': f'accum-{hours}', 'label': f'ฝนสะสม {hours} ชั่วโมง', 'unit': 'มม.', 'forecast': False,
                       'frames': [{'frame_time': end, 'base_time': end, 'bounds': row['bounds'],
                                   'remote_url': BASE + '/rainfall-accumulation/image/' + row['filename'],
                                   'available_frames': row.get('frames'), 'expected_frames': row.get('expected'),
                                   'start_ict': row.get('start_ict')} ]})
    return result


def prepare():
    catalog = {}
    errors = []
    for name, path in [('overlays', '/api/overlays'), ('accumulation', '/api/rainfall-accumulation')]:
        try:
            catalog[name] = fetch_json(path)
        except Exception as error:
            errors.append(type(error).__name__)
    catalog['errors'] = errors
    CATALOG.write_text(json.dumps(catalog, ensure_ascii=False), encoding='utf-8')
    key = hashlib.sha256(json.dumps(products_from_catalog(catalog), sort_keys=True).encode()).hexdigest()[:24]
    if os.environ.get('GITHUB_OUTPUT'):
        with open(os.environ['GITHUB_OUTPUT'], 'a', encoding='utf-8') as stream:
            stream.write(f'key={key}\n')
    print(f'RadarGIS catalog: {len(products_from_catalog(catalog))} products, {len(errors)} source errors')


def cache_image(frame):
    url = frame.pop('remote_url')
    # The upstream version query changes when an image is rebuilt.
    name = hashlib.sha256(url.encode()).hexdigest()[:24] + '.png'
    folder = OUT / 'radargis'
    folder.mkdir(parents=True, exist_ok=True)
    path = folder / name
    binary = path.read_bytes() if path.exists() else None
    if not binary or not binary.startswith(b'\x89PNG\r\n\x1a\n'):
        request = urllib.request.Request(url, headers={'User-Agent': 'RMWeather public radar display'})
        with open_url(request, timeout=30) as response:
            binary = response.read(8000001)
        if not binary.startswith(b'\x89PNG\r\n\x1a\n') or len(binary) > 8000000:
            raise ValueError('Invalid RadarGIS image')
        path.write_bytes(binary)
    return {**frame, 'image_url': 'data/live/radargis/' + name, 'attribution': 'เรดาร์ © <a href="https://radargis.tmd.go.th/">TMD RadarGIS</a>'}


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    if not CATALOG.exists():
        prepare()
    catalog = json.loads(CATALOG.read_text(encoding='utf-8'))
    previous_path = OUT / 'radargis.json'
    previous = json.loads(previous_path.read_text(encoding='utf-8')) if previous_path.exists() else {}
    old_products = {p['id']: p for p in previous.get('data', {}).get('products', [])}
    products = products_from_catalog(catalog)
    published = []
    errors = list(catalog.get('errors', []))
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        for product in products:
            try:
                product['frames'] = list(pool.map(cache_image, product['frames']))
                published.append(product)
            except Exception as error:
                errors.append(type(error).__name__)
                # A failed refresh must not replace a working product with an empty map.
                if product['id'] in old_products:
                    published.append(old_products[product['id']])
    for key, product in old_products.items():
        if key not in {p['id'] for p in published}:
            published.append(product)
    now = dt.datetime.now(dt.timezone.utc).isoformat()
    data = {'products': published, 'checked_at': now}
    envelope = {'fetched_at': now, 'source': BASE, 'ok': bool(products) and not errors, 'data': data}
    if errors:
        envelope['error'] = ', '.join(sorted(set(errors)))
    previous_path.write_text(json.dumps(envelope, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    retained = {Path(f['image_url']).name for p in published for f in p['frames']}
    for path in (OUT / 'radargis').glob('*.png'):
        if path.name not in retained:
            path.unlink()
    print(f'RadarGIS: {len(published)} products, {sum(len(p["frames"]) for p in published)} frames, {len(errors)} source errors')


if __name__ == '__main__':
    prepare() if '--catalog' in sys.argv else main()
