"""
migrate_to_postgres.py
──────────────────────
Migrates all data from the SQLite database (instance/tickets.db)
to the PostgreSQL database configured in .env (DATABASE_URL).

Usage:
    python migrate_to_postgres.py

Requirements:
    • .env must contain DATABASE_URL pointing to your PostgreSQL server
    • The ticketflow database must already exist in PostgreSQL
    • Run: pip install psycopg2-binary python-dotenv
"""

import sqlite3
import sys
import os
from urllib.parse import urlparse
from dotenv import load_dotenv

load_dotenv()

# ── resolve paths ─────────────────────────────────────────────────────────────
SCRIPT_DIR  = os.path.dirname(os.path.abspath(__file__))
SQLITE_PATH = os.path.join(SCRIPT_DIR, 'instance', 'tickets.db')
DB_URL      = os.environ.get('DATABASE_URL', '')

if DB_URL.startswith('postgres://'):
    DB_URL = DB_URL.replace('postgres://', 'postgresql://', 1)

# ── validate ──────────────────────────────────────────────────────────────────
if not os.path.exists(SQLITE_PATH):
    print(f'[ERROR] SQLite database not found at: {SQLITE_PATH}')
    sys.exit(1)

if not DB_URL.startswith('postgresql://'):
    print('[ERROR] DATABASE_URL in .env must start with postgresql://')
    sys.exit(1)

print(f'[INFO] SQLite source : {SQLITE_PATH}')
print(f'[INFO] PostgreSQL    : {DB_URL}')
print()

# ── connect to PostgreSQL ─────────────────────────────────────────────────────
try:
    import psycopg2
    import psycopg2.extras
except ImportError:
    print('[ERROR] psycopg2-binary is not installed. Run: pip install psycopg2-binary')
    sys.exit(1)

parsed   = urlparse(DB_URL)
pg_conn  = psycopg2.connect(
    host     = parsed.hostname,
    port     = parsed.port or 5432,
    dbname   = parsed.path.lstrip('/'),
    user     = parsed.username,
    password = parsed.password,
)
pg_conn.autocommit = False
pg  = pg_conn.cursor()

# ── connect to SQLite ─────────────────────────────────────────────────────────
sl_conn = sqlite3.connect(SQLITE_PATH)
sl_conn.row_factory = sqlite3.Row
sl  = sl_conn.cursor()

# ── create all tables via Flask ───────────────────────────────────────────────
print('[STEP 1] Creating PostgreSQL tables via Flask app...')
# We import app just to trigger db.create_all() — no server is started
os.environ.setdefault('FLASK_ENV', 'migration')
try:
    from app import app, db
    with app.app_context():
        db.create_all()
    print('         Tables created (or already exist).')
except Exception as exc:
    print(f'[ERROR] Could not initialise Flask app: {exc}')
    sys.exit(1)

print()

# ── boolean columns that SQLite stores as 0/1 integers ───────────────────────
BOOL_COLUMNS = {
    'users':               {'is_active_user'},
    'tickets':             {'is_deleted', 'is_archived'},
    'notifications':       {'is_read'},
    'chat_messages':       {'is_system'},
}

def cast_row(cols, row, table):
    """Convert SQLite integer booleans to Python bool for PostgreSQL."""
    bool_cols = BOOL_COLUMNS.get(table, set())
    result = []
    for col, val in zip(cols, row):
        if col in bool_cols and val is not None:
            result.append(bool(val))
        else:
            result.append(val)
    return tuple(result)

# ── helper ────────────────────────────────────────────────────────────────────
def migrate_table(sqlite_table, pg_table=None):
    pg_table = pg_table or sqlite_table
    sl.execute(f'SELECT * FROM {sqlite_table}')
    rows = sl.fetchall()
    if not rows:
        print(f'  [SKIP] {sqlite_table} — no rows')
        return 0

    cols         = [d[0] for d in sl.description]
    placeholders = ', '.join(['%s'] * len(cols))
    col_list     = ', '.join(f'"{c}"' for c in cols)
    sql          = f'INSERT INTO {pg_table} ({col_list}) VALUES ({placeholders}) ON CONFLICT DO NOTHING'

    data = [cast_row(cols, row, sqlite_table) for row in rows]
    psycopg2.extras.execute_batch(pg, sql, data, page_size=500)
    print(f'  [OK]   {pg_table:<30} {len(rows):>5} row(s)')
    return len(rows)

# ── disable FK checks during bulk load ───────────────────────────────────────
pg.execute("SET session_replication_role = 'replica'")

# ── migrate tables in dependency order ───────────────────────────────────────
print('[STEP 2] Migrating data...')

TABLE_ORDER = [
    'users',
    'tickets',
    'comments',
    'activity_logs',
    'notifications',
    'chat_messages',
    'chat_participants',
    'conversations',
    'conversation_members',
    'direct_messages',
]

total = 0
for tbl in TABLE_ORDER:
    # check if the sqlite table exists
    sl.execute("SELECT name FROM sqlite_master WHERE type='table' AND name=?", (tbl,))
    if not sl.fetchone():
        print(f'  [SKIP] {tbl} — not found in SQLite (new table, no data to migrate)')
        continue
    try:
        total += migrate_table(tbl)
    except Exception as exc:
        pg_conn.rollback()
        print(f'  [FAIL] {tbl}: {exc}')
        print('         Rolling back. Fix the error and re-run.')
        sys.exit(1)

# ── re-enable FK checks ───────────────────────────────────────────────────────
pg.execute("SET session_replication_role = 'origin'")

# ── reset sequences so new rows get correct IDs ──────────────────────────────
print()
print('[STEP 3] Resetting PostgreSQL sequences...')

SEQUENCES = [
    ('users',                'id', 'users_id_seq'),
    ('tickets',              'id', 'tickets_id_seq'),
    ('comments',             'id', 'comments_id_seq'),
    ('activity_logs',        'id', 'activity_logs_id_seq'),
    ('notifications',        'id', 'notifications_id_seq'),
    ('chat_messages',        'id', 'chat_messages_id_seq'),
    ('chat_participants',    'id', 'chat_participants_id_seq'),
    ('conversations',        'id', 'conversations_id_seq'),
    ('conversation_members', 'id', 'conversation_members_id_seq'),
    ('direct_messages',      'id', 'direct_messages_id_seq'),
]

for table, col, seq in SEQUENCES:
    try:
        pg.execute(f"SELECT setval('{seq}', COALESCE((SELECT MAX({col}) FROM {table}), 1))")
        print(f'  [OK]   {seq}')
    except Exception:
        pg_conn.rollback()
        pg.execute("SET session_replication_role = 'origin'")
        print(f'  [WARN] Sequence {seq} not found — skipping')

# ── commit ────────────────────────────────────────────────────────────────────
pg_conn.commit()

print()
print(f'[DONE] Migration complete. {total} total rows migrated to PostgreSQL.')
print()
print('Next steps:')
print('  1. Restart the Flask server: python app.py')
print('  2. Log in and verify your data is intact.')
print('  3. Delete instance/tickets.db once you are satisfied.')

pg.close()
pg_conn.close()
sl_conn.close()
