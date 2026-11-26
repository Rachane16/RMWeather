"""Publish Thai webcam metadata and stable embed URLs; never publish the key."""
import datetime as dt
import json
import math
import os
from pathlib import Path
import urllib.error
import urllib.parse
import urllib.request

OUT = Path(__file__).resolve().parents[1] / 'data' / 'live'
API = 'https://api.windy.com/webcams/api/v3/webcams'
# Verified via Windy's /regions endpoint, not Thailand's ISO province number.
SONGKHLA_REGION = 'TH.68'


def allowed_url(value, hosts):
    if not isinstance(value, str):
        return None
    parsed = urllib.parse.urlparse(value)
    return value if parsed.scheme == 'https' and parsed.hostname in hosts else None


def normalize_webcams(payload, songkhla_only=False):
    rows = []
    for camera in payload.get('webcams', []):
        location = camera.get('location') or {}
        if location.get('country_code') != 'TH' or (songkhla_only and location.get('region_code') != SONGKHLA_REGION):
            continue
        lat, lon = location.get('latitude'), location.get('longitude')
        if not all(isinstance(n, (int, float)) and math.isfinite(n) for n in (lat, lon)):
            continue
        if not (5.5 <= lat <= 21.0 and 97.0 <= lon <= 106.0):
            continue
        players = {kind: url for kind, value in (camera.get('player') or {}).items()
                   if kind in ('live', 'day', 'month', 'year', 'lifetime')
                   and (url := allowed_url(value, {'webcams.windy.com'}))}
        detail = allowed_url((camera.get('urls') or {}).get('detail'), {'webcams.windy.com', 'www.windy.com', 'windy.com'})
        if not players or not detail:
            continue
        rows.append({'webcam_id': camera['webcamId'], 'name': camera['title'],
                     'latitude': lat, 'longitude': lon,
                     'region': location.get('region') or ('สงขลา' if location.get('region_code') == SONGKHLA_REGION else 'ประเทศไทย'),
                     'region_code': location.get('region_code'), 'country_code': 'TH',
                     'observed_at': camera.get('lastUpdatedOn'), 'status': camera.get('status'),
                     'players': players, 'detail_url': detail})
    return rows


def fetch_webcams(key):
    cameras = {}
    total = None
    # The free plan permits offsets up to 1000; report truncation if reached.
    for offset in range(0, 1001, 50):
        query = urllib.parse.urlencode({'countries': 'TH', 'include': 'location,player,urls',
                                       'lang': 'th', 'limit': 50, 'offset': offset})
        request = urllib.request.Request(API + '?' + query, headers={
            'x-windy-api-key': key, 'Accept': 'application/json',
            'Origin': 'https://rachane16.github.io', 'Referer': 'https://rachane16.github.io/RMWeather/'})
        with urllib.request.urlopen(request, timeout=30) as response:
            payload = json.load(response)
        page = payload.get('webcams')
        if not isinstance(page, list):
            raise ValueError('Invalid webcam page')
        if isinstance(payload.get('total'), int):
            total = payload['total']
        for camera in page:
            cameras[camera['webcamId']] = camera
        if len(page) < 50 or (total is not None and offset + len(page) >= total):
            return list(cameras.values()), total, False
    return list(cameras.values()), total, True


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    key = os.environ.get('WINDY_WEBCAMS_API_KEY', '').strip()
    now = dt.datetime.now(dt.timezone.utc).isoformat()
    envelope = {'fetched_at': now, 'source': 'Windy Webcams API v3', 'country': 'TH',
                'configured': bool(key), 'ok': False, 'data': []}
    if key:
        try:
            cameras, total, truncated = fetch_webcams(key)
            envelope['data'] = normalize_webcams({'webcams': cameras})
            envelope['total'] = total
            envelope['truncated'] = truncated
            envelope['ok'] = True
        except Exception as error:
            # Never log headers, key, exception response bodies or signed URLs.
            envelope['error'] = type(error).__name__
            try:
                previous = OUT / 'windycams.json'
                if previous.exists():
                    old = json.loads(previous.read_text(encoding='utf-8'))
                else:
                    with urllib.request.urlopen('https://rachane16.github.io/RMWeather/data/live/windycams.json', timeout=15) as response:
                        old = json.load(response)
                # Only previously published safe metadata, never expiring images.
                envelope['data'] = old.get('data', [])
                envelope['retained_from'] = old.get('fetched_at')
            except Exception:
                pass
    (OUT / 'windycams.json').write_text(json.dumps(envelope, ensure_ascii=False), encoding='utf-8')
    print(f"Windy Thailand: {'OK' if envelope['ok'] else 'unavailable'} ({len(envelope['data'])} cameras)")


if __name__ == '__main__':
    main()
