-- SQL to create accounts for your friends
-- Note: You cannot directly insert into auth.users table
-- You have two options:

-- OPTION 1: Create accounts via Supabase Dashboard
-- Go to Authentication > Users > Add User
-- Create each account with these details:

/*
Email: wassim@worldcup.local | Password: worldcup2026 | Username: Wassim
Email: hamdi@worldcup.local | Password: worldcup2026 | Username: Hamdi  
Email: dhia@worldcup.local | Password: worldcup2026 | Username: Dhia
Email: mouadh@worldcup.local | Password: worldcup2026 | Username: Mouadh
Email: semah@worldcup.local | Password: worldcup2026 | Username: Semah
Email: marwen@worldcup.local | Password: worldcup2026 | Username: Marwen
Email: anas@worldcup.local | Password: worldcup2026 | Username: Anas
Email: amine@worldcup.local | Password: worldcup2026 | Username: Amine
Email: kabil@worldcup.local | Password: worldcup2026 | Username: Kabil
*/

-- OPTION 2: Use Supabase Auth Admin API (Run in SQL Editor with proper permissions)
-- After creating users via dashboard, run this to create their profiles:

-- First, let's create a function to help with account creation
CREATE OR REPLACE FUNCTION create_user_and_profile(
  user_email TEXT,
  user_password TEXT,
  user_name TEXT
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_user_id UUID;
BEGIN
  -- Create auth user (this requires admin privileges)
  -- Note: This might not work depending on your Supabase setup
  -- You may need to create users via the dashboard instead
  
  INSERT INTO profiles (id, username, total_points)
  VALUES (
    gen_random_uuid(),
    user_name,
    0
  )
  RETURNING id INTO new_user_id;
  
  RETURN new_user_id;
END;
$$;

-- OPTION 3: Easiest approach - Share these credentials with friends
-- Tell them to use these emails/passwords to sign in:

-- Wassim: wassim@worldcup.local / worldcup2026
-- Hamdi: hamdi@worldcup.local / worldcup2026
-- Dhia: dhia@worldcup.local / worldcup2026
-- Mouadh: mouadh@worldcup.local / worldcup2026
-- Semah: semah@worldcup.local / worldcup2026
-- Marwen: marwen@worldcup.local / worldcup2026
-- Anas: anas@worldcup.local / worldcup2026
-- Amine: amine@worldcup.local / worldcup2026
-- Kabil: kabil@worldcup.local / worldcup2026


-- You need to create these users manually in Supabase Dashboard:
-- 1. Go to Authentication > Users
-- 2. Click "Add User"
-- 3. Enter email and password
-- 4. After creation, the profile will be auto-created via your app's signup flow
