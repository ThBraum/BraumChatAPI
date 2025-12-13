// @ts-nocheck
const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

async function req(path, opts = {}, token) {
	const headers = opts.headers || {};
	if (token) headers["Authorization"] = `Bearer ${token}`;
	const res = await fetch(API_BASE + path, { ...opts, headers });
	if (!res.ok) {
		const text = await res.text();
		throw new Error(text || res.status);
	}
	if (res.status === 204) return null;
	return res.json();
}

export const register = (payload) =>
	req("/auth/register", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(payload),
	});
export const login = (form) => {
	// backend expects form-encoded for OAuth2PasswordRequestForm
	const body = new URLSearchParams();
	body.append("username", form.email);
	body.append("password", form.password);
	return fetch(API_BASE + "/auth/login", { method: "POST", body }).then(async (r) => {
		if (!r.ok) throw new Error(await r.text());
		return r.json();
	});
};

export const getMe = (token) => req("/auth/me", {}, token);
export const listSessions = (token) => req("/auth/sessions", {}, token);
export const revokeSession = (sessionId, token) =>
	req(`/auth/sessions/${sessionId}`, { method: "DELETE" }, token);

export const listWorkspaces = (token) => req("/workspaces/", {}, token);
export const createWorkspace = (payload, token) =>
	req(
		"/workspaces/",
		{
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(payload),
		},
		token
	);

export const listChannels = (workspaceId, token) =>
	req(`/channels/workspaces/${workspaceId}/channels`, {}, token);
export const getChannelMessages = (channelId, token) =>
	req(`/channels/${channelId}/messages`, {}, token);
export const postChannelMessage = (channelId, content, token) =>
	req(
		`/channels/${channelId}/messages`,
		{
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ content }),
		},
		token
	);
export const getChannelPresence = (channelId, token) =>
	req(`/channels/${channelId}/presence`, {}, token);

export const listDMThreads = (workspaceId, token) =>
	req(`/dm/threads${workspaceId ? "?workspace_id=" + workspaceId : ""}`, {}, token);
export const createOrGetThread = (workspaceId, userId, token) =>
	req(
		"/dm/threads",
		{
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ workspace_id: workspaceId, user_id: userId }),
		},
		token
	);
export const getThreadMessages = (threadId, token) =>
	req(`/dm/threads/${threadId}/messages`, {}, token);
export const postThreadMessage = (threadId, content, token) =>
	req(
		`/dm/threads/${threadId}/messages`,
		{
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ content }),
		},
		token
	);

export default {
	register,
	login,
	getMe,
	listSessions,
	revokeSession,
	listWorkspaces,
	createWorkspace,
	listChannels,
	getChannelMessages,
	postChannelMessage,
	getChannelPresence,
	listDMThreads,
	createOrGetThread,
	getThreadMessages,
	postThreadMessage,
};
