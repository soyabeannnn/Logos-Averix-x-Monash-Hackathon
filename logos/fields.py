"""The 7 compared fields and the label variants that all mean the same field."""
import re

FIELDS = [
    "shipper",
    "consignee",
    "notify_party",
    "port_of_loading",
    "port_of_discharge",
    "container_count",
    "gross_weight_kg",
]

FIELD_LABELS = {
    "shipper": "Shipper",
    "consignee": "Consignee",
    "notify_party": "Notify Party",
    "port_of_loading": "Port of Loading",
    "port_of_discharge": "Port of Discharge",
    "container_count": "Container Count",
    "gross_weight_kg": "Gross Weight (kg)",
}

TEXT_FIELDS = {"shipper", "consignee", "notify_party", "port_of_loading", "port_of_discharge"}
NUMERIC_FIELDS = {"container_count", "gross_weight_kg"}

ALIASES = {
    "shipper": ["Shipper", "Shipper/Exporter", "Exporter", "Consignor"],
    "consignee": ["Consignee", "Consigned To", "Receiver"],
    "notify_party": ["Notify Party", "Notify", "Notify Address", "Also Notify"],
    "port_of_loading": ["Port of Loading", "POL", "Load Port", "Loading Port", "Port of Load"],
    "port_of_discharge": ["Port of Discharge", "POD", "Discharge Port", "Discharging Port", "Port of Destination"],
    "container_count": [
        "No. of Containers", "No. of Containers or Packages", "Container Count",
        "Containers", "Number of Containers", "Qty of Containers",
    ],
    "gross_weight_kg": [
        "Gross Weight (KG)", "Gross Wt", "Gross Wt (kgs)", "Gross Weight", "G.W.", "Total Gross Weight",
    ],
}


def _key(label: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", label.lower()).strip()


_LOOKUP = {_key(a): f for f, names in ALIASES.items() for a in names}


def normalize_label(label: str):
    """Map a document label to its canonical field name, or None if unknown."""
    return _LOOKUP.get(_key(label))


def alias_prompt_block() -> str:
    return "\n".join(f"- {f}: {', '.join(names)}" for f, names in ALIASES.items())
