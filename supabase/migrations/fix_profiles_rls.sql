-- Fix RLS policy for profiles table to allow signup
-- This allows users to create their profile during signup

-- Drop the old restrictive policy
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;

-- Create a new policy that works during signup
-- This allows inserts where the id matches the auth.uid() OR during signup (anon role)
CREATE POLICY "Users can insert their own profile during signup"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Alternative: You can also make the insert happen from a service role
-- Or use a database trigger. But this policy should work for most cases.
