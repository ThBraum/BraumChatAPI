"use client";

import { Send } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRef } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { messageSchema, type MessageValues } from "@/lib/validation";

interface MessageComposerProps {
  placeholder: string;
  onSend: (values: MessageValues) => Promise<void> | void;
  isSending?: boolean;
  onTyping?: (isTyping: boolean) => void;
}

export const MessageComposer = ({ placeholder, onSend, isSending, onTyping }: MessageComposerProps) => {
  const form = useForm<MessageValues>({
    resolver: zodResolver(messageSchema),
    defaultValues: { content: "" },
  });

  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingSentAtRef = useRef<number>(0);
  const isTypingRef = useRef<boolean>(false);

  const setTyping = (next: boolean) => {
    if (!onTyping) return;
    if (isTypingRef.current === next) return;
    isTypingRef.current = next;
    onTyping(next);
  };

  const bumpTyping = () => {
    if (!onTyping) return;
    const now = Date.now();
    if (!isTypingRef.current || now - lastTypingSentAtRef.current > 1200) {
      lastTypingSentAtRef.current = now;
      setTyping(true);
    }
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      setTyping(false);
    }, 1500);
  };

  const handleSubmit = form.handleSubmit(async (values) => {
    await onSend(values);
    form.reset();
    setTyping(false);
  });

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      {(() => {
        const field = form.register("content");
        return (
          <Textarea
            placeholder={placeholder}
            {...field}
            onChange={(event) => {
              field.onChange(event);
              bumpTyping();
            }}
            onBlur={(event) => {
              field.onBlur(event);
              setTyping(false);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void handleSubmit();
              }
            }}
          />
        );
      })()}
      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={isSending}>
          <Send className="mr-2 h-4 w-4" />
          Send
        </Button>
      </div>
    </form>
  );
};
