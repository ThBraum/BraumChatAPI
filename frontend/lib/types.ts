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
	participants: Array<Pick<User, "id" | "display_name" | "avatar_url">>;
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

export interface WorkspaceInvite {
	id: string;
	workspace_id: string;
	workspace_name: string;
	status: "pending" | "accepted" | "declined";
	inviter: Pick<User, "id" | "display_name" | "avatar_url">;
	invitee: Pick<User, "id" | "display_name" | "avatar_url">;
	created_at?: string | null;
}

export interface FriendRequest {
	id: string;
	status: "pending" | "accepted" | "declined";
	requester: Pick<User, "id" | "display_name" | "avatar_url">;
	addressee: Pick<User, "id" | "display_name" | "avatar_url">;
	created_at?: string | null;
	updated_at?: string | null;
}

export type MessagePayload =
	| { type: "message"; payload: Message }
	| { type: "typing"; payload: { user_id: string; is_typing: boolean } };

export type WsOutgoingPayload = { type: "typing"; is_typing: boolean };
