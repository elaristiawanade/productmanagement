-- Product Tracker - Seed Data
-- Admin password: 1234

-- ─── ROLES ──────────────────────────────────────────────────────────────────

INSERT INTO roles (name, display_name, permissions) VALUES
('super_admin', 'Super Admin',  '{"all": true}'),
('manager',     'Manager',      '{"read_all": true, "manage_users": true, "view_reports": true}'),
('po',          'Product Owner','{"manage_backlog": true, "manage_sprints": true, "manage_features": true}'),
('developer',   'Developer',    '{"view_all": true, "update_assigned": true}'),
('qa',          'QA Engineer',  '{"view_all": true, "manage_qa": true, "report_bugs": true}');

-- ─── ADMIN USER ─────────────────────────────────────────────────────────────
-- password: 1234

INSERT INTO users (name, email, password_hash, role_id, avatar_color)
VALUES ('Admin', 'admin@admin.com', '$2a$10$GPxEqwfOQeP.5yxu0gqVyufQy23s4ti/DNiRx9rIUaPdVe6y/k66K', 1, '#4F46E5');
