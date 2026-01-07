/*
  # Disable RLS on All Tables
  
  ## Changes
  - Disable RLS on all tables to handle security at application level
  - Drop all existing RLS policies
  - Remove helper functions that were used for RLS
  
  ## Security Notes
  - Security will now be handled in application code
  - Using service role key to bypass RLS completely
  - This makes the application more portable and not dependent on Supabase-specific features
*/

-- Drop all RLS policies
DROP POLICY IF EXISTS "Users can view organization users" ON users;
DROP POLICY IF EXISTS "Admins can create users" ON users;
DROP POLICY IF EXISTS "Admins can update users" ON users;

DROP POLICY IF EXISTS "Users can view organization clients" ON clients;
DROP POLICY IF EXISTS "Users can create clients" ON clients;
DROP POLICY IF EXISTS "Users can update clients" ON clients;

DROP POLICY IF EXISTS "Users can view organization accounts" ON accounts_receivable;
DROP POLICY IF EXISTS "Users can create accounts" ON accounts_receivable;
DROP POLICY IF EXISTS "Users can update accounts" ON accounts_receivable;

DROP POLICY IF EXISTS "Users can view organization payments" ON payments;
DROP POLICY IF EXISTS "Users can create payments" ON payments;

DROP POLICY IF EXISTS "Users can view organization activities" ON collection_activities;
DROP POLICY IF EXISTS "Users can create activities" ON collection_activities;
DROP POLICY IF EXISTS "Users can update activities" ON collection_activities;

DROP POLICY IF EXISTS "Users can view organization alerts" ON alerts;
DROP POLICY IF EXISTS "Users can update alerts" ON alerts;

DROP POLICY IF EXISTS "Users can view organization routes" ON routes;
DROP POLICY IF EXISTS "Users can create routes" ON routes;
DROP POLICY IF EXISTS "Users can update routes" ON routes;
DROP POLICY IF EXISTS "Users can delete routes" ON routes;

DROP POLICY IF EXISTS "Users can view organizations" ON organizations;
DROP POLICY IF EXISTS "Admins can update organizations" ON organizations;

-- Drop helper functions
DROP FUNCTION IF EXISTS get_user_organization_id(uuid);
DROP FUNCTION IF EXISTS get_user_role(uuid);

-- Disable RLS on all tables
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE organizations DISABLE ROW LEVEL SECURITY;
ALTER TABLE clients DISABLE ROW LEVEL SECURITY;
ALTER TABLE accounts_receivable DISABLE ROW LEVEL SECURITY;
ALTER TABLE payments DISABLE ROW LEVEL SECURITY;
ALTER TABLE collection_activities DISABLE ROW LEVEL SECURITY;
ALTER TABLE alerts DISABLE ROW LEVEL SECURITY;
ALTER TABLE routes DISABLE ROW LEVEL SECURITY;
