"use client";

import { useEffect, useRef, useState } from "react";

import { toWsUrl } from "@/lib/utils";
import type { MessagePayload, WsOutgoingPayload } from "@/lib/types";

interface DmSocketOptions {
	threadId?: string | null;
	token?: string | null;
	onMessage?: (payload: MessagePayload) => void;
}

export const useDmSocket = ({ threadId, token, onMessage }: DmSocketOptions) => {
	const socketRef = useRef<WebSocket | null>(null);
	const reconnectRef = useRef<NodeJS.Timeout | null>(null);
	const pingRef = useRef<NodeJS.Timeout | null>(null);
	const onMessageRef = useRef<DmSocketOptions["onMessage"]>(onMessage);
	const [isOpen, setIsOpen] = useState(false);

	useEffect(() => {
		onMessageRef.current = onMessage;
	}, [onMessage]);

	useEffect(() => {
		if (!threadId || !token) {
			// Fecha conexão anterior (se houver) e marca como fechada.
			socketRef.current?.close();
			if (reconnectRef.current) {
				clearTimeout(reconnectRef.current);
				reconnectRef.current = null;
			}
			if (pingRef.current) {
				clearInterval(pingRef.current);
				pingRef.current = null;
			}
			setTimeout(() => setIsOpen(false), 0);
			return;
		}

		let disposed = false;

		const connect = () => {
			if (reconnectRef.current) {
				clearTimeout(reconnectRef.current);
				reconnectRef.current = null;
			}
			if (pingRef.current) {
				clearInterval(pingRef.current);
				pingRef.current = null;
			}
			socketRef.current?.close();

			const url = new URL(`/ws/dm/${threadId}`, toWsUrl("/"));
			url.searchParams.set("token", token);
			const socket = new WebSocket(url);
			socketRef.current = socket;

			socket.onopen = () => {
				if (!disposed) setIsOpen(true);
				if (reconnectRef.current) {
					clearTimeout(reconnectRef.current);
					reconnectRef.current = null;
				}
				pingRef.current = setInterval(() => {
					if (socket.readyState === WebSocket.OPEN) {
						socket.send(JSON.stringify({ type: "ping" }));
					}
				}, 10_000);
			};

			socket.onmessage = (event) => {
				try {
					const data = JSON.parse(event.data) as MessagePayload;
					onMessageRef.current?.(data);
				} catch (error) {
					console.warn("Invalid WS payload", error);
				}
			};

			socket.onerror = () => {
				// Avoid Next.js dev overlay (console.error). We'll retry via onclose.
				console.warn("DM WS error");
				if (!disposed) setIsOpen(false);
			};

			socket.onclose = (event) => {
				console.warn("DM WS closed", { code: event.code, reason: event.reason });
				if (!disposed) setIsOpen(false);
				if (pingRef.current) {
					clearInterval(pingRef.current);
					pingRef.current = null;
				}
				if (!disposed) {
					reconnectRef.current = setTimeout(connect, 2500);
				}
			};
		};

		connect();

		return () => {
			disposed = true;
			socketRef.current?.close();
			if (reconnectRef.current) clearTimeout(reconnectRef.current);
			if (pingRef.current) clearInterval(pingRef.current);
			setTimeout(() => setIsOpen(false), 0);
		};
	}, [threadId, token]);

	const send = (payload: WsOutgoingPayload): boolean => {
		const socket = socketRef.current;
		if (socket?.readyState === WebSocket.OPEN) {
			try {
				socket.send(JSON.stringify(payload));
				return true;
			} catch {
				console.warn("DM WS send failed", { type: payload.type });
				return false;
			}
		}
		// Typing is best-effort; if WS isn't open we'll drop it (helps debug).
		console.warn("DM WS not open; dropping outgoing", { type: payload.type });
		return false;
	};

	return { send, isOpen };
};
