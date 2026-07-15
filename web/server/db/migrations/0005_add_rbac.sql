-- Internal user registry (Clerk userId → our user)
CREATE TABLE users (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_id    TEXT NOT NULL UNIQUE,
  email       TEXT NOT NULL,
  name        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Roles (tech_admin role has tenant_id = NULL = global)
CREATE TABLE roles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID REFERENCES tenants(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  permissions JSONB NOT NULL DEFAULT '[]',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, name)
);

-- Membership: which user belongs to which tenant with which role
CREATE TABLE tenant_memberships (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id   UUID REFERENCES tenants(id) ON DELETE CASCADE,
  role_id     UUID NOT NULL REFERENCES roles(id),
  invited_by  UUID REFERENCES users(id),
  joined_at   TIMESTAMPTZ,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, tenant_id)
);

-- Invitation tokens (email → pending membership)
CREATE TABLE invitations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT NOT NULL,
  tenant_id     UUID REFERENCES tenants(id) ON DELETE CASCADE,
  role_id       UUID NOT NULL REFERENCES roles(id),
  token         TEXT NOT NULL UNIQUE,
  invited_by    UUID REFERENCES users(id),
  expires_at    TIMESTAMPTZ NOT NULL,
  accepted_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ON tenant_memberships (user_id);
CREATE INDEX ON tenant_memberships (tenant_id);
CREATE INDEX ON invitations (token);

-- Seed default global roles
INSERT INTO roles (tenant_id, name, permissions) VALUES
  (NULL, 'tech_admin',  '["*"]'),
  (NULL, 'city_admin',  '["conversations:*","departments:*","settings:*","knowledge_base:*","members:manage","crawl:trigger"]'),
  (NULL, 'supervisor',  '["conversations:*","departments:read"]'),
  (NULL, 'staff',       '["conversations:read","conversations:update"]'),
  (NULL, 'member',      '["conversations:read"]');
