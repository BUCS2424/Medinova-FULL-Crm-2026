"""US locations data provider — wraps /app/backend/us_locations_data.json.

Provides the interface expected by slug_engine.py:
  get_states()                  -> list of state dicts
  get_state(code)               -> state dict by 2-letter postal code
  get_all_state_codes()         -> list of 2-letter postal codes
  iter_state_only(codes)        -> yields {state_code, state_name}
  iter_counties(codes)          -> yields {state_code, state_name, county}
  iter_locations(scope, codes)  -> yields location dicts
  get_county_for_city(code, city) -> county name or None
"""
from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Iterator, Optional

# State name (lowercase) → 2-letter postal code
_NAME_TO_CODE: dict[str, str] = {
    "alabama": "AL", "alaska": "AK", "arizona": "AZ", "arkansas": "AR",
    "california": "CA", "colorado": "CO", "connecticut": "CT", "delaware": "DE",
    "florida": "FL", "georgia": "GA", "hawaii": "HI", "idaho": "ID",
    "illinois": "IL", "indiana": "IN", "iowa": "IA", "kansas": "KS",
    "kentucky": "KY", "louisiana": "LA", "maine": "ME", "maryland": "MD",
    "massachusetts": "MA", "michigan": "MI", "minnesota": "MN", "mississippi": "MS",
    "missouri": "MO", "montana": "MT", "nebraska": "NE", "nevada": "NV",
    "new hampshire": "NH", "new jersey": "NJ", "new mexico": "NM", "new york": "NY",
    "north carolina": "NC", "north dakota": "ND", "ohio": "OH", "oklahoma": "OK",
    "oregon": "OR", "pennsylvania": "PA", "rhode island": "RI", "south carolina": "SC",
    "south dakota": "SD", "tennessee": "TN", "texas": "TX", "utah": "UT",
    "vermont": "VT", "virginia": "VA", "washington": "WA", "west virginia": "WV",
    "wisconsin": "WI", "wyoming": "WY",
}
_CODE_TO_NAME: dict[str, str] = {v: k for k, v in _NAME_TO_CODE.items()}

_DATA_PATH = Path(__file__).parent.parent / "us_locations_data.json"
_raw: Optional[dict] = None


def _load() -> dict:
    global _raw
    if _raw is None:
        with open(_DATA_PATH) as f:
            _raw = json.load(f)
    return _raw


def _normalize_state(entry_key: str, entry_val: dict) -> dict:
    code = _NAME_TO_CODE.get(entry_key.lower(), entry_key.upper()[:2])
    name = entry_val.get("name") or entry_key.replace("-", " ").title()
    counties = list(entry_val.get("counties") or [])
    cities = list(entry_val.get("cities") or [])
    return {"code": code, "name": name, "counties": counties, "cities": cities}


def get_states() -> list[dict]:
    raw = _load()
    return [_normalize_state(k, v) for k, v in raw.items()]


def get_state(code: str) -> Optional[dict]:
    code = code.upper()
    name_key = _CODE_TO_NAME.get(code, "").lower()
    raw = _load()
    entry = raw.get(name_key)
    if not entry:
        # fallback: scan all states
        for k, v in raw.items():
            if _NAME_TO_CODE.get(k.lower()) == code:
                entry = v
                name_key = k
                break
    if not entry:
        return None
    return _normalize_state(name_key, entry)


def get_all_state_codes() -> list[str]:
    return [s["code"] for s in get_states()]


def iter_state_only(codes: list[str]) -> Iterator[dict]:
    for code in codes:
        st = get_state(code)
        if st:
            yield {"state_code": st["code"], "state_name": st["name"]}


def iter_counties(codes: list[str]) -> Iterator[dict]:
    for code in codes:
        st = get_state(code)
        if not st:
            continue
        for county in st["counties"]:
            yield {
                "state_code": st["code"],
                "state_name": st["name"],
                "county": county,
                "city": None,
            }


def iter_locations(scope: str, codes: list[str]) -> Iterator[dict]:
    if scope == "city":
        for code in codes:
            st = get_state(code)
            if not st:
                continue
            for city in st["cities"]:
                yield {
                    "state_code": st["code"],
                    "state_name": st["name"],
                    "city": city,
                    "county": None,
                }
    elif scope == "county":
        yield from iter_counties(codes)
    elif scope == "state":
        yield from iter_state_only(codes)


def get_county_for_city(state_code: str, city: str) -> Optional[str]:
    """Returns a county name for a given city. Returns None if unknown."""
    # No city→county mapping in the source data; return None.
    return None
