-- Add location text field to tenants for display and geocoding
ALTER TABLE "tenants" ADD COLUMN "location" varchar(255);
