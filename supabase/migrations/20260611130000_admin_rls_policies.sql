-- Allow the admin user to update any match row (e.g., home_score, away_score, is_completed)
CREATE POLICY "Admin can update any match"
  ON matches
  FOR UPDATE
  TO authenticated
  USING ((auth.jwt() ->> 'email') = 'mouadh@worldcup.local')
  WITH CHECK ((auth.jwt() ->> 'email') = 'mouadh@worldcup.local');

-- Allow the admin user to update any profile row (e.g., total_points)
CREATE POLICY "Admin can update any profile"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING ((auth.jwt() ->> 'email') = 'mouadh@worldcup.local')
  WITH CHECK ((auth.jwt() ->> 'email') = 'mouadh@worldcup.local');

-- Allow the admin user to update any prediction row (e.g., points_earned)
CREATE POLICY "Admin can update any prediction"
  ON predictions
  FOR UPDATE
  TO authenticated
  USING ((auth.jwt() ->> 'email') = 'mouadh@worldcup.local')
  WITH CHECK ((auth.jwt() ->> 'email') = 'mouadh@worldcup.local');
