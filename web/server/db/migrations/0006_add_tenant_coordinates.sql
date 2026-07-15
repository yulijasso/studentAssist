-- Add latitude/longitude columns to tenants for map view
ALTER TABLE "tenants" ADD COLUMN "latitude" double precision;
ALTER TABLE "tenants" ADD COLUMN "longitude" double precision;
