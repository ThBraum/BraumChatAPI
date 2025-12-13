// @ts-nocheck
import React from "react";

const formatDate = (value) => {
	if (!value) return "-";
	try {
		return new Intl.DateTimeFormat("pt-BR", {
			dateStyle: "short",
			timeStyle: "short",
		}).format(new Date(value));
	} catch (err) {
		return value;
	}
};

const initialsFrom = (label = "") => {
	return (
		label
			.split(" ")
			.filter(Boolean)
			.slice(0, 2)
			.map((word) => word[0]?.toUpperCase())
			.join("") || "US"
	);
};

export default function UserPanel({
	user,
	sessions,
	workspaces,
	channels,
	dmThreads,
	onLogout,
	onThemeToggle,
	theme,
	onRevokeSession,
}) {
	return (
		<aside className="user-panel">
			<div className="user-card">
				<div className="avatar xl">
					{user?.avatar_url ? (
						<img src={user.avatar_url} alt={user.display_name || user.email} />
					) : (
						<span>{initialsFrom(user?.display_name || user?.email)}</span>
					)}
				</div>
				<div>
					<h3>{user?.display_name || user?.email}</h3>
					<p className="muted">{user?.email}</p>
				</div>
				<div className="user-actions">
					<button className="ghost" onClick={onThemeToggle}>
						Tema: {theme === "dark" ? "Dark" : "Light"}
					</button>
					<button className="ghost" onClick={onLogout}>
						Sair
					</button>
				</div>
			</div>

			<div className="stats-grid">
				<div>
					<p className="muted">Workspaces</p>
					<strong>{workspaces.length}</strong>
				</div>
				<div>
					<p className="muted">Channels</p>
					<strong>{channels.length}</strong>
				</div>
				<div>
					<p className="muted">DMs</p>
					<strong>{dmThreads.length}</strong>
				</div>
			</div>

			<section className="sessions">
				<header>
					<div>
						<strong>Sessões ativas</strong>
						<p className="muted">Gerencie logins e finalize dispositivos.</p>
					</div>
				</header>
				<div className="sessions-list">
					{sessions.length === 0 && <p className="muted">Nenhuma sessão ativa.</p>}
					{sessions.map((session) => (
						<div key={session.session_id} className="session-row">
							<div>
								<strong>{session.user_agent || "Navegador"}</strong>
								<p className="muted">
									Último acesso: {formatDate(session.last_seen_at || session.created_at)}
								</p>
							</div>
							<button onClick={() => onRevokeSession(session.session_id)}>Encerrar</button>
						</div>
					))}
				</div>
			</section>

			<div className="panel-callout">
				<h4>Status</h4>
				<p>
					Você está conectado como {user?.display_name || user?.email}. Mantenha o app aberto para
					mostrar presença on-line.
				</p>
			</div>
		</aside>
	);
}
