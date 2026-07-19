import { create } from "zustand";
import {
  getNotifications,
  markRead as apiMarkRead,
  markAllRead as apiMarkAllRead,
} from "@/lib/api/notifications";
import type { AppNotification } from "@/types/models";
import { isNotifTypeEnabled } from "@/lib/notifPrefs";

interface NotificationState {
  notifications: AppNotification[];
  unreadCount: number;
  isOpen: boolean;
  isLoading: boolean;
  error: string | null;
  fetch: () => Promise<void>;
  refreshUnread: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  open: () => void;
  close: () => void;
  toggle: () => void;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  isOpen: false,
  isLoading: false,
  error: null,

  fetch: async () => {
    set({ isLoading: true, error: null });
    try {
      const all = await getNotifications();
      const notifications = all.filter((n) => isNotifTypeEnabled(n.type));
      const unreadCount = notifications.filter((n) => !n.is_read).length;
      set({ notifications, unreadCount });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to load notifications" });
    } finally {
      set({ isLoading: false });
    }
  },

  refreshUnread: async () => {
    try {
      const all = await getNotifications();
      const unreadCount = all.filter(
        (n) => !n.is_read && isNotifTypeEnabled(n.type),
      ).length;
      set({ unreadCount });
    } catch {
      // ignore
    }
  },

  markRead: async (id) => {
    set((s) => ({
      notifications: s.notifications.map((n) =>
        n.id === id ? { ...n, is_read: true } : n,
      ),
      unreadCount: Math.max(0, s.unreadCount - 1),
    }));
    try {
      await apiMarkRead(id);
    } catch {
      // ignore
    }
  },

  markAllRead: async () => {
    set((s) => ({
      notifications: s.notifications.map((n) => ({ ...n, is_read: true })),
      unreadCount: 0,
    }));
    try {
      await apiMarkAllRead();
    } catch {
      // ignore
    }
  },

  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
  toggle: () => set((s) => ({ isOpen: !s.isOpen })),
}));
