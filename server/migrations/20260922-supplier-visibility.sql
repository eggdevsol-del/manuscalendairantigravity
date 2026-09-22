-- Apply before deploying the private developer dashboard release.
-- Additive; all existing suppliers remain visible. No orders or products are removed.
ALTER TABLE suppliers ADD COLUMN isActive TINYINT NOT NULL DEFAULT 1;
