import { useState, useEffect } from 'react';
import { ref, uploadBytes, getDownloadURL, listAll, deleteObject } from 'firebase/storage';
import { storage } from '@/lib/firebase';
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
      const avatarRef = ref(storage, `avatars/${user.uid}`);
      const list = await listAll(avatarRef);
      if (list.items.length > 0) {
        const url = await getDownloadURL(list.items[list.items.length - 1]);
        setAvatarUrl(url);
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
      const avatarRef = ref(storage, `avatars/${user.uid}`);
      const list = await listAll(avatarRef);
      await Promise.all(list.items.map((item) => deleteObject(item)));

      // Upload new avatar
      const fileExt = file.name.split('.').pop();
      const filePath = `avatars/${user.uid}/${Date.now()}.${fileExt}`;
      const fileRef = ref(storage, filePath);
      await uploadBytes(fileRef, file);
      const url = await getDownloadURL(fileRef);
      setAvatarUrl(url);
      return url;
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
      const avatarRef = ref(storage, `avatars/${user.uid}`);
      const list = await listAll(avatarRef);
      await Promise.all(list.items.map((item) => deleteObject(item)));
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
