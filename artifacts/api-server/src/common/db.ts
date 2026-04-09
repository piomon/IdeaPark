import { Pool } from 'pg';

let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env['DATABASE_URL'],
      max: 10,
      idleTimeoutMillis: 30000,
    });
  }
  return pool;
}

export async function query(text: string, params?: any[]) {
  const client = await getPool().connect();
  try {
    return await client.query(text, params);
  } finally {
    client.release();
  }
}

export async function initDatabase() {
  const sql = `
    CREATE TABLE IF NOT EXISTS residents (
      id TEXT PRIMARY KEY,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      password_hash TEXT,
      city TEXT NOT NULL DEFAULT 'Radom',
      street TEXT NOT NULL DEFAULT 'ul. Listopadowa',
      building TEXT NOT NULL DEFAULT '4',
      apartment TEXT NOT NULL,
      space_code TEXT NOT NULL UNIQUE,
      parking_type TEXT NOT NULL CHECK (parking_type IN ('naziemne', 'podziemne')),
      stage TEXT NOT NULL,
      phone TEXT,
      plate_number TEXT,
      role TEXT NOT NULL DEFAULT 'resident',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='residents' AND column_name='password_hash') THEN
        ALTER TABLE residents ADD COLUMN password_hash TEXT;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='residents' AND column_name='plate_number') THEN
        ALTER TABLE residents ADD COLUMN plate_number TEXT;
      END IF;
    END $$;

    CREATE TABLE IF NOT EXISTS sharing_entries (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES residents(id),
      space_code TEXT NOT NULL,
      parking_type TEXT NOT NULL,
      stage TEXT NOT NULL,
      date_from TIMESTAMPTZ NOT NULL,
      date_to TIMESTAMPTZ NOT NULL,
      status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'pending', 'confirmed', 'completed')),
      requested_by_user_id TEXT REFERENCES residents(id),
      vacated_at TIMESTAMPTZ,
      posted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT no_self_request CHECK (user_id != requested_by_user_id)
    );

    CREATE TABLE IF NOT EXISTS seeking_entries (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES residents(id),
      stage TEXT NOT NULL,
      date_from TIMESTAMPTZ NOT NULL,
      date_to TIMESTAMPTZ NOT NULL,
      status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'has_proposal', 'matched')),
      matched_space_code TEXT,
      matched_owner_id TEXT REFERENCES residents(id),
      matched_parking_type TEXT,
      posted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS proposals (
      id TEXT PRIMARY KEY,
      seeking_id TEXT NOT NULL REFERENCES seeking_entries(id) ON DELETE CASCADE,
      from_user_id TEXT NOT NULL REFERENCES residents(id),
      space_code TEXT NOT NULL,
      parking_type TEXT NOT NULL,
      stage TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS chat_threads (
      id TEXT PRIMARY KEY,
      space_code TEXT NOT NULL,
      user_a TEXT NOT NULL REFERENCES residents(id),
      user_b TEXT NOT NULL REFERENCES residents(id),
      related_reservation_id TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY,
      thread_id TEXT NOT NULL REFERENCES chat_threads(id) ON DELETE CASCADE,
      from_user_id TEXT NOT NULL REFERENCES residents(id),
      text TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES residents(id),
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      space_code TEXT,
      related_id TEXT,
      read BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_sharing_user ON sharing_entries(user_id);
    CREATE INDEX IF NOT EXISTS idx_sharing_stage ON sharing_entries(stage);
    CREATE INDEX IF NOT EXISTS idx_sharing_status ON sharing_entries(status);
    CREATE INDEX IF NOT EXISTS idx_seeking_user ON seeking_entries(user_id);
    CREATE INDEX IF NOT EXISTS idx_seeking_stage ON seeking_entries(stage);
    CREATE INDEX IF NOT EXISTS idx_proposals_seeking ON proposals(seeking_id);
    CREATE INDEX IF NOT EXISTS idx_chat_messages_thread ON chat_messages(thread_id);
    CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
  `;
  await query(sql);

  const migrateDateToTimestamp = `
    DO $$ BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='sharing_entries' AND column_name='date_from' AND data_type='date'
      ) THEN
        ALTER TABLE sharing_entries ALTER COLUMN date_from TYPE TIMESTAMPTZ USING date_from::timestamptz;
        ALTER TABLE sharing_entries ALTER COLUMN date_to TYPE TIMESTAMPTZ USING date_to::timestamptz;
      END IF;
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='seeking_entries' AND column_name='date_from' AND data_type='date'
      ) THEN
        ALTER TABLE seeking_entries ALTER COLUMN date_from TYPE TIMESTAMPTZ USING date_from::timestamptz;
        ALTER TABLE seeking_entries ALTER COLUMN date_to TYPE TIMESTAMPTZ USING date_to::timestamptz;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sharing_entries' AND column_name='vacated_at') THEN
        ALTER TABLE sharing_entries ADD COLUMN vacated_at TIMESTAMPTZ;
      END IF;
    END $$;
  `;
  await query(migrateDateToTimestamp);

  await query(`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'sharing_entries_status_check'
        AND convalidated AND (
          SELECT conkey FROM pg_constraint WHERE conname = 'sharing_entries_status_check'
        ) IS NOT NULL
      ) THEN
        NULL;
      END IF;
    EXCEPTION WHEN OTHERS THEN NULL;
    END $$;
  `).catch(() => {});

  console.log('Database schema initialized');
}


