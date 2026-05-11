"""Initial schema - NEURA database

Revision ID: 0001
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB, ARRAY
import uuid

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Enable extensions
    op.execute("CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\"")
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    # ── users ────────────────────────────────────────────────────────────────
    op.create_table(
        "users",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column("email", sa.Text, nullable=False, unique=True),
        sa.Column("display_name", sa.Text),
        sa.Column("tier", sa.Enum("free", "pro", "elite", name="user_tier_enum"), nullable=False, server_default="free"),
        sa.Column("language", sa.Text, nullable=False, server_default="tr"),
        sa.Column("timezone", sa.Text, nullable=False, server_default="Europe/Istanbul"),
        sa.Column("risk_profile", JSONB, nullable=False, server_default="{}"),
        sa.Column("investor_iq", sa.Integer, nullable=False, server_default="0"),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.TIMESTAMP(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    # ── assets ────────────────────────────────────────────────────────────────
    op.create_table(
        "assets",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column("symbol", sa.Text, nullable=False),
        sa.Column("name", sa.Text, nullable=False),
        sa.Column("category", sa.Enum(
            "ALL", "BIST", "US", "CRYPTO", "COMMODITY", "ENERGY", "FOREX", "INDEX", "ETF",
            name="asset_category_enum"
        ), nullable=False),
        sa.Column("exchange", sa.Text),
        sa.Column("currency", sa.Text, nullable=False, server_default="USD"),
        sa.Column("data_source", ARRAY(sa.Text), server_default="{}"),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("meta", JSONB, nullable=False, server_default="{}"),
    )
    op.create_index("ix_assets_symbol", "assets", ["symbol"])
    op.create_index("ix_assets_category", "assets", ["category"])

    # ── asset_prices ─────────────────────────────────────────────────────────
    op.create_table(
        "asset_prices",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column("asset_id", UUID(as_uuid=True), sa.ForeignKey("assets.id", ondelete="CASCADE"), nullable=False),
        sa.Column("price", sa.Numeric(20, 8), nullable=False),
        sa.Column("open", sa.Numeric(20, 8)),
        sa.Column("high", sa.Numeric(20, 8)),
        sa.Column("low", sa.Numeric(20, 8)),
        sa.Column("volume", sa.Numeric(30, 4)),
        sa.Column("change_pct", sa.Numeric(8, 4)),
        sa.Column("source", sa.Text, nullable=False),
        sa.Column("fetched_at", sa.TIMESTAMP(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_asset_prices_asset_fetched", "asset_prices", ["asset_id", sa.text("fetched_at DESC")])

    # ── signals ──────────────────────────────────────────────────────────────
    op.create_table(
        "signals",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column("asset_id", UUID(as_uuid=True), sa.ForeignKey("assets.id", ondelete="CASCADE"), nullable=False),
        sa.Column("direction", sa.Enum("long", "short", "neutral", name="signal_direction_enum"), nullable=False),
        sa.Column("confidence", sa.Numeric(5, 2), nullable=False),
        sa.Column("entry_price", sa.Numeric(20, 8)),
        sa.Column("target_price", sa.Numeric(20, 8)),
        sa.Column("stop_loss", sa.Numeric(20, 8)),
        sa.Column("risk_reward", sa.Numeric(6, 2)),
        sa.Column("timeframe", sa.Text, nullable=False, server_default="1d"),
        sa.Column("ai_reasoning", sa.Text, server_default=""),
        sa.Column("consensus_data", JSONB, server_default="{}"),
        sa.Column("kalkan_block", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("kalkan_reasons", ARRAY(sa.Text), server_default="{}"),
        sa.Column("expires_at", sa.TIMESTAMP(timezone=True)),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_signals_asset_confidence", "signals", ["asset_id", "confidence"])
    op.create_index("ix_signals_created", "signals", [sa.text("created_at DESC")])

    # ── strategies ────────────────────────────────────────────────────────────
    op.create_table(
        "strategies",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column("asset_id", UUID(as_uuid=True), sa.ForeignKey("assets.id", ondelete="CASCADE"), nullable=False),
        sa.Column("signal_id", UUID(as_uuid=True), sa.ForeignKey("signals.id", ondelete="CASCADE"), nullable=False),
        sa.Column("entry_price", sa.Numeric(20, 8), nullable=False),
        sa.Column("target1", sa.Numeric(20, 8), nullable=False),
        sa.Column("target2", sa.Numeric(20, 8)),
        sa.Column("stop_loss", sa.Numeric(20, 8), nullable=False),
        sa.Column("risk_reward", sa.Numeric(6, 2)),
        sa.Column("entry_timing", JSONB, server_default="{}"),
        sa.Column("exit_strategy", JSONB, server_default="{}"),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.func.now()),
    )

    # ── alarms ───────────────────────────────────────────────────────────────
    op.create_table(
        "alarms",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("asset_id", UUID(as_uuid=True), sa.ForeignKey("assets.id", ondelete="SET NULL")),
        sa.Column("alarm_type", sa.Enum(
            "price", "signal", "drawdown", "contrarian", "emotional", "kalkan",
            name="alarm_type_enum"
        ), nullable=False),
        sa.Column("condition", JSONB, nullable=False),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("triggered_at", sa.TIMESTAMP(timezone=True)),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_alarms_user_active", "alarms", ["user_id", "is_active"])

    # ── portfolios ────────────────────────────────────────────────────────────
    op.create_table(
        "portfolios",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.Text, nullable=False, server_default="Ana Portföy"),
        sa.Column("currency", sa.Text, nullable=False, server_default="TRY"),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.func.now()),
    )

    # ── portfolio_positions ───────────────────────────────────────────────────
    op.create_table(
        "portfolio_positions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column("portfolio_id", UUID(as_uuid=True), sa.ForeignKey("portfolios.id", ondelete="CASCADE"), nullable=False),
        sa.Column("asset_id", UUID(as_uuid=True), sa.ForeignKey("assets.id", ondelete="CASCADE"), nullable=False),
        sa.Column("entry_price", sa.Numeric(20, 8), nullable=False),
        sa.Column("quantity", sa.Numeric(20, 8), nullable=False),
        sa.Column("entry_date", sa.Date, nullable=False),
        sa.Column("notes", sa.Text),
        sa.Column("is_simulation", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.func.now()),
    )

    # ── trades ────────────────────────────────────────────────────────────────
    op.create_table(
        "trades",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("asset_id", UUID(as_uuid=True), sa.ForeignKey("assets.id", ondelete="CASCADE"), nullable=False),
        sa.Column("signal_id", UUID(as_uuid=True), sa.ForeignKey("signals.id", ondelete="SET NULL")),
        sa.Column("direction", sa.Enum("long", "short", name="trade_direction_enum"), nullable=False),
        sa.Column("entry_price", sa.Numeric(20, 8), nullable=False),
        sa.Column("exit_price", sa.Numeric(20, 8)),
        sa.Column("quantity", sa.Numeric(20, 8), nullable=False),
        sa.Column("pnl", sa.Numeric(20, 8)),
        sa.Column("pnl_pct", sa.Numeric(8, 4)),
        sa.Column("is_simulation", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("entry_time", sa.TIMESTAMP(timezone=True), server_default=sa.func.now()),
        sa.Column("exit_time", sa.TIMESTAMP(timezone=True)),
        sa.Column("autopsy_report", JSONB, server_default="{}"),
    )
    op.create_index("ix_trades_user_entry", "trades", ["user_id", sa.text("entry_time DESC")])

    # ── user_behavior ─────────────────────────────────────────────────────────
    op.create_table(
        "user_behavior",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("event_type", sa.Text, nullable=False),
        sa.Column("asset_id", UUID(as_uuid=True), sa.ForeignKey("assets.id", ondelete="SET NULL")),
        sa.Column("session_data", JSONB, server_default="{}"),
        sa.Column("recorded_at", sa.TIMESTAMP(timezone=True), server_default=sa.func.now()),
    )

    # ── scores ────────────────────────────────────────────────────────────────
    op.create_table(
        "scores",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("investor_iq", sa.Integer, nullable=False, server_default="0"),
        sa.Column("simulation_level", sa.Integer, nullable=False, server_default="1"),
        sa.Column("win_rate", sa.Numeric(5, 2), server_default="0"),
        sa.Column("avg_rr", sa.Numeric(6, 2), server_default="0"),
        sa.Column("kalkan_obedience", sa.Numeric(5, 2), server_default="100"),
        sa.Column("leaderboard_rank", sa.Integer),
        sa.Column("calculated_at", sa.TIMESTAMP(timezone=True), server_default=sa.func.now()),
    )

    # ── social_votes ──────────────────────────────────────────────────────────
    op.create_table(
        "social_votes",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column("asset_id", UUID(as_uuid=True), sa.ForeignKey("assets.id", ondelete="CASCADE"), nullable=False),
        sa.Column("direction", sa.Enum("bullish", "bearish", "neutral", name="vote_direction_enum"), nullable=False),
        sa.Column("anon_hash", sa.Text, nullable=False),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_social_votes_asset", "social_votes", ["asset_id"])
    op.create_index("ix_social_votes_anon_hash", "social_votes", ["anon_hash"], unique=True)

    # ── sentiment_scores ──────────────────────────────────────────────────────
    op.create_table(
        "sentiment_scores",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column("asset_id", UUID(as_uuid=True), sa.ForeignKey("assets.id", ondelete="CASCADE"), nullable=False),
        sa.Column("source", sa.Text, nullable=False),
        sa.Column("score", sa.Numeric(5, 2), nullable=False),
        sa.Column("raw_data", JSONB, server_default="{}"),
        sa.Column("analyzed_at", sa.TIMESTAMP(timezone=True), server_default=sa.func.now()),
    )

    # ── watchlist ─────────────────────────────────────────────────────────────
    op.create_table(
        "watchlist",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("asset_id", UUID(as_uuid=True), sa.ForeignKey("assets.id", ondelete="CASCADE"), nullable=False),
        sa.Column("added_at", sa.TIMESTAMP(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_watchlist_user_asset", "watchlist", ["user_id", "asset_id"], unique=True)


def downgrade() -> None:
    tables = [
        "watchlist", "sentiment_scores", "social_votes", "scores",
        "user_behavior", "trades", "portfolio_positions", "portfolios",
        "alarms", "strategies", "signals", "asset_prices", "assets", "users",
    ]
    for t in tables:
        op.drop_table(t)
    for e in [
        "user_tier_enum", "asset_category_enum", "signal_direction_enum",
        "alarm_type_enum", "vote_direction_enum", "trade_direction_enum",
    ]:
        op.execute(f"DROP TYPE IF EXISTS {e}")
