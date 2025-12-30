import { API_BASE_URL } from "@/lib/utils";

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface ApiRequestOptions extends RequestInit {
	params?: Record<string, string | number | boolean | undefined>;
	method?: HttpMethod;
}

export const buildUrl = (
	path: string,
	params?: Record<string, string | number | boolean | undefined>
) => {
	const url = new URL(path.startsWith("http") ? path : `${API_BASE_URL}${path}`);
	if (params) {
		Object.entries(params).forEach(([key, value]) => {
			if (value === undefined || value === null) return;
			url.searchParams.set(key, String(value));
		});
	}
	return url.toString();
};

export async function parseJson<T>(response: Response): Promise<T> {
	if (response.status === 204) {
		return {} as T;
	}
	try {
		return (await response.json()) as T;
	} catch {
		throw new Error("Unable to parse API response");
	}
}

export async function baseRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
	const { params, headers, method = "GET", body, ...rest } = options;
	const response = await fetch(buildUrl(path, params), {
		method,
		body,
		headers: {
			"Content-Type": "application/json",
			...headers,
		},
		...rest,
	});

	if (!response.ok) {
		const message = await response.text();
		throw new Error(message || "API request failed");
	}

	return parseJson<T>(response);
}
