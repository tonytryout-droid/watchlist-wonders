import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export function useAvatar() {
  const { user } = useAuth();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (user) {
      fetchAvatar();
    } else {
      setAvatarUrl(null);
    }
  }, [user]);

  const fetchAvatar = async () => {
    if (!user) return;

    try {
      const { data } = await supabase.storage
        .from('avatars')
        .list(user.id, { limit: 1, sortBy: { column: 'created_at', order: 'desc' } });

      if (data && data.length > 0) {
        const { data: urlData } = supabase.storage
          .from('avatars')
          .getPublicUrl(`${user.id}/${data[0].name}`);
        
        setAvatarUrl(urlData.publicUrl);
      }
    } catch (error) {
      console.error('Error fetching avatar:', error);
    }
  };

  const uploadAvatar = async (file: File): Promise<string | null> => {
    if (!user) return null;

    setUploading(true);
    try {
      // Delete existing avatars first
      const { data: existingFiles } = await supabase.storage
        .from('avatars')
        .list(user.id);

      if (existingFiles && existingFiles.length > 0) {
        await supabase.storage
          .from('avatars')
          .remove(existingFiles.map(f => `${user.id}/${f.name}`));
      }

      // Upload new avatar
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      setAvatarUrl(urlData.publicUrl);
      return urlData.publicUrl;
    } catch (error) {
      console.error('Error uploading avatar:', error);
      return null;
    } finally {
      setUploading(false);
    }
  };

  const deleteAvatar = async (): Promise<boolean> => {
    if (!user) return false;

    try {
      const { data: existingFiles } = await supabase.storage
        .from('avatars')
        .list(user.id);

      if (existingFiles && existingFiles.length > 0) {
        await supabase.storage
          .from('avatars')
          .remove(existingFiles.map(f => `${user.id}/${f.name}`));
      }

      setAvatarUrl(null);
      return true;
    } catch (error) {
      console.error('Error deleting avatar:', error);
      return false;
    }
  };

  return {
    avatarUrl,
    uploading,
    uploadAvatar,
    deleteAvatar,
    refreshAvatar: fetchAvatar,
  };
}
