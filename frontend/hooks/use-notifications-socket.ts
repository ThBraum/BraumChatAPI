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

	useEffect(() => {
		if (!token) return;

		const connect = () => {
			const url = new URL(`/ws/notifications`, toWsUrl("/"));
			url.searchParams.set("token", token);
			const socket = new WebSocket(url);
			socketRef.current = socket;

			socket.onmessage = (event) => {
				try {
					const data = JSON.parse(event.data) as unknown;
					onMessage?.(data);
				} catch (error) {
					console.error("Invalid WS payload", error);
				}
			};

			socket.onclose = () => {
				reconnectRef.current = setTimeout(connect, 2500);
			};
		};

		connect();

		return () => {
			socketRef.current?.close();
			if (reconnectRef.current) clearTimeout(reconnectRef.current);
		};
	}, [onMessage, token]);

	return {};
};
