"""Fixed external data layout shared by the manager's Python entry points."""

import os
import json
from pathlib import Path

CODE_DIR = Path(__file__).resolve().parent
_settings_path = Path(os.environ.get("CHARACTER_MANAGER_SETTINGS_FILE") or "../rplay-canvas-settings.json")
SETTINGS_FILE = (_settings_path if _settings_path.is_absolute() else CODE_DIR / _settings_path).resolve()


def _read_configured_directory():
    if not SETTINGS_FILE.exists():
        return None
    try:
        settings = json.loads(SETTINGS_FILE.read_text(encoding="utf-8-sig"))
    except (OSError, ValueError) as error:
        raise ValueError(f"Cannot read manager settings file: {SETTINGS_FILE} ({error})") from error
    if not isinstance(settings, dict):
        raise ValueError(f"Manager settings must be a JSON object: {SETTINGS_FILE}")
    if "dataDirectory" not in settings:
        return None
    directory = settings["dataDirectory"]
    if not isinstance(directory, str) or not directory.strip():
        raise ValueError(f"dataDirectory must be a non-empty path: {SETTINGS_FILE}")
    return directory


_configured_directory = os.environ.get("CHARACTER_MANAGER_DATA_DIR") or _read_configured_directory()
_configured = Path(_configured_directory or "../data")
DATA_DIR = (_configured if _configured.is_absolute() else CODE_DIR / _configured).resolve()
if DATA_DIR == CODE_DIR or DATA_DIR.is_relative_to(CODE_DIR):
    raise ValueError("CHARACTER_MANAGER_DATA_DIR must be outside the manager code directory")
if not DATA_DIR.exists():
    if _configured_directory:
        raise ValueError(f"Selected data directory does not exist: {DATA_DIR}")
    DATA_DIR.mkdir(parents=True, exist_ok=True)
if not DATA_DIR.is_dir():
    raise ValueError(f"Data path is not a directory: {DATA_DIR}")

CONFIG_DIR = DATA_DIR / "config"
EXPORTS_DIR = DATA_DIR / "exports"
REPORTS_DIR = DATA_DIR / "reports"
