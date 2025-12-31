export const queryKeys = {
	profile: ["profile"],
	workspaces: ["workspaces"],
	channels: (workspaceId?: string | null) => ["channels", workspaceId],
	threads: ["threads"],
	channelMessages: (channelId?: string | null) => ["channels", channelId, "messages"],
	threadMessages: (threadId?: string | null) => ["threads", threadId, "messages"],
	presence: (channelId?: string | null) => ["channels", channelId, "presence"],
	sessions: ["sessions"],
};
