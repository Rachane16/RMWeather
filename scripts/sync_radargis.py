"""Cache the public TMD RadarGIS overlays for same-origin display on Pages."""
import concurrent.futures
import datetime as dt
import hashlib
import json
import math
import os
from pathlib import Path
import re
import shutil
import sys
import urllib.error
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
HEADERS = {'User-Agent': 'Mozilla/5.0 (compatible; RMWeather/2; +https://rachane16.github.io/RMWeather/)',
           'Accept': 'application/json, image/png, text/html;q=0.8, */*;q=0.5',
           'Referer': BASE + '/'}


def fetch_json(path):
    request = urllib.request.Request(BASE + path, headers=HEADERS)
    with open_url(request, timeout=30) as response:
        return json.load(response)


def embedded_catalog():
    """The public map embeds the same catalog for its initial render."""
    request = urllib.request.Request(BASE + '/', headers=HEADERS)
    with open_url(request, timeout=30) as response:
        html = response.read(3000000).decode('utf-8')
    match = re.search(r'(?:let|const|var)\s+overlays\s*=\s*', html)
    if not match:
        raise ValueError('No public embedded catalog')
    rows, _ = json.JSONDecoder().raw_decode(html[match.end():])
    if not isinstance(rows, list) or not rows:
        raise ValueError('Empty public embedded catalog')
    return {'overlays': rows}


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
        # Only called with valid_time: the provider defines this field as UTC.
        # valid_dt_ts is currently seven hours off; valid_dt_iso is unzoned.
        stamp = stamp.replace(tzinfo=dt.timezone.utc)
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
            code = f' HTTP {error.code}' if isinstance(error, urllib.error.HTTPError) else ''
            print(f'RadarGIS {name}: {type(error).__name__}{code}')
            if name == 'overlays':
                try:
                    catalog[name] = embedded_catalog()
                    print('RadarGIS: using initial catalog embedded in public map')
                    continue
                except Exception as fallback_error:
                    fallback_code = f' HTTP {fallback_error.code}' if isinstance(fallback_error, urllib.error.HTTPError) else ''
                    print(f'RadarGIS public map: {type(fallback_error).__name__}{fallback_code}')
            errors.append(type(error).__name__ + code)
    catalog['errors'] = errors
    CATALOG.write_text(json.dumps(catalog, ensure_ascii=False), encoding='utf-8')
    key = hashlib.sha256(json.dumps(products_from_catalog(catalog), sort_keys=True).encode()).hexdigest()[:24]
    if os.environ.get('GITHUB_OUTPUT'):
        with open(os.environ['GITHUB_OUTPUT'], 'a', encoding='utf-8') as stream:
            stream.write(f'key={key if products_from_catalog(catalog) else "unavailable"}\n')
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
        request = urllib.request.Request(url, headers=HEADERS)
        with open_url(request, timeout=30) as response:
            binary = response.read(8000001)
        if not binary.startswith(b'\x89PNG\r\n\x1a\n') or len(binary) > 8000000:
            raise ValueError('Invalid RadarGIS image')
        path.write_bytes(binary)
    return {**frame, 'source_url': url, 'image_url': 'data/live/radargis/' + name, 'attribution': 'เรดาร์ © <a href="https://radargis.tmd.go.th/">TMD RadarGIS</a>'}


