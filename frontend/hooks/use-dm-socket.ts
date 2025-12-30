"use client";

import { useEffect, useRef } from "react";

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

	useEffect(() => {
		if (!threadId || !token) return;

		const connect = () => {
			const url = new URL(`/ws/dm/${threadId}`, toWsUrl("/"));
			url.searchParams.set("token", token);
			const socket = new WebSocket(url);
			socketRef.current = socket;

			socket.onmessage = (event) => {
				try {
					const data = JSON.parse(event.data) as MessagePayload;
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
	}, [onMessage, threadId, token]);

	const send = (payload: WsOutgoingPayload) => {
		if (socketRef.current?.readyState === WebSocket.OPEN) {
			socketRef.current.send(JSON.stringify(payload));
		}
	};

	return { send };
};
