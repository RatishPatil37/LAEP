"""Build a reproducible, validated catalog from the official USGS Moon KMZ.

Usage: python scripts/import-lunar-catalog.py path/to/MOON_nomenclature_center_pts.kmz
No invented values, scientific classifications, or inferred elevations.
"""
import sys
import json
import hashlib
import math
import zipfile
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path
from xml.etree import ElementTree as ET

source = Path(sys.argv[1])
ns = {'k': 'http://www.opengis.net/kml/2.2'}
with zipfile.ZipFile(source) as archive:
    root = ET.fromstring(archive.read('MOON_nomenclature_center_pts.kml'))
features = []
ids = set()
for node in root.findall('.//k:Placemark', ns):
    fields = {x.attrib['name']: x.text for x in node.findall('.//k:SimpleData', ns)}
    link = fields['link'].replace('http:', 'https:')
    feature_id = link.rstrip('/').split('/')[-1]
    lat, lon = float(fields['center_lat']), float(fields['center_lon'])
    diameter = float(fields['diameter'])
    assert all(math.isfinite(x) for x in (lat, lon, diameter))
    assert -90 <= lat <= 90 and 0 <= lon <= 360 and feature_id not in ids
    ids.add(feature_id)
    features.append(dict(id=feature_id, name=node.findtext('k:name', namespaces=ns),
        searchName=fields['clean_name'], latitude=lat, longitude=float((Decimal(fields['center_lon']) + 180) % 360 - 180),
        diameterKm=diameter if diameter > 0 else None, type=fields['type'], code=fields['code'],
        origin=fields.get('origin'), approval=fields.get('approval'),
        approvalDate=fields.get('approvaldt'), sourceUrl=link))
features.sort(key=lambda item: item['name'])
output = Path(__file__).resolve().parents[1] / 'public/data/lunar'
output.mkdir(parents=True, exist_ok=True)
details_dir = output / 'details'
details_dir.mkdir(exist_ok=True)
groups = {}
index = []
for feature in features:
    index.append({key: feature[key] for key in ('id', 'name', 'latitude', 'longitude', 'diameterKm')})
    groups.setdefault(feature['id'][:2], []).append({key: feature[key] for key in
        ('id', 'type', 'origin', 'approval', 'approvalDate', 'sourceUrl')})
for group, records in groups.items():
    (details_dir / f'{group}.json').write_text(json.dumps(records, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
payload = dict(source='USGS Gazetteer of Planetary Nomenclature / IAU',
    sourceUrl='https://planetarynames.wr.usgs.gov/GIS_Downloads',
    downloadUrl='https://asc-planetarynames-data.s3.us-west-2.amazonaws.com/MOON_nomenclature_center_pts.kmz',
    retrievedAt=datetime.now(timezone.utc).isoformat(), sha256=hashlib.sha256(source.read_bytes()).hexdigest(),
    coordinateSystem='Planetocentric latitude; east-positive longitude, normalized to -180..180; LOLA2011 control network',
    count=len(features), features=index)
(output / 'catalog.json').write_text(json.dumps(payload, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
print(f'Validated {len(features)} features; source SHA256 {payload["sha256"]}')
