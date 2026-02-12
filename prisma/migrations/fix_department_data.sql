-- Fix existing Department records before migration
-- This script adds required fields to existing Department rows

-- Update existing records with auto-generated code (DEPT-{UPPERCASE_NAME})
UPDATE "Department" 
SET code = CONCAT('DEPT-', UPPER(REPLACE(REPLACE(name, ' ', '-'), '.', '')))
WHERE code IS NULL OR code = '';
