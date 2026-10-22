"""Per-organisation people schema, stored in app_settings.settings['people_schema']."""
import copy
import re
from datetime import date

from fastapi import HTTPException

from app.database.supabase_client import get_supabase
from app.people.presets import PRESETS, DEFAULT_ORG_TYPE, get_preset

FIELD_TYPES = {"text", "textarea", "number", "date", "email", "phone", "select", "checkbox"}
RESERVED_KEYS = {"id", "full_name", "employee_code", "department", "department_id", "status",
                 "organization_id", "user_id", "metadata", "created_at", "updated_at"}
COLUMN_KEYS = {"email", "phone", "position", "hire_date"}
MAX_FIELDS = 40
MAX_OPTIONS = 50
MAX_VALUE_LEN = 500
KEY_RE = re.compile(r"^[a-z][a-z0-9_]{0,39}$")
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
PHONE_RE = re.compile(r"^[0-9+()\-\s.]{5,25}$")
DEFAULT_LABELS = {"person_singular": "Person", "person_plural": "People", "id_label": "ID No."}


def slugify(label):
    s = re.sub(r"[^a-z0-9]+", "_", (label or "").lower()).strip("_")
    if not s or not s[0].isalpha():
        s = "f_" + s
    return s[:40]


def _clean(v, limit=120):
    return re.sub(r"[<>{}\\]", "", str(v or "").strip())[:limit]


def normalize_labels(raw, fallback):
    raw = raw if isinstance(raw, dict) else {}
    return {k: (_clean(raw.get(k), 40) or fallback.get(k) or DEFAULT_LABELS[k]) for k in DEFAULT_LABELS}


def normalize_fields(raw):
    if not isinstance(raw, list):
        raise HTTPException(status_code=400, detail="fields must be a list")
    if len(raw) > MAX_FIELDS:
        raise HTTPException(status_code=400, detail=f"A maximum of {MAX_FIELDS} fields is allowed")
    out, seen = [], set()
    for i, f in enumerate(raw):
        if not isinstance(f, dict):
            raise HTTPException(status_code=400, detail=f"Field #{i + 1} is invalid")
        label = _clean(f.get("label"), 60)
        if not label:
            raise HTTPException(status_code=400, detail=f"Field #{i + 1} needs a label")
        key = (f.get("key") or "").strip().lower() or slugify(label)
        if not KEY_RE.match(key):
            raise HTTPException(status_code=400, detail=f"'{label}': name must start with a letter and use only a-z, 0-9 and _")
        if key in RESERVED_KEYS:
            raise HTTPException(status_code=400, detail=f"'{label}': '{key}' is a built-in field - choose another name")
        if key in seen:
            raise HTTPException(status_code=400, detail=f"Two fields use the name '{key}'")
        seen.add(key)
        ftype = f.get("type") or "text"
        if ftype not in FIELD_TYPES:
            raise HTTPException(status_code=400, detail=f"'{label}': unknown type '{ftype}'")
        options = []
        if ftype == "select":
            raw_opts = f.get("options") or []
            if isinstance(raw_opts, str):
                raw_opts = raw_opts.split(",")
            options = list(dict.fromkeys(o for o in (_clean(x, 80) for x in raw_opts) if o))[:MAX_OPTIONS]
            if not options:
                raise HTTPException(status_code=400, detail=f"'{label}': a dropdown needs at least one option")
        out.append({"key": key, "label": label, "type": ftype,
                    "required": bool(f.get("required")) and ftype != "checkbox", "options": options,
                    "show_in_list": bool(f.get("show_in_list")), "include_in_report": bool(f.get("include_in_report")),
                    "placeholder": _clean(f.get("placeholder"), 80)})
    return out


def _org_type(sb, org_id):
    try:
        r = sb.table("organizations").select("org_type").eq("id", org_id).maybe_single().execute()
        t = ((getattr(r, "data", None) if r is not None else None) or {}).get("org_type")
        return t if t in PRESETS else DEFAULT_ORG_TYPE
    except Exception:
        return DEFAULT_ORG_TYPE


