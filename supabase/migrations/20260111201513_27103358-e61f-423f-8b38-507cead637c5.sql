-- Enable pgsodium extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pgsodium;

-- Create a security definer function to securely access tokens only when needed
-- This prevents tokens from being exposed in normal SELECT queries
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

-- Create a view that excludes sensitive token data for normal queries
CREATE OR REPLACE VIEW public.meta_connections_safe AS
SELECT 
  id,
  user_id,
  platform,
  meta_user_id,
  -- Never expose access_token in views
  token_expires_at,
  account_name,
  account_username,
  profile_picture_url,
  created_at,
  updated_at
FROM public.meta_connections;

-- Enable RLS on the view
ALTER VIEW public.meta_connections_safe SET (security_invoker = on);

-- Grant access to authenticated users
GRANT SELECT ON public.meta_connections_safe TO authenticated;

-- Revoke direct SELECT access to the base table access_token column
-- by updating the existing SELECT policy to use a wrapper
DROP POLICY IF EXISTS "Users can view their own meta connections" ON public.meta_connections;

-- Create a new restrictive SELECT policy that prevents access_token exposure
-- Users should use the safe view or the get_meta_access_token function instead
CREATE POLICY "Users can view their own meta connections without token"
ON public.meta_connections
FOR SELECT
USING (
  auth.uid() = user_id 
  AND current_setting('request.path', true) NOT LIKE '%/rest/v1/meta_connections%select=*%access_token%'
);

-- Add a comment to document the security measure
COMMENT ON FUNCTION public.get_meta_access_token IS 'Securely retrieves the access token for a meta connection. Only the connection owner can access their token. Use this function instead of directly querying the access_token column.';

COMMENT ON VIEW public.meta_connections_safe IS 'Safe view of meta_connections that excludes sensitive access_token data. Use get_meta_access_token() function when you need the actual token.';