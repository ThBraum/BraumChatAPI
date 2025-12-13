// @ts-nocheck
import React, { useCallback, useEffect, useMemo, useState } from "react";
import Login from "./components/Login";
import Sidebar from "./components/Sidebar";
import ChatWindow from "./components/ChatWindow";
import UserPanel from "./components/UserPanel";
import {
	getMe,
	listSessions,
	listWorkspaces,
	listChannels,
	listDMThreads,
	createWorkspace,
	createOrGetThread,
	revokeSession,
} from "./api";

export default function App() {
	const [token, setToken] = useState(localStorage.getItem("token"));
	const [user, setUser] = useState(null);
	const [sessions, setSessions] = useState([]);
	const [workspaces, setWorkspaces] = useState([]);
	const [selectedWorkspace, setSelectedWorkspace] = useState(null);
	const [channels, setChannels] = useState([]);
	const [dmThreads, setDmThreads] = useState([]);
	const [activeConversation, setActiveConversation] = useState(null);
	const [theme, setTheme] = useState(localStorage.getItem("theme") || "dark");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState(null);

	useEffect(() => {
		document.documentElement.setAttribute("data-theme", theme);
		localStorage.setItem("theme", theme);
	}, [theme]);

	const handleLogout = useCallback(() => {
		localStorage.removeItem("token");
		setToken(null);
		setUser(null);
		setSessions([]);
		setWorkspaces([]);
		setChannels([]);
		setDmThreads([]);
		setSelectedWorkspace(null);
		setActiveConversation(null);
	}, []);

	const hydrateUserContext = useCallback(async () => {
		if (!token) return;
		setLoading(true);
		try {
			const [me, userSessions, ws] = await Promise.all([
				getMe(token),
				listSessions(token),
				listWorkspaces(token),
			]);
			setUser(me);
			setSessions(userSessions);
			setWorkspaces(ws);
			if (!selectedWorkspace && ws.length) {
				setSelectedWorkspace(ws[0].id);
			}
			setError(null);
		} catch (err) {
			console.error(err);
			setError("Falha ao carregar informações do usuário");
			handleLogout();
		} finally {
			setLoading(false);
		}
	}, [token, selectedWorkspace, handleLogout]);

	useEffect(() => {
		if (!token) return;
		hydrateUserContext();
	}, [token, hydrateUserContext]);

	const loadWorkspaceData = useCallback(async () => {
		if (!token || !selectedWorkspace) return;
		setLoading(true);
		try {
			const [chs, dms] = await Promise.all([
				listChannels(selectedWorkspace, token),
				listDMThreads(selectedWorkspace, token),
			]);
			setChannels(chs);
			setDmThreads(dms);
			if (!activeConversation && chs.length) {
				setActiveConversation({
					type: "channel",
					id: chs[0].id,
					name: chs[0].name,
					workspaceId: selectedWorkspace,
				});
			}
		} catch (err) {
			console.error(err);
			setError("Não foi possível carregar o workspace selecionado");
		} finally {
			setLoading(false);
		}
	}, [token, selectedWorkspace, activeConversation]);

	useEffect(() => {
		loadWorkspaceData();
	}, [loadWorkspaceData]);

	const handleLogin = (accessToken) => {
		localStorage.setItem("token", accessToken);
		setToken(accessToken);
	};

	const handleCreateWorkspace = async (payload) => {
		if (!token) return;
		await createWorkspace(payload, token);
		await hydrateUserContext();
	};

	const handleOpenDm = async (targetUserId) => {
		if (!token || !selectedWorkspace) return;
		try {
			const thread = await createOrGetThread(selectedWorkspace, targetUserId, token);
			await loadWorkspaceData();
			setActiveConversation({
				type: "dm",
				id: thread.id,
				name: `DM #${thread.id}`,
				workspaceId: selectedWorkspace,
			});
		} catch (err) {
			console.error(err);
		}
	};

	const handleRevokeSession = async (sessionId) => {
		if (!token) return;
		await revokeSession(sessionId, token);
		const refreshed = await listSessions(token);
		setSessions(refreshed);
	};

	const workspaceName = useMemo(() => {
		return workspaces.find((w) => w.id === selectedWorkspace)?.name || "";
	}, [workspaces, selectedWorkspace]);

	if (!token || !user) {
		return (
			<div className="auth-shell">
				<div className="floating-shapes">
					<span className="shape circle" />
					<span className="shape triangle" />
					<span className="shape dotted" />
				</div>
				<Login
					onLogin={handleLogin}
					theme={theme}
					onThemeToggle={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
				/>
			</div>
		);
	}

	return (
		<div className="app-shell">
			<div className="floating-shapes">
				<span className="shape circle" />
				<span className="shape triangle" />
				<span className="shape dotted" />
				<span className="shape ring" />
				<span className="shape zigzag" />
			</div>
			<div className="layout-grid">
				<Sidebar
					user={user}
					workspaces={workspaces}
					selectedWorkspace={selectedWorkspace}
					channels={channels}
					dmThreads={dmThreads}
					activeConversation={activeConversation}
					onSelectWorkspace={(id) => {
						setSelectedWorkspace(id);
						setActiveConversation(null);
					}}
					onOpenChannel={(channel) =>
						setActiveConversation({
							type: "channel",
							id: channel.id,
							name: channel.name,
							workspaceId: selectedWorkspace,
						})
					}
					onOpenDm={(thread) =>
						setActiveConversation({
							type: "dm",
							id: thread.id,
							name: `DM #${thread.id}`,
							workspaceId: selectedWorkspace,
						})
					}
					onCreateWorkspace={handleCreateWorkspace}
					onCreateDm={handleOpenDm}
					loading={loading}
				/>
				<ChatWindow
					token={token}
					user={user}
					active={activeConversation}
					workspaceName={workspaceName}
				/>
				<UserPanel
					user={user}
					sessions={sessions}
					workspaces={workspaces}
					channels={channels}
					dmThreads={dmThreads}
					onLogout={handleLogout}
					onThemeToggle={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
					theme={theme}
					onRevokeSession={handleRevokeSession}
				/>
			</div>
			{error && <div className="global-error">{error}</div>}
		</div>
	);
}