def _settings_row(sb, org_id):
    r = sb.table("app_settings").select("id, settings").eq("organization_id", org_id).maybe_single().execute()
    return getattr(r, "data", None) if r is not None else None


def get_org_schema(org_id):
    sb = get_supabase()
    org_type = _org_type(sb, org_id)
    row = _settings_row(sb, org_id) or {}
    settings = row.get("settings") if isinstance(row.get("settings"), dict) else {}
    saved = settings.get("people_schema")
    preset = get_preset(org_type)
    if isinstance(saved, dict) and isinstance(saved.get("fields"), list):
        return {"org_type": saved.get("org_type") or org_type,
                "labels": normalize_labels(saved.get("labels"), preset["labels"]),
                "fields": saved["fields"], "is_default": False}
    return {"org_type": org_type, "labels": copy.deepcopy(preset["labels"]),
            "fields": copy.deepcopy(preset["fields"]), "is_default": True}


def save_org_schema(org_id, org_type, labels, fields):
    sb = get_supabase()
    if org_type not in PRESETS:
        org_type = _org_type(sb, org_id)
    preset = get_preset(org_type)
    clean = {"org_type": org_type, "labels": normalize_labels(labels, preset["labels"]), "fields": normalize_fields(fields)}
    row = _settings_row(sb, org_id)
    if row:
        settings = row.get("settings") if isinstance(row.get("settings"), dict) else {}
        settings["people_schema"] = clean
        sb.table("app_settings").update({"settings": settings}).eq("id", row["id"]).execute()
    else:
        sb.table("app_settings").insert({"organization_id": org_id, "settings": {"people_schema": clean}}).execute()
    try:
        sb.table("organizations").update({"org_type": org_type}).eq("id", org_id).execute()
    except Exception:
        pass
    return {**clean, "is_default": False}


def _coerce(field, value):
    t, label = field["type"], field["label"]
    if t == "checkbox":
        if isinstance(value, bool):
            return value, None
        return str(value).strip().lower() in ("1", "true", "yes", "on"), None
    if value is None or (isinstance(value, str) and value.strip() == ""):
        return None, None
    s = str(value).strip()
    if len(s) > MAX_VALUE_LEN:
        return None, f"{label} is too long"
    if t == "number":
        try:
            n = float(s)
        except ValueError:
            return None, f"{label} must be a number"
        return (int(n) if n.is_integer() else n), None
    if t == "date":
        try:
            return date.fromisoformat(s[:10]).isoformat(), None
        except ValueError:
            return None, f"{label} must be a date (YYYY-MM-DD)"
    if t == "email":
        return (s, None) if EMAIL_RE.match(s) else (None, f"{label} is not a valid email")
    if t == "phone":
        return (s, None) if PHONE_RE.match(s) else (None, f"{label} is not a valid phone number")
    if t == "select":
        return (s, None) if s in field.get("options", []) else (None, f"{label}: choose one of the listed options")
    return re.sub(r"[<>{}\\]", "", s), None


def validate_metadata(fields, data, existing=None):
    data = data if isinstance(data, dict) else {}
    out = dict(existing or {})
    errors = []
    for f in fields:
        k = f["key"]
        if k not in data:
            if f.get("required") and out.get(k) in (None, ""):
                errors.append(f"{f['label']} is required")
            continue
        val, err = _coerce(f, data.get(k))
        if err:
            errors.append(err)
            continue
        if f.get("required") and val in (None, ""):
            errors.append(f"{f['label']} is required")
            continue
        if val is None:
            out.pop(k, None)
        else:
            out[k] = val
    if errors:
        raise HTTPException(status_code=400, detail="; ".join(errors))
    return out


def column_values(fields, metadata):
    types = {f["key"]: f["type"] for f in fields}
    out = {}
    for k in COLUMN_KEYS:
        if k not in types:
            continue
        if k == "hire_date" and types[k] != "date":
            continue
        v = metadata.get(k)
        out[k] = v if v not in ("",) else None
    return out
