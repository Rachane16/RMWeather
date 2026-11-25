"""Publish Songkhla webcam metadata and stable embed URLs; never publish the key."""
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


def normalize_webcams(payload):
    rows = []
    for camera in payload.get('webcams', []):
        location = camera.get('location') or {}
        if location.get('country_code') != 'TH' or location.get('region_code') != SONGKHLA_REGION:
            continue
        lat, lon = location.get('latitude'), location.get('longitude')
        if not all(isinstance(n, (int, float)) and math.isfinite(n) for n in (lat, lon)):
            continue
        if not (6.2 <= lat <= 8.0 and 99.9 <= lon <= 101.2):
            continue
        players = {kind: url for kind, value in (camera.get('player') or {}).items()
                   if kind in ('live', 'day', 'month', 'year', 'lifetime')
                   and (url := allowed_url(value, {'webcams.windy.com'}))}
        detail = allowed_url((camera.get('urls') or {}).get('detail'), {'webcams.windy.com', 'www.windy.com', 'windy.com'})
        if not players or not detail:
            continue
        rows.append({'webcam_id': camera['webcamId'], 'name': camera['title'],
                     'latitude': lat, 'longitude': lon, 'region': 'สงขลา',
                     'observed_at': camera.get('lastUpdatedOn'), 'status': camera.get('status'),
                     'players': players, 'detail_url': detail})
    return rows


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    key = os.environ.get('WINDY_WEBCAMS_API_KEY', '').strip()
    now = dt.datetime.now(dt.timezone.utc).isoformat()
    envelope = {'fetched_at': now, 'source': 'Windy Webcams API v3', 'region': SONGKHLA_REGION,
                'configured': bool(key), 'ok': False, 'data': []}
    if key:
        try:
            # This backend belongs to the domain-restricted RMWeather project.
            query = urllib.parse.urlencode({'regions': SONGKHLA_REGION, 'countries': 'TH',
                'include': 'location,player,urls', 'lang': 'th', 'limit': 50})
            request = urllib.request.Request(API + '?' + query, headers={
                'x-windy-api-key': key, 'Accept': 'application/json',
                'Origin': 'https://rachane16.github.io',
                'Referer': 'https://rachane16.github.io/RMWeather/'})
            with urllib.request.urlopen(request, timeout=30) as response:
                payload = json.load(response)
            envelope['data'] = normalize_webcams(payload)
            envelope['ok'] = True
        except Exception as error:
            # Never log headers, key, exception response bodies or signed URLs.
            envelope['error'] = type(error).__name__
    (OUT / 'windycams.json').write_text(json.dumps(envelope, ensure_ascii=False), encoding='utf-8')
    print(f"Windy Songkhla: {'OK' if envelope['ok'] else 'unavailable'} ({len(envelope['data'])} cameras)")


if __name__ == '__main__':
    main()
