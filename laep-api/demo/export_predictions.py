"""Export genuine inference for an unvalidated diagnostic demo, never filled sensor data.
Only load trusted joblib artifacts: pickle deserialization can execute Python code.
"""
import argparse
import hashlib
import json
from pathlib import Path
import joblib
import numpy as np
import pandas as pd
import xgboost


def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def prepare_features(frame, names, aliases, nodata):
    if len(set(names)) != len(names):
        raise ValueError('Duplicate model features')
    columns = [aliases.get(name, name) for name in names]
    missing = set(columns) - set(frame.columns)
    if missing:
        raise ValueError(f'Missing features: {sorted(missing)}')
    features = frame[columns].apply(pd.to_numeric, errors='raise').copy()
    features.columns = names
    features = features.replace(nodata, np.nan)
    return features, np.isfinite(features.to_numpy()).all(axis=1)


def export(model_path, csv_path, config_path, output_path):
    config = json.loads(config_path.read_text(encoding='utf-8'))
    model = joblib.load(model_path)
    names = model.get_booster().feature_names
    if not names:
        raise ValueError('Model has no feature names; refusing to guess order')
    classes = model.classes_.tolist()
    if config['positive_class'] not in classes:
        raise ValueError('Positive class absent from model')
    frame = pd.read_csv(csv_path)
    if frame[config['id_column']].isna().any() or frame[config['id_column']].duplicated().any():
        raise ValueError('Missing or duplicate sample IDs')
    features, complete = prepare_features(frame, names, config['aliases'], config['nodata'])
    lon = pd.to_numeric(frame[config['longitude_column']], errors='raise')
    lat = pd.to_numeric(frame[config['latitude_column']], errors='raise')
    geometry = lon.between(-180, 180) & lat.between(-90, 90)
    observed = frame[config['availability_column']].eq(config['available_value'])
    eligible = complete & geometry & observed
    scores = np.full(len(frame), np.nan)
    if eligible.any():
        p = model.predict_proba(features.loc[eligible])
        if (p.shape != (int(eligible.sum()), len(classes)) or not np.isfinite(p).all()
                or np.any(p < 0) or np.any(p > 1) or not np.allclose(p.sum(axis=1), 1)):
            raise ValueError('Invalid model probabilities')
        scores[eligible] = p[:, classes.index(config['positive_class'])]
    samples = []
    for i in np.flatnonzero(geometry.to_numpy()):
        samples.append({
            'id': str(frame.iloc[i][config['id_column']]),
            'lon': float(lon.iloc[i]), 'lat': float(lat.iloc[i]),
            'score': float(scores[i]) if np.isfinite(scores[i]) else None,
            'state': 'observed' if observed.iloc[i] else 'unobserved',
            'qc': ['unverified_geolocation', 'unvalidated_input_provenance']
                  + ([] if complete[i] else ['missing_model_features']),
        })
    product = {
        'schema_version': 1, 'title': 'Experimental OH/H₂O indicator model output',
        'score_definition': 'XGBoost output for training label +1; not calibrated ice probability',
        'model': {'file': model_path.name, 'sha256': digest(model_path),
                  'features': names, 'classes': classes, 'positive_class': config['positive_class'],
                  'xgboost_version': xgboost.__version__},
        'source': {'file': csv_path.name, 'sha256': digest(csv_path),
                   'aliases': config['aliases'], 'config_sha256': digest(config_path)},
        'geolocation_verified': False,
        'validation_status': 'Training provenance unresolved; not an independent test set',
        'lfm': {'status': 'not_integrated', 'reason': 'Georeferenced embeddings and trained head not verified'},
        'counts': {'total': len(frame), 'eligible': int(eligible.sum()),
                   'unobserved': int((~observed).sum()), 'invalid_coordinates': int((~geometry).sum())},
        'limitations': config['limitations'], 'samples': samples,
    }
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(product, ensure_ascii=False, allow_nan=False, separators=(',', ':')), encoding='utf-8')
    print(json.dumps({'output': str(output_path), 'counts': product['counts'], 'classes': classes, 'features': names}))
    return product


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ['model', 'csv', 'config', 'output']:
        parser.add_argument('--' + name, type=Path, required=True)
    args = parser.parse_args()
    export(args.model, args.csv, args.config, args.output)
