-- Rename the legacy role slug (city_admin -> institution_admin) on existing databases.
UPDATE roles SET name = 'institution_admin' WHERE name = 'city_admin' AND tenant_id IS NULL;
--> statement-breakpoint
-- Seed the global roles when missing. The squashed baseline is schema-only, so a
-- fresh database has no role rows; this restores them. Idempotent via NOT EXISTS.
INSERT INTO roles (tenant_id, name, permissions)
SELECT NULL::uuid, v.name, v.permissions::jsonb
FROM (VALUES
  ('tech_admin',        '["*"]'),
  ('institution_admin', '["conversations:*","departments:*","settings:*","knowledge_base:*","members:manage"]'),
  ('supervisor',        '["conversations:*","departments:read"]'),
  ('staff',             '["conversations:read","conversations:update"]'),
  ('member',            '["conversations:read"]')
) AS v(name, permissions)
WHERE NOT EXISTS (
  SELECT 1 FROM roles r WHERE r.name = v.name AND r.tenant_id IS NULL
);
