"use client";

import { Send } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { messageSchema, type MessageValues } from "@/lib/validation";

interface MessageComposerProps {
  placeholder: string;
  onSend: (values: MessageValues) => Promise<void> | void;
  isSending?: boolean;
}

export const MessageComposer = ({ placeholder, onSend, isSending }: MessageComposerProps) => {
  const form = useForm<MessageValues>({
    resolver: zodResolver(messageSchema),
    defaultValues: { content: "" },
  });

  const handleSubmit = form.handleSubmit(async (values) => {
    await onSend(values);
    form.reset();
  });

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <Textarea
        placeholder={placeholder}
        {...form.register("content")}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            void handleSubmit();
          }
        }}
      />
      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={isSending}>
          <Send className="mr-2 h-4 w-4" />
          Send
        </Button>
      </div>
    </form>
  );
};
