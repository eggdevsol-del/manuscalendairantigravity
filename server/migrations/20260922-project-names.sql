-- Apply before deploying canonical project naming. No data is deleted.
ALTER TABLE sessionPlans
  ADD COLUMN projectName VARCHAR(60) NULL,
  ADD COLUMN projectNameAttempts INT NOT NULL DEFAULT 0,
  ADD COLUMN projectNameRetryAt DATETIME NULL;
