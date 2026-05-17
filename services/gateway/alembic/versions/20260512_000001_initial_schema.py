"""Initial gateway schema

Revision ID: 20260512_000001
Revises:
Create Date: 2026-05-12
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "20260512_000001"
down_revision = None
branch_labels = None
depends_on = None


tier_enum = sa.Enum("free", "pro", "elite", name="tierenum")
provider_enum = sa.Enum(
    "stripe",
    "iyzico",
    "paytr",
    "lemonsqueezy",
    "apple_iap",
    "google_play",
    "manual",
    name="providerenum",
)
sub_status_enum = sa.Enum("active", "cancelled", "expired", "pending", name="substatusenum")


def upgrade() -> None:
    bind = op.get_bind()
    tier_enum.create(bind, checkfirst=True)
    provider_enum.create(bind, checkfirst=True)
    sub_status_enum.create(bind, checkfirst=True)

    op.create_table(
        "users",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("display_name", sa.String(length=100), nullable=True),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("tier", tier_enum, nullable=False, server_default="free"),
        sa.Column("language", sa.String(length=8), nullable=True, server_default="tr"),
        sa.Column("risk_level", sa.String(length=10), nullable=True, server_default="medium"),
        sa.Column("is_active", sa.Boolean(), nullable=True, server_default=sa.text("1")),
        sa.Column("email_verified", sa.Boolean(), nullable=True, server_default=sa.text("0")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    op.create_table(
        "subscriptions",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("plan", tier_enum, nullable=False),
        sa.Column("provider", provider_enum, nullable=False),
        sa.Column("provider_sub_id", sa.String(length=255), nullable=True),
        sa.Column("status", sub_status_enum, nullable=True, server_default="active"),
        sa.Column("price_usd", sa.Float(), nullable=True, server_default="0"),
        sa.Column("price_try", sa.Float(), nullable=True, server_default="0"),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("cancelled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_subscriptions_user_id", "subscriptions", ["user_id"], unique=False)

    op.create_table(
        "transactions",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("subscription_id", sa.String(length=36), nullable=True),
        sa.Column("provider", provider_enum, nullable=True),
        sa.Column("provider_txn_id", sa.String(length=255), nullable=True),
        sa.Column("amount", sa.Float(), nullable=False),
        sa.Column("currency", sa.String(length=8), nullable=True, server_default="USD"),
        sa.Column("status", sa.String(length=32), nullable=True),
        sa.Column("plan", tier_enum, nullable=True),
        sa.Column("extra_data", sa.Text(), nullable=True, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_transactions_user_id", "transactions", ["user_id"], unique=False)

    op.create_table(
        "refresh_tokens",
        sa.Column("token", sa.String(length=255), primary_key=True),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked", sa.Boolean(), nullable=True, server_default=sa.text("0")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_refresh_tokens_user_id", "refresh_tokens", ["user_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_refresh_tokens_user_id", table_name="refresh_tokens")
    op.drop_table("refresh_tokens")

    op.drop_index("ix_transactions_user_id", table_name="transactions")
    op.drop_table("transactions")

    op.drop_index("ix_subscriptions_user_id", table_name="subscriptions")
    op.drop_table("subscriptions")

    op.drop_index("ix_users_email", table_name="users")
    op.drop_table("users")

    bind = op.get_bind()
    sub_status_enum.drop(bind, checkfirst=True)
    provider_enum.drop(bind, checkfirst=True)
    tier_enum.drop(bind, checkfirst=True)
