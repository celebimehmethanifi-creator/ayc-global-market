"""
AYC Global Market - Otopsi / Ogrenen Motor
Sinyal sonuclarini takip eder, dogru/yanlis analizini yapar,
gelecek sinyaller icin modele ag irlik guncellemesi saglar.
SQLite tabanlı - Docker gerektirmez.
"""
from __future__ import annotations
import sqlite3, json, time
from pathlib import Path
from datetime import datetime

DB_PATH = Path(__file__).parent / "neura.db"


def _conn():
    c = sqlite3.connect(str(DB_PATH))
    c.row_factory = sqlite3.Row
    return c


def init_otopsi_tables():
    with _conn() as c:
        c.execute("""CREATE TABLE IF NOT EXISTS signal_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            symbol TEXT NOT NULL,
            market TEXT,
            direction TEXT,
            entry_price REAL,
            target_price REAL,
            stop_loss REAL,
            confidence REAL,
            agreement TEXT,
            kalkan_passed INTEGER,
            final_confidence REAL,
            created_at TEXT DEFAULT (datetime('now')),
            closed_at TEXT,
            outcome TEXT,          -- WIN / LOSS / NEUTRAL / PENDING
            exit_price REAL,
            pnl_pct REAL,
            notes TEXT
        )""")
        c.execute("""CREATE TABLE IF NOT EXISTS model_weights (
            model_name TEXT PRIMARY KEY,
            wins INTEGER DEFAULT 0,
            losses INTEGER DEFAULT 0,
            accuracy REAL DEFAULT 0.5,
            updated_at TEXT DEFAULT (datetime('now'))
        )""")
        # Baslangic agirliklar
        for m in ["GPT-4o", "Claude 3.5", "Gemini 1.5 Pro"]:
            c.execute("INSERT OR IGNORE INTO model_weights (model_name) VALUES (?)", (m,))
        c.commit()


def log_signal(symbol: str, market: str, direction: str, entry_price: float,
               target_price: float | None, stop_loss: float | None,
               confidence: float, agreement: str, kalkan_passed: bool,
               final_confidence: float) -> int:
    with _conn() as c:
        cur = c.execute("""INSERT INTO signal_log
            (symbol, market, direction, entry_price, target_price, stop_loss,
             confidence, agreement, kalkan_passed, final_confidence, outcome)
            VALUES (?,?,?,?,?,?,?,?,?,?,'PENDING')""",
            (symbol, market, direction, entry_price, target_price, stop_loss,
             confidence, agreement, int(kalkan_passed), final_confidence))
        c.commit()
        return cur.lastrowid


def close_signal(signal_id: int, exit_price: float):
    with _conn() as c:
        row = c.execute("SELECT * FROM signal_log WHERE id=?", (signal_id,)).fetchone()
        if not row: return

        direction = row["direction"]
        entry = row["entry_price"] or exit_price
        pnl = ((exit_price - entry) / entry * 100) if direction == "LONG" else \
              ((entry - exit_price) / entry * 100)

        target = row["target_price"]
        stop   = row["stop_loss"]

        if target and exit_price >= target * 0.99:
            outcome = "WIN"
        elif stop and exit_price <= stop * 1.01:
            outcome = "LOSS"
        elif pnl > 0.5:
            outcome = "WIN"
        elif pnl < -0.5:
            outcome = "LOSS"
        else:
            outcome = "NEUTRAL"

        c.execute("""UPDATE signal_log SET
            closed_at=datetime('now'), outcome=?, exit_price=?, pnl_pct=?
            WHERE id=?""", (outcome, exit_price, round(pnl, 4), signal_id))
        c.commit()


def get_stats(symbol: str | None = None, limit: int = 50) -> dict:
    with _conn() as c:
        if symbol:
            rows = c.execute("""SELECT outcome, COUNT(*) as cnt, AVG(pnl_pct) as avg_pnl
                FROM signal_log WHERE symbol=? AND outcome != 'PENDING'
                GROUP BY outcome""", (symbol,)).fetchall()
        else:
            rows = c.execute("""SELECT outcome, COUNT(*) as cnt, AVG(pnl_pct) as avg_pnl
                FROM signal_log WHERE outcome != 'PENDING'
                GROUP BY outcome""").fetchall()

        stats = {r["outcome"]: {"count": r["cnt"], "avg_pnl": round(r["avg_pnl"] or 0, 2)}
                 for r in rows}

        total = sum(v["count"] for v in stats.values())
        wins  = stats.get("WIN", {}).get("count", 0)
        accuracy = round(wins / total * 100, 1) if total > 0 else 0

        recent = c.execute("""SELECT symbol, direction, entry_price, exit_price,
            outcome, pnl_pct, created_at FROM signal_log
            ORDER BY id DESC LIMIT ?""", (limit,)).fetchall()

        return {
            "total_signals": total,
            "win_rate": accuracy,
            "stats_by_outcome": stats,
            "recent": [dict(r) for r in recent]
        }


def get_model_accuracy_weights() -> dict[str, float]:
    """Hangi modelin tahminleri daha cok tuttu - normalize agirliklar doner."""
    with _conn() as c:
        rows = c.execute("SELECT model_name, accuracy FROM model_weights").fetchall()
    weights = {r["model_name"]: float(r["accuracy"]) for r in rows}
    total = sum(weights.values()) or 1
    return {k: round(v / total, 4) for k, v in weights.items()}


# Modul yuklendiginde tablolari olustur
try:
    init_otopsi_tables()
except Exception:
    pass