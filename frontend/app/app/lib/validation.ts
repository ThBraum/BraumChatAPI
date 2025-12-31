import { z } from "zod";

export const loginSchema = z.object({
	email: z.string().email(),
	password: z.string().min(6),
});

export const registerSchema = z.object({
	display_name: z.string().min(2),
	email: z.string().email(),
	password: z.string().min(6),
});

export const messageSchema = z.object({
	content: z.string().min(1).max(4000),
});

export type LoginValues = z.infer<typeof loginSchema>;
export type RegisterValues = z.infer<typeof registerSchema>;
export type MessageValues = z.infer<typeof messageSchema>;