export async function seedDemoData() {
  const { rows } = await query('SELECT COUNT(*) as cnt FROM residents');
  if (parseInt(rows[0].cnt, 10) > 0) {
    console.log('Demo data already seeded');
    return;
  }

  await query(`
    INSERT INTO residents (id, first_name, last_name, city, street, building, apartment, space_code, parking_type, stage, plate_number, role) VALUES
    ('user_anna', 'Anna', 'Kowalska', 'Radom', 'ul. Listopadowa', '4', '12A', 'P1-014', 'podziemne', 'Orion', 'WRA 54321', 'resident'),
    ('user_tomasz', 'Tomasz', 'Maj', 'Radom', 'ul. Listopadowa', '4', '22B', 'P1-022', 'podziemne', 'Orion', 'WRA 12345', 'resident'),
    ('user_ewa', 'Ewa', 'Jabłońska', 'Radom', 'ul. Listopadowa', '6', '41C', 'P2-041', 'podziemne', 'Aurora', 'WRA 67890', 'resident'),
    ('user_rafal', 'Rafał', 'Nowicki', 'Radom', 'ul. Listopadowa', '2', '7D', 'P3-007', 'naziemne', 'Alfa', 'WRA 11223', 'resident'),
    ('user_karol', 'Karol', 'Wiśniewski', 'Radom', 'ul. Listopadowa', '4', '5A', 'P1-005', 'podziemne', 'Orion', 'WRA 44556', 'resident'),
    ('user_monika', 'Monika', 'Dąbrowska', 'Radom', 'ul. Listopadowa', '6', '33B', 'P2-033', 'podziemne', 'Aurora', 'WRA 77889', 'resident'),
    ('user_piotr', 'Piotr', 'Lis', 'Radom', 'ul. Listopadowa', '2', '18C', 'P3-018', 'naziemne', 'Alfa', 'WRA 99001', 'resident')
    ON CONFLICT (id) DO NOTHING
  `);

  await query(`
    INSERT INTO sharing_entries (id, user_id, space_code, parking_type, stage, date_from, date_to, status, requested_by_user_id, posted_at) VALUES
    ('sh1', 'user_anna', 'P1-014', 'podziemne', 'Orion', '2026-04-11T08:00:00Z', '2026-04-16T18:00:00Z', 'available', NULL, '2026-04-09T07:45:00Z'),
    ('sh2', 'user_tomasz', 'P1-022', 'podziemne', 'Orion', '2026-04-10T07:00:00Z', '2026-04-13T20:00:00Z', 'confirmed', 'user_karol', '2026-04-09T08:00:00Z'),
    ('sh3', 'user_ewa', 'P2-041', 'podziemne', 'Aurora', '2026-04-13T09:00:00Z', '2026-04-19T22:00:00Z', 'available', NULL, '2026-04-09T09:30:00Z'),
    ('sh4', 'user_rafal', 'P3-007', 'naziemne', 'Alfa', '2026-04-15T06:00:00Z', '2026-04-22T21:00:00Z', 'available', NULL, '2026-04-09T10:45:00Z')
    ON CONFLICT (id) DO NOTHING
  `);

  await query(`
    INSERT INTO seeking_entries (id, user_id, stage, date_from, date_to, status, matched_space_code, matched_owner_id, matched_parking_type, posted_at) VALUES
    ('sk1', 'user_anna', 'Orion', '2026-04-20T10:00:00Z', '2026-04-23T17:00:00Z', 'open', NULL, NULL, NULL, '2026-04-09T08:30:00Z'),
    ('sk2', 'user_karol', 'Orion', '2026-04-10T07:00:00Z', '2026-04-11T20:00:00Z', 'matched', 'P1-022', 'user_tomasz', 'podziemne', '2026-04-09T09:15:00Z'),
    ('sk3', 'user_monika', 'Aurora', '2026-04-14T08:00:00Z', '2026-04-18T19:00:00Z', 'open', NULL, NULL, NULL, '2026-04-09T10:00:00Z'),
    ('sk4', 'user_piotr', 'Alfa', '2026-04-20T06:00:00Z', '2026-04-27T22:00:00Z', 'open', NULL, NULL, NULL, '2026-04-09T11:30:00Z')
    ON CONFLICT (id) DO NOTHING
  `);

  console.log('Demo data seeded');
}