def probe():
    """Runner connectivity evidence, including failures; never claims an outage is healthy."""
    report = {'checked_at': dt.datetime.now(dt.timezone.utc).isoformat(), 'api_ok': False, 'images': []}
    samples = []
    try:
        request = urllib.request.Request(BASE + '/api/overlays', headers=HEADERS)
        with open_url(request, timeout=30) as response:
            payload = json.load(response)
            report['rate_headers'] = {key: response.headers[key] for key in ('Retry-After', 'X-RateLimit-Limit', 'X-RateLimit-Remaining') if response.headers.get(key)}
        products = products_from_catalog({'overlays': payload})
        report.update(api_ok=True, products=len(products), frames=sum(len(p['frames']) for p in products), catalog_source='live_api')
        samples = [(p['id'], p['frames'][-1]['frame_time'], p['frames'][-1]['remote_url']) for p in products if p['id'] in ('dbz', 'dbz-nowcast')]
    except Exception as error:
        report['error'] = f'{type(error).__name__}: {error}'
        # Test PNG access separately even if the runner cannot read JSON. These
        # URLs came from a validated live response, not guessed filenames.
        seed = ROOT / 'data' / 'radargis-fallback' / 'catalog.json'
        if seed.exists():
            products = json.loads(seed.read_text(encoding='utf-8')).get('data', {}).get('products', [])
            samples = [(p['id'], p['frames'][-1]['frame_time'], p['frames'][-1].get('source_url', '')) for p in products if p['id'] in ('dbz', 'dbz-nowcast')]
            report['catalog_source'] = 'dated_fallback'
    for key, stamp, url in samples:
        parsed = urllib.parse.urlparse(url)
        if parsed.scheme != 'https' or parsed.netloc != 'radargis.tmd.go.th' or not re.fullmatch(r'/products/[A-Za-z0-9_/-]+\.png', parsed.path) or '..' in parsed.path:
            continue
        result = {'product': key, 'valid_time': stamp, 'url': url}
        try:
            with open_url(urllib.request.Request(url, headers=HEADERS), timeout=30) as response:
                binary = response.read(8000001)
            result['ok'] = binary.startswith(b'\x89PNG\r\n\x1a\n') and len(binary) <= 8000000
            result['bytes'] = len(binary)
        except Exception as error:
            result.update(ok=False, error=f'{type(error).__name__}: {error}')
        report['images'].append(result)
    report['ok'] = report['api_ok'] and len(report['images']) == 2 and all(row['ok'] for row in report['images'])
    Path('_radargis_probe.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps(report, ensure_ascii=True))
    if os.environ.get('GITHUB_STEP_SUMMARY'):
        with open(os.environ['GITHUB_STEP_SUMMARY'], 'a', encoding='utf-8') as stream:
            stream.write('### RadarGIS runner connectivity\n```json\n' + json.dumps(report, ensure_ascii=False, indent=2) + '\n```\n')


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    if not CATALOG.exists():
        prepare()
    catalog = json.loads(CATALOG.read_text(encoding='utf-8'))
    previous_path = OUT / 'radargis.json'
    previous = json.loads(previous_path.read_text(encoding='utf-8')) if previous_path.exists() else {}
    # A dated, validated public snapshot supplies the first known-good image set.
    # It is a fallback only; a current upstream catalog always takes precedence.
    seed = ROOT / 'data' / 'radargis-fallback'
    if not previous.get('data', {}).get('products') and (seed / 'catalog.json').exists():
        previous = json.loads((seed / 'catalog.json').read_text(encoding='utf-8'))
        (OUT / 'radargis').mkdir(parents=True, exist_ok=True)
        for product in previous['data']['products']:
            for frame in product['frames']:
                name = Path(frame['image_url']).name
                if re.fullmatch(r'[a-f0-9]{24}\.png', name):
                    shutil.copyfile(seed / name, OUT / 'radargis' / name)
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
                code = f' HTTP {error.code}' if isinstance(error, urllib.error.HTTPError) else ''
                errors.append(type(error).__name__ + code)
                print(f'RadarGIS {product["id"]}: {type(error).__name__}{code}')
                # A failed refresh must not replace a working product with an empty map.
                if product['id'] in old_products:
                    published.append(old_products[product['id']])
    for key, product in old_products.items():
        if key not in {p['id'] for p in published}:
            published.append(product)
    now = dt.datetime.now(dt.timezone.utc).isoformat()
    data = {'products': published, 'checked_at': now}
    envelope = {'fetched_at': now, 'source': BASE, 'ok': bool(products) and not errors, 'data': data}
    if not products:
        envelope['retained_from'] = previous.get('retained_from') or previous.get('fetched_at')
    if errors:
        envelope['error'] = ', '.join(sorted(set(errors)))
    previous_path.write_text(json.dumps(envelope, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    if os.environ.get('GITHUB_OUTPUT'):
        with open(os.environ['GITHUB_OUTPUT'], 'a', encoding='utf-8') as stream:
            stream.write(f'ok={str(envelope["ok"]).lower()}\n')
    retained = {Path(f['image_url']).name for p in published for f in p['frames']}
    for path in (OUT / 'radargis').glob('*.png'):
        if path.name not in retained:
            path.unlink()
    print(f'RadarGIS: {len(published)} products, {sum(len(p["frames"]) for p in published)} frames, {len(errors)} source errors')


if __name__ == '__main__':
    probe() if '--probe' in sys.argv else prepare() if '--catalog' in sys.argv else main()
