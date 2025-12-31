"use client";

import { useEffect, useRef } from "react";

import { toWsUrl } from "@/lib/utils";

interface NotificationsSocketOptions {
	token?: string | null;
	onMessage?: (payload: unknown) => void;
}

export const useNotificationsSocket = ({ token, onMessage }: NotificationsSocketOptions) => {
	const socketRef = useRef<WebSocket | null>(null);
	const reconnectRef = useRef<NodeJS.Timeout | null>(null);
		const pingRef = useRef<NodeJS.Timeout | null>(null);
	const onMessageRef = useRef<NotificationsSocketOptions["onMessage"]>(onMessage);

	useEffect(() => {
		onMessageRef.current = onMessage;
	}, [onMessage]);

	useEffect(() => {
		if (!token) return;

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

			const url = new URL(`/ws/notifications`, toWsUrl("/"));
			url.searchParams.set("token", token);
			const socket = new WebSocket(url);
			socketRef.current = socket;

			socket.onmessage = (event) => {
				try {
					const data = JSON.parse(event.data) as unknown;
					onMessageRef.current?.(data);
				} catch (error) {
					console.warn("Invalid WS payload", error);
				}
			};

			socket.onopen = () => {
				pingRef.current = setInterval(() => {
					if (socket.readyState === WebSocket.OPEN) {
						socket.send("ping");
					}
				}, 10_000);
			};

			socket.onerror = () => {
				// Avoid Next.js dev overlay (console.error). We'll retry via onclose.
				console.warn("Notifications WS error");
			};

			socket.onclose = (event) => {
				console.warn("Notifications WS closed", { code: event.code, reason: event.reason });
				if (pingRef.current) {
					clearInterval(pingRef.current);
					pingRef.current = null;
				}
				reconnectRef.current = setTimeout(connect, 2500);
			};
		};

		connect();

		return () => {
			socketRef.current?.close();
			if (reconnectRef.current) clearTimeout(reconnectRef.current);
			if (pingRef.current) clearInterval(pingRef.current);
		};
	}, [token]);

	return {};
};
