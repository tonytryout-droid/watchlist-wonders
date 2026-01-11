-- Step 1: Drop the existing problematic SELECT policy on the base table
DROP POLICY IF EXISTS "Users can view their own meta connections without token" ON public.meta_connections;

-- Step 2: Create a new SELECT policy that ONLY allows access via the security definer function
-- This prevents any direct SELECT access to the access_token column
CREATE POLICY "No direct SELECT - use safe view or function"
ON public.meta_connections
FOR SELECT
USING (false);  -- Deny all direct SELECT access

-- Step 3: Update the get_meta_access_token function to work correctly
-- It uses SECURITY DEFINER so it bypasses RLS
CREATE OR REPLACE FUNCTION public.get_meta_access_token(connection_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  token TEXT;
  owner_id UUID;
BEGIN
  -- Verify the requesting user owns this connection
  SELECT user_id, access_token INTO owner_id, token
  FROM public.meta_connections
  WHERE id = connection_id;
  
  IF owner_id IS NULL THEN
    RETURN NULL;
  END IF;
  
  IF owner_id != auth.uid() THEN
    RAISE EXCEPTION 'Access denied: You do not own this connection';
  END IF;
  
  RETURN token;
END;
$$;

-- Step 4: Create a security definer function for the safe view
-- This bypasses RLS on the base table while enforcing user ownership
CREATE OR REPLACE FUNCTION public.get_user_meta_connections()
RETURNS TABLE (
  id UUID,
  user_id UUID,
  platform TEXT,
  meta_user_id TEXT,
  token_expires_at TIMESTAMPTZ,
  account_name TEXT,
  account_username TEXT,
  profile_picture_url TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    mc.id,
    mc.user_id,
    mc.platform,
    mc.meta_user_id,
    mc.token_expires_at,
    mc.account_name,
    mc.account_username,
    mc.profile_picture_url,
    mc.created_at,
    mc.updated_at
  FROM public.meta_connections mc
  WHERE mc.user_id = auth.uid();
END;
$$;

-- Step 5: Drop the old view and recreate it using the function
DROP VIEW IF EXISTS public.meta_connections_safe;

-- Step 6: Revoke any direct grants on the base table for SELECT
REVOKE SELECT ON public.meta_connections FROM authenticated;
REVOKE SELECT ON public.meta_connections FROM anon;

-- Add comments documenting the security design
COMMENT ON FUNCTION public.get_user_meta_connections IS 'Securely retrieves the current user''s meta connections without exposing access tokens. Use this function instead of querying meta_connections directly.';

COMMENT ON FUNCTION public.get_meta_access_token IS 'Securely retrieves the access token for a specific meta connection. Only the connection owner can access their token.';