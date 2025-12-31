export interface User {
  id: string;
  email: string;
  display_name: string;
  avatar_url?: string | null;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
}

export interface Workspace {
  id: string;
  name: string;
  slug?: string;
  created_at?: string;
}

export interface Channel {
  id: string;
  name: string;
  is_private: boolean;
  topic?: string;
  workspace_id: string;
}

export interface Thread {
  id: string;
  workspace_id: string;
  participants: User[];
  last_message?: Message;
}

export interface Message {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  author: Pick<User, "id" | "display_name" | "avatar_url">;
  channel_id?: string;
  thread_id?: string;
}

export interface PresenceUser {
  user_id: string;
  display_name?: string;
}

export interface Session {
  id: string;
  created_at: string;
  last_active_at: string;
  user_agent: string;
  ip_address?: string;
  is_current: boolean;
}

export type MessagePayload =
  | { type: "message"; payload: Message }
  | { type: "typing"; payload: { user_id: string; is_typing: boolean } };
