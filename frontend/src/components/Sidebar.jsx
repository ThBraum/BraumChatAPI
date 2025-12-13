// @ts-nocheck
import React, { useMemo, useState } from "react";

const menuItems = [
	{ icon: "🏠", label: "Home" },
	{ icon: "📨", label: "Mensagens" },
	{ icon: "🔔", label: "Notificações" },
	{ icon: "✨", label: "Automations" },
];

function initialsFrom(str = "") {
	return (
		str
			.split(" ")
			.filter(Boolean)
			.slice(0, 2)
			.map((word) => word[0]?.toUpperCase())
			.join("") || "US"
	);
}

export default function Sidebar({
	user,
	workspaces,
	selectedWorkspace,
	channels,
	dmThreads,
	activeConversation,
	onSelectWorkspace,
	onOpenChannel,
	onOpenDm,
	onCreateWorkspace,
	onCreateDm,
	loading,
}) {
	const [showWorkspaceForm, setShowWorkspaceForm] = useState(false);
	const [workspaceForm, setWorkspaceForm] = useState({ name: "", slug: "" });
	const [dmTarget, setDmTarget] = useState("");

	const activeWorkspaceName = useMemo(() => {
		return workspaces.find((w) => w.id === selectedWorkspace)?.name || "Selecione um workspace";
	}, [workspaces, selectedWorkspace]);

	const handleWorkspaceSubmit = async (e) => {
		e.preventDefault();
		if (!workspaceForm.name || !workspaceForm.slug) return;
		await onCreateWorkspace(workspaceForm);
		setWorkspaceForm({ name: "", slug: "" });
		setShowWorkspaceForm(false);
	};

	const handleCreateDm = async (e) => {
		e.preventDefault();
		if (!dmTarget) return;
		await onCreateDm(Number(dmTarget));
		setDmTarget("");
	};

	return (
		<aside className="sidebar-panel">
			<div className="brand">
				<div className="avatar">
					{user?.avatar_url ? (
						<img src={user.avatar_url} alt={user.display_name || user.email} />
					) : (
						<span>{initialsFrom(user?.display_name || user?.email)}</span>
					)}
				</div>
				<div>
					<p className="muted">Workspace atual</p>
					<strong>{activeWorkspaceName}</strong>
				</div>
			</div>

			<nav className="primary-nav">
				{menuItems.map((item) => (
					<button key={item.label} type="button" className="ghost">
						<span>{item.icon}</span>
						{item.label}
					</button>
				))}
			</nav>

			<section className="sidebar-section">
				<header>
					<span>Workspaces</span>
					<button type="button" className="ghost" onClick={() => setShowWorkspaceForm((s) => !s)}>
						{showWorkspaceForm ? "Fechar" : "Novo"}
					</button>
				</header>
				<ul>
					{workspaces.map((ws) => (
						<li
							key={ws.id}
							className={ws.id === selectedWorkspace ? "active" : ""}
							onClick={() => onSelectWorkspace(ws.id)}
						>
							<span>#</span>
							{ws.name}
						</li>
					))}
				</ul>
				{showWorkspaceForm && (
					<form onSubmit={handleWorkspaceSubmit} className="tiny-form">
						<input
							type="text"
							placeholder="Nome"
							value={workspaceForm.name}
							onChange={(e) => setWorkspaceForm((prev) => ({ ...prev, name: e.target.value }))}
						/>
						<input
							type="text"
							placeholder="Slug"
							value={workspaceForm.slug}
							onChange={(e) => setWorkspaceForm((prev) => ({ ...prev, slug: e.target.value }))}
						/>
						<button type="submit" className="primary">
							Criar workspace
						</button>
					</form>
				)}
			</section>

			<section className="sidebar-section">
				<header>
					<span>Channels</span>
					<span className="badge">{channels.length}</span>
				</header>
				<ul>
					{channels.map((ch) => (
						<li
							key={ch.id}
							className={
								activeConversation?.type === "channel" && activeConversation?.id === ch.id
									? "active"
									: ""
							}
							onClick={() => onOpenChannel(ch)}
						>
							<span>#</span>
							{ch.name}
						</li>
					))}
				</ul>
			</section>

			<section className="sidebar-section">
				<header>
					<span>Direct Messages</span>
					<span className="badge">{dmThreads.length}</span>
				</header>
				<ul>
					{dmThreads.map((thread) => (
						<li
							key={thread.id}
							className={
								activeConversation?.type === "dm" && activeConversation?.id === thread.id
									? "active"
									: ""
							}
							onClick={() => onOpenDm(thread)}
						>
							<span>💬</span>
							DM #{thread.id}
						</li>
					))}
				</ul>
				<form onSubmit={handleCreateDm} className="tiny-form">
					<input
						type="number"
						placeholder="ID do usuário"
						value={dmTarget}
						onChange={(e) => setDmTarget(e.target.value)}
					/>
					<button type="submit">Abrir DM</button>
				</form>
			</section>

			<section className="sidebar-section">
				<header>
					<span>Mensagens</span>
					<span className="muted">Atalhos</span>
				</header>
				<ul>
					<li>⭐ Favoritas</li>
					<li>📌 Pins</li>
					<li>🧠 IA Insights</li>
				</ul>
			</section>

			{loading && <div className="sidebar-loading">Carregando...</div>}
		</aside>
	);
}
