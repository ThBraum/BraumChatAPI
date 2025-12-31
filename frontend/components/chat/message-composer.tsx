"use client";

import { Send } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { messageSchema, type MessageValues } from "@/lib/validation";

interface MessageComposerProps {
  placeholder: string;
  onSend: (values: MessageValues) => Promise<void> | void;
  isSending?: boolean;
  onTyping?: (isTyping: boolean) => void;
}

export const MessageComposer = ({ placeholder, onSend, isSending, onTyping }: MessageComposerProps) => {
  const { t } = useTranslation(["chat"]);

  const form = useForm<MessageValues>({
    resolver: zodResolver(messageSchema),
    defaultValues: { content: "" },
  });

  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [lastTypingSentAt, setLastTypingSentAt] = useState(0);

  const bumpTyping = (timestampMs?: number) => {
    if (!onTyping) return;
    const now = typeof timestampMs === "number" && timestampMs > 0 ? timestampMs : Date.now();

    // Allow re-sending `true` while already typing as a keepalive.
    if (!isTyping || now - lastTypingSentAt > 1200) {
      setLastTypingSentAt(now);
      setIsTyping(true);
      onTyping(true);
    }

    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      setIsTyping(false);
      onTyping(false);
    }, 1500);
  };

  const handleSubmit = form.handleSubmit(async (values) => {
    await onSend(values);
    form.reset();
    if (onTyping && isTyping) {
      setIsTyping(false);
      onTyping(false);
    }
  });

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      {(() => {
        const field = form.register("content");
        return (
          <Input
            placeholder={placeholder}
            {...field}
            disabled={isSending}
            className="h-10 flex-1"
            onChange={(event) => {
              field.onChange(event);
              bumpTyping(event.timeStamp);
            }}
            onBlur={(event) => {
              field.onBlur(event);
              if (onTyping && isTyping) {
                setIsTyping(false);
                onTyping(false);
              }
            }}
          />
        );
      })()}

      <Button type="submit" disabled={isSending} className="h-10">
        <Send className="mr-2 h-4 w-4" />
        {t("chat:composer.send", { defaultValue: "Send" })}
      </Button>
    </form>
  );
};
