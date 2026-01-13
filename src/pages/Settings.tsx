import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { TopNav } from "@/components/layout/TopNav";
import { SearchOverlay } from "@/components/search/SearchOverlay";
import { useAuth } from "@/contexts/AuthContext";
import { useAvatar } from "@/hooks/useAvatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { User, Mail, LogOut, Shield, Bell, Camera, Trash2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { bookmarkService } from "@/services/bookmarks";

const Settings = () => {
  const { user, signOut } = useAuth();
  const { avatarUrl, uploading, uploadAvatar, deleteAvatar } = useAvatar();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: bookmarks = [] } = useQuery({
    queryKey: ['bookmarks'],
    queryFn: () => bookmarkService.getBookmarks(),
  });

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid file type",
        description: "Please upload an image file.",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please upload an image under 5MB.",
        variant: "destructive",
      });
      return;
    }

    const result = await uploadAvatar(file);
    if (result) {
      toast({
        title: "Avatar updated",
        description: "Your profile picture has been updated.",
      });
    } else {
      toast({
        title: "Upload failed",
        description: "Failed to upload avatar. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteAvatar = async () => {
    const success = await deleteAvatar();
    if (success) {
      toast({
        title: "Avatar removed",
        description: "Your profile picture has been removed.",
      });
    } else {
      toast({
        title: "Delete failed",
        description: "Failed to remove avatar. Please try again.",
        variant: "destructive",
      });
    }
  };
  const handleSignOut = async () => {
    setIsLoading(true);
    try {
      await signOut();
      toast({
        title: "Signed out",
        description: "You have been successfully signed out.",
      });
      navigate("/auth");
    } catch (error) {
      toast({
        title: "Error signing out",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <TopNav onSearchClick={() => setSearchOpen(true)} />
      
      <div className="pt-20 pb-16">
        <div className="container mx-auto px-4 lg:px-8 max-w-2xl">
          <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="space-y-2">
              <h1 className="text-3xl font-bold text-foreground">Settings</h1>
              <p className="text-muted-foreground">Manage your account and preferences</p>
            </div>

            {/* Profile Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="w-5 h-5" />
                  Profile
                </CardTitle>
                <CardDescription>Your account information</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Avatar Upload */}
                <div className="flex items-center gap-4">
                  <div className="relative group">
                    <Avatar className="h-20 w-20">
                      <AvatarImage src={avatarUrl || undefined} alt="Profile" />
                      <AvatarFallback className="bg-primary/10 text-primary text-2xl">
                        {user?.email?.charAt(0).toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="absolute inset-0 flex items-center justify-center bg-background/80 opacity-0 group-hover:opacity-100 transition-opacity rounded-full"
                    >
                      <Camera className="w-6 h-6 text-foreground" />
                    </button>
                  </div>
                  <div className="flex flex-col gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarUpload}
                      className="hidden"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                    >
                      {uploading ? "Uploading..." : "Change avatar"}
                    </Button>
                    {avatarUrl && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleDeleteAvatar}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4 mr-1" />
                        Remove
                      </Button>
                    )}
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    <Input 
                      id="email" 
                      value={user?.email || ""} 
                      disabled 
                      className="bg-muted"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>User ID</Label>
                  <Input 
                    value={user?.id || ""} 
                    disabled 
                    className="bg-muted font-mono text-xs"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Member since</Label>
                  <Input 
                    value={user?.created_at ? new Date(user.created_at).toLocaleDateString() : ""} 
                    disabled 
                    className="bg-muted"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Preferences Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="w-5 h-5" />
                  Preferences
                </CardTitle>
                <CardDescription>Customize your experience</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Email notifications</Label>
                    <p className="text-sm text-muted-foreground">
                      Receive reminders for scheduled content
                    </p>
                  </div>
                  <Switch disabled />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Push notifications</Label>
                    <p className="text-sm text-muted-foreground">
                      Get notified when it's time to watch
                    </p>
                  </div>
                  <Switch disabled />
                </div>
              </CardContent>
            </Card>

            {/* Security Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5" />
                  Security
                </CardTitle>
                <CardDescription>Manage your account security</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button variant="outline" disabled className="w-full justify-start">
                  Change password
                </Button>
                <p className="text-xs text-muted-foreground">
                  Password changes are handled via email. Contact support if you need to reset your password.
                </p>
              </CardContent>
            </Card>

            {/* Danger Zone */}
            <Card className="border-destructive/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-destructive">
                  <LogOut className="w-5 h-5" />
                  Sign Out
                </CardTitle>
                <CardDescription>
                  Sign out of your account on this device
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button 
                  variant="destructive" 
                  onClick={handleSignOut}
                  disabled={isLoading}
                  className="w-full"
                >
                  {isLoading ? "Signing out..." : "Sign out"}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
      
      <SearchOverlay
        isOpen={searchOpen}
        onClose={() => setSearchOpen(false)}
        bookmarks={bookmarks}
      />
    </div>
  );
};

export default Settings;
