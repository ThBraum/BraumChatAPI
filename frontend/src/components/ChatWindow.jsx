// @ts-nocheck
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
	getChannelMessages,
	postChannelMessage,
	getThreadMessages,
	postThreadMessage,
	getChannelPresence,
} from "../api";

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

const stringToColor = (str = "") => {
	let hash = 0;
	for (let i = 0; i < str.length; i += 1) {
		hash = str.charCodeAt(i) + ((hash << 5) - hash);
	}
	const color = `hsl(${Math.abs(hash) % 360}, 70%, 45%)`;
	return color;
};

const formatTime = (value) => {
	if (!value) return "";
	try {
		return new Intl.DateTimeFormat("pt-BR", {
			weekday: "short",
			hour: "2-digit",
			minute: "2-digit",
		}).format(new Date(value));
	} catch (err) {
		return value;
	}
};

export default function ChatWindow({ token, user, active, workspaceName }) {
	const [messages, setMessages] = useState([]);
	const [input, setInput] = useState("");
	const [presence, setPresence] = useState([]);
	const [typingUsers, setTypingUsers] = useState([]);
	const [status, setStatus] = useState("Selecione um canal ou DM para começar");
	const wsRef = useRef(null);
	const typingTimeouts = useRef({});
	const typingThrottle = useRef(0);
	const listRef = useRef(null);

	const conversationLabel = useMemo(() => {
		if (!active) return "";
		return active.type === "channel" ? `# ${active.name}` : active.name;
	}, [active]);

	useEffect(() => {
		if (!active?.id) {
			setMessages([]);
			setPresence([]);
			setStatus("Selecione um canal ou DM para começar");
			return;
		}
		let cancelled = false;
		setStatus("Carregando histórico...");
		const fetchData = async () => {
			try {
				const data =
					active.type === "channel"
						? await getChannelMessages(active.id, token)
						: await getThreadMessages(active.id, token);
				if (!cancelled) {
					setMessages(data);
					setStatus(data.length ? "" : "Seja o primeiro a enviar uma mensagem");
				}
				if (active.type === "channel") {
					try {
						const presenceData = await getChannelPresence(active.id, token);
						if (!cancelled) {
							setPresence(presenceData?.online_user_ids || []);
						}
					} catch {
						setPresence([]);
					}
				} else {
					setPresence([]);
				}
			} catch (err) {
				setStatus("Erro ao carregar mensagens");
			}
		};
		fetchData();
		return () => {
			cancelled = true;
		};
	}, [active, token]);

	useEffect(() => {
		if (!active?.id) return undefined;
		const path =
			active.type === "channel"
				? `/ws/chat/${active.workspaceId}/${active.id}`
				: `/ws/dm/${active.id}`;
		const wsBase =
			import.meta.env.VITE_WS_URL ||
			(location.protocol === "https:" ? "wss://" : "ws://") + location.host;
		const socket = new WebSocket(`${wsBase.replace(/\/$/, "")}${path}?token=${token}`);
		wsRef.current = socket;
		socket.onopen = () => setStatus("");
		socket.onmessage = (event) => {
			const payload = JSON.parse(event.data);
			if (payload.type === "message") {
				setMessages((prev) => [...prev, payload.payload]);
				setStatus("");
			}
			if (payload.type === "typing") {
				const { user_id: typingUserId, is_typing: isTyping } = payload.payload;
				if (typingUserId === user.id) return;
				setTypingUsers((prev) => {
					const set = new Set(prev);
					if (isTyping) {
						set.add(typingUserId);
						clearTimeout(typingTimeouts.current[typingUserId]);
						typingTimeouts.current[typingUserId] = setTimeout(() => {
							setTypingUsers((current) => current.filter((id) => id !== typingUserId));
						}, 2000);
					} else {
						set.delete(typingUserId);
					}
					return Array.from(set);
				});
			}
		};
		socket.onerror = () => setStatus("Conexão instável com o realtime");
		socket.onclose = () => setStatus("Conexão perdida");
		return () => {
			socket.close();
			wsRef.current = null;
		};
	}, [active, token, user.id]);

	useEffect(() => {
		if (!listRef.current) return;
		listRef.current.scrollTop = listRef.current.scrollHeight;
	}, [messages]);

	const sendTypingSignal = () => {
		const now = Date.now();
		if (now - typingThrottle.current < 1200) return;
		if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
			wsRef.current.send(JSON.stringify({ type: "typing", is_typing: true }));
			typingThrottle.current = now;
		}
	};

	const sendMessage = async () => {
		if (!input.trim() || !active) return;
		const payload = { type: "message", content: input.trim() };
		if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
			wsRef.current.send(JSON.stringify(payload));
		} else if (active.type === "channel") {
			await postChannelMessage(active.id, input.trim(), token);
		} else {
			await postThreadMessage(active.id, input.trim(), token);
		}
		setInput("");
	};

	const typingLabel = typingUsers.length
		? typingUsers.length === 1
			? `Usuário ${typingUsers[0]} está digitando...`
			: `${typingUsers.length} pessoas digitando...`
		: "";

	const renderAvatar = (messageUserId) => {
		const isCurrentUser = messageUserId === user.id;
		if (isCurrentUser && user.avatar_url) {
			return <img src={user.avatar_url} alt={user.display_name || user.email} />;
		}
		const label = isCurrentUser ? user.display_name || user.email : `Usuário ${messageUserId}`;
		const initials = initialsFrom(label);
		return <span style={{ background: stringToColor(label) }}>{initials}</span>;
	};

	return (
		<section className="chat-panel">
			<header className="chat-header">
				<div>
					<p className="muted">{workspaceName || "Workspace"}</p>
					<h2>{conversationLabel || "Escolha um canal"}</h2>
				</div>
				<div className="presence-row">
					<div className="presence-dots">
						{presence.slice(0, 5).map((id) => (
							<span key={id} className="dot" />
						))}
					</div>
					<span className="muted">{presence.length ? `${presence.length} online` : ""}</span>
				</div>
			</header>

			<div className="status-line">{status}</div>

			<div className="messages" ref={listRef}>
				{messages.map((msg) => {
					const messageUserId = msg.user_id ?? msg.sender_id;
					const mine = messageUserId === user.id;
					return (
						<div
							key={msg.id || `${msg.created_at}-${Math.random()}`}
							className={`message-row ${mine ? "mine" : ""}`}
						>
							<div className="avatar">{renderAvatar(messageUserId)}</div>
							<div className="bubble">
								<div className="bubble-meta">
									<strong>{mine ? "Você" : `Usuário ${messageUserId}`}</strong>
									<span>{formatTime(msg.created_at)}</span>
								</div>
								<p>{msg.content}</p>
							</div>
						</div>
					);
				})}
			</div>

			<div className="chat-input">
				<textarea
					value={input}
					placeholder="Escreva uma mensagem..."
					onChange={(e) => {
						setInput(e.target.value);
						sendTypingSignal();
					}}
					onKeyDown={(e) => {
						if (e.key === "Enter" && !e.shiftKey) {
							e.preventDefault();
							sendMessage();
						}
					}}
				/>
				<div className="composer-footer">
					<span className="muted">{typingLabel}</span>
					<button onClick={sendMessage} className="primary">
						Enviar
					</button>
				</div>
			</div>
		</section>
	);
}
