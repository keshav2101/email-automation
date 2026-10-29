import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface User {
  id: number;
  email: string;
  full_name: string;
  user_type?: string;
  gmail_connected: boolean;
  draft_only_mode: boolean;
  send_enabled: boolean;
  email_connected?: boolean;
  email_plugin_type?: string | null;
  smtp_host?: string | null;
  smtp_port?: number | null;
  smtp_user?: string | null;
  smtp_from_name?: string | null;
}

const defaultUser: User = {
  id: 1,
  email: 'client@outreach.local',
  full_name: 'Client User',
  user_type: 'client',
  gmail_connected: false,
  draft_only_mode: false,
  send_enabled: true,
  email_connected: false,
  email_plugin_type: null,
};

interface AuthState {
  token: string | null;
  user: User;
  setAuth: (token: string, user: User) => void;
  updateUser: (user: Partial<User>) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: 'guest-session',
      user: defaultUser,
      setAuth: (token, user) => set({ token, user }),
      updateUser: (updates) =>
        set((state) => ({
          user: { ...state.user, ...updates },
        })),
      logout: () => set({ token: 'guest-session', user: defaultUser }),
    }),
    {
      name: 'hr-auth',
    }
  )
);
