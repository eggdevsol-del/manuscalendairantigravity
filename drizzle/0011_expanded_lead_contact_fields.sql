-- Migration: Add expanded contact fields to leads table
-- This adds first name, last name, birthdate, and body placement images

-- Add new columns to leads table
ALTER TABLE `leads` 
  ADD COLUMN `clientFirstName` VARCHAR(100) AFTER `clientName`,
  ADD COLUMN `clientLastName` VARCHAR(100) AFTER `clientFirstName`,
  ADD COLUMN `clientBirthdate` VARCHAR(20) AFTER `clientLastName`,
  ADD COLUMN `bodyPlacementImages` TEXT AFTER `referenceImages`;

-- Note: The existing clientName field is kept for backward compatibility
-- New submissions will populate firstName + lastName and also clientName (combined)
