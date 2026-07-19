import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { AuthProvider } from "@/components/providers/AuthProvider";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { CommandPalette } from "@/components/layout/CommandPalette";
import { AppShell } from "@/components/layout/AppShell";
import { AuthGuard } from "@/features/auth/AuthGuard";
import { LoginPage } from "@/features/auth/LoginPage";
import { RegisterPage } from "@/features/auth/RegisterPage";
import { FeedPage } from "@/features/feed/FeedPage";
import { ProfilePage } from "@/features/profile/ProfilePage";
import { FollowList } from "@/features/profile/FollowList";
import { FollowListWrapper } from "@/features/profile/FollowListWrapper";
import { PostPage } from "@/features/posts/PostPage";
import { CreateWizard } from "@/features/create/CreateWizard";
import { DraftsPage } from "@/features/create/DraftsPage";
import { SettingsPage } from "@/features/settings/SettingsPage";
import { ThemeSettings } from "@/features/settings/ThemeSettings";
import { PrivacySettings } from "@/features/settings/PrivacySettings";
import { NotificationSettings } from "@/features/settings/NotificationSettings";
import { ShortcutsPage } from "@/features/settings/ShortcutsPage";
import { AboutPage } from "@/features/settings/AboutPage";
import { AnalyticsPage } from "@/features/analytics/AnalyticsPage";
import { SearchPage } from "@/features/search/SearchPage";
import { NotificationsPage } from "@/features/notifications/NotificationsPage";
import { StoryTray } from "@/features/stories/StoryTray";
import { StoryViewer } from "@/features/stories/StoryViewer";
import { CreateStory } from "@/features/stories/CreateStory";
import { ReelPage } from "@/features/reels/ReelPage";
import { CreateReel } from "@/features/reels/CreateReel";
import { DirectPage } from "@/features/messages/DirectPage";
import { Toaster } from "sonner";
import { initTheme } from "@/stores/themeStore";
import { useGlobalShortcuts } from "@/hooks/useGlobalShortcuts";
import { startSyncHandler } from "@/lib/sync/handler";
import { UpdateNotifier } from "@/features/settings/UpdateNotifier";

initTheme();
void startSyncHandler();

function ShortcutsHost() {
  useGlobalShortcuts();
  return null;
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              <Route
                path="/"
                element={<Navigate to="/feed" replace />}
              />
              <Route path="/auth/login" element={<LoginPage />} />
              <Route path="/auth/register" element={<RegisterPage />} />

              <Route element={<AuthGuard />}>
                <Route element={<AppShell />}>
                  <Route path="/feed" element={<FeedPage />} />
                  <Route path="/search" element={<SearchPage />} />
                  <Route path="/create" element={<CreateWizard />} />
                  <Route path="/create/story" element={<CreateStory />} />
                  <Route path="/create/reel" element={<CreateReel />} />
                  <Route path="/reels" element={<ReelPage />} />
                  <Route path="/reels/:id" element={<ReelPage />} />
                  <Route path="/post/:id" element={<PostPage />} />
                  <Route path="/direct" element={<DirectPage />} />
                  <Route path="/direct/:chatId" element={<DirectPage />} />
                  <Route path="/notifications" element={<NotificationsPage />} />
                  <Route path="/drafts" element={<DraftsPage />} />
                  <Route path="/profile/:username" element={<ProfilePage />} />
                  <Route
                    path="/profile/:username/followers"
                    element={
                      <FollowListWrapper mode="followers" />
                    }
                  />
                  <Route
                    path="/profile/:username/following"
                    element={
                      <FollowListWrapper mode="following" />
                    }
                  />
                  <Route path="/analytics" element={<AnalyticsPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="/settings/privacy" element={<PrivacySettings />} />
                  <Route path="/settings/notifications" element={<NotificationSettings />} />
                  <Route path="/settings/theme" element={<ThemeSettings />} />
                  <Route path="/settings/shortcuts" element={<ShortcutsPage />} />
                  <Route path="/settings/about" element={<AboutPage />} />
                </Route>
              </Route>

              <Route path="*" element={<Navigate to="/feed" replace />} />
            </Routes>
            <StoryViewer />
            <CommandPalette />
            <ShortcutsHost />
            <UpdateNotifier />
            <Toaster richColors position="bottom-right" />
          </BrowserRouter>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
