"""SQLAlchemy Core tables. Set DATABASE_URL to a postgresql:// URL to swap engines."""
import sqlalchemy as sa

from . import config

metadata = sa.MetaData()

emails = sa.Table(
    "emails", metadata,
    sa.Column("id", sa.String, primary_key=True),
    sa.Column("sender", sa.String),
    sa.Column("subject", sa.String),
    sa.Column("body", sa.Text),
    sa.Column("attachments", sa.JSON),
    sa.Column("category", sa.String),
    sa.Column("confidence", sa.Float),
    sa.Column("rationale", sa.Text),
    sa.Column("shipment_ref", sa.String),
    sa.Column("status", sa.String),  # OK | MISMATCH | NEEDS_REVIEW | CLASSIFIED
    sa.Column("processed_at", sa.String),
    sa.Column("si_fields", sa.JSON),
    sa.Column("bl_fields", sa.JSON),
    sa.Column("si_evidence", sa.JSON),
    sa.Column("bl_evidence", sa.JSON),
    sa.Column("si_text", sa.Text),
    sa.Column("bl_text", sa.Text),
    sa.Column("reasons", sa.JSON),  # open escalations
    sa.Column("resolved_by", sa.String),
    sa.Column("resolved_at", sa.String),
    sa.Column("escalated_by", sa.String),
    sa.Column("archived_at", sa.String),  # set = hidden from the inbox and review queue
)

edit_log = sa.Table(
    "edit_log", metadata,
    sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
    sa.Column("email_id", sa.String, sa.ForeignKey("emails.id"), index=True),
    sa.Column("doc", sa.String),  # SI | BL
    sa.Column("field", sa.String),
    sa.Column("old_value", sa.String),
    sa.Column("new_value", sa.String),
    sa.Column("editor", sa.String),
    sa.Column("reason", sa.Text),
    sa.Column("timestamp", sa.String),
)

_engine = None


def _create_schema(engine):
    """create_all() never alters an existing table, so add any column an older database lacks."""
    metadata.create_all(engine)
    have = {c["name"] for c in sa.inspect(engine).get_columns(emails.name)}
    with engine.begin() as conn:
        for column in emails.columns:
            if column.name not in have:
                conn.execute(sa.text(
                    f"ALTER TABLE {emails.name} ADD COLUMN {column.name} {column.type.compile(engine.dialect)}"))


def get_engine():
    global _engine
    if _engine is None:
        kwargs = {"connect_args": {"check_same_thread": False}} if config.DATABASE_URL.startswith("sqlite") else {}
        _engine = sa.create_engine(config.DATABASE_URL, **kwargs)
        _create_schema(_engine)
    return _engine


def set_engine(engine):
    global _engine
    _engine = engine
    _create_schema(engine)
