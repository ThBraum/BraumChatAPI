"use client";

import { useEffect, useRef } from "react";

import { toWsUrl } from "@/lib/utils";
import type { MessagePayload } from "@/lib/types";

interface ChannelSocketOptions {
  workspaceId?: string | null;
  channelId?: string | null;
  token?: string | null;
  onMessage?: (payload: MessagePayload) => void;
}

export const useChannelSocket = ({
  workspaceId,
  channelId,
  token,
  onMessage,
}: ChannelSocketOptions) => {
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!workspaceId || !channelId || !token) return;

    const connect = () => {
      const url = new URL(`/ws/chat/${workspaceId}/${channelId}`, toWsUrl("/"));
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
  }, [channelId, onMessage, token, workspaceId]);

  const send = (payload: MessagePayload) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(payload));
    }
  };

  return { send };
};
