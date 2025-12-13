// @ts-nocheck
import React, { useMemo, useState } from "react";
import { login, register } from "../api";

function SunIcon(props) {
	return (
		<svg
			width="20"
			height="20"
			viewBox="0 0 24 24"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
			{...props}
		>
			<path
				d="M12 4V2"
				stroke="currentColor"
				strokeWidth="1.5"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
			<path
				d="M12 22v-2"
				stroke="currentColor"
				strokeWidth="1.5"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
			<path
				d="M4.93 4.93L3.51 3.51"
				stroke="currentColor"
				strokeWidth="1.5"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
			<path
				d="M20.49 20.49l-1.42-1.42"
				stroke="currentColor"
				strokeWidth="1.5"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
			<path
				d="M2 12H4"
				stroke="currentColor"
				strokeWidth="1.5"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
			<path
				d="M20 12h2"
				stroke="currentColor"
				strokeWidth="1.5"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
			<path
				d="M4.93 19.07l-1.42 1.42"
				stroke="currentColor"
				strokeWidth="1.5"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
			<path
				d="M20.49 3.51l-1.42 1.42"
				stroke="currentColor"
				strokeWidth="1.5"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
			<circle
				cx="12"
				cy="12"
				r="3"
				stroke="currentColor"
				strokeWidth="1.5"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	);
}

function MoonIcon(props) {
	return (
		<svg
			width="20"
			height="20"
			viewBox="0 0 24 24"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
			{...props}
		>
			<path
				d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"
				stroke="currentColor"
				strokeWidth="1.5"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	);
}

function EyeIcon(props) {
	return (
		<svg
			width="18"
			height="18"
			viewBox="0 0 24 24"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
			{...props}
		>
			<path
				d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"
				stroke="currentColor"
				strokeWidth="1.5"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
			<circle
				cx="12"
				cy="12"
				r="3"
				stroke="currentColor"
				strokeWidth="1.5"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	);
}

function EyeOffIcon(props) {
	return (
		<svg
			width="18"
			height="18"
			viewBox="0 0 24 24"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
			{...props}
		>
			<path
				d="M3 3l18 18"
				stroke="currentColor"
				strokeWidth="1.5"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
			<path
				d="M10.47 10.47a3 3 0 004.06 4.06"
				stroke="currentColor"
				strokeWidth="1.5"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
			<path
				d="M2 12s4-7 10-7a9.77 9.77 0 016.14 2.06"
				stroke="currentColor"
				strokeWidth="1.5"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
			<path
				d="M21.94 16.94A9.77 9.77 0 0022 12s-4 7-10 7c-2.2 0-4.25-.66-5.95-1.79"
				stroke="currentColor"
				strokeWidth="1.5"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	);
}

export default function Login({ onLogin, theme, onThemeToggle }) {
	const [mode, setMode] = useState("login");
	const [form, setForm] = useState({
		email: "",
		password: "",
		confirm_password: "",
		display_name: "",
	});
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState(null);
	const [showPassword, setShowPassword] = useState(false);

	const emailRegex = useMemo(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/, []);

	const handleChange = (e) => {
		const { name, value } = e.target;
		setForm((prev) => ({ ...prev, [name]: value }));
		if (error) setError(null);
	};

	const validate = () => {
		if (!emailRegex.test(form.email)) return { ok: false, msg: "Email inválido" };
		if (!form.password || form.password.length < 6)
			return { ok: false, msg: "Senha muito curta (mín 6 caracteres)" };
		if (mode === "register") {
			if (!form.confirm_password) return { ok: false, msg: "Confirme a senha" };
			if (form.password !== form.confirm_password)
				return { ok: false, msg: "Senhas não conferem" };
		}
		return { ok: true };
	};

	const handleSubmit = async (e) => {
		e.preventDefault();
		setError(null);
		const v = validate();
		if (!v.ok) {
			setError(v.msg);
			return;
		}
		setLoading(true);
		try {
			if (mode === "register") {
				await register({
					email: form.email,
					password: form.password,
					display_name: form.display_name,
				});
				setMode("login");
				setForm((prev) => ({ ...prev, confirm_password: "" }));
			}
			const tok = await login({ email: form.email, password: form.password });
			onLogin(tok.access_token);
		} catch (err) {
			setError("Não foi possível autenticar. Revise os dados e tente novamente.");
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="login-root">
			<div className="login-card">
				<div className="login-header">
					<div>
						<h1>BraumChat</h1>
						<p>Conecte-se com sua equipe em tempo real.</p>
					</div>
					<div className="theme-toggle-wrapper">
						<button
							type="button"
							className={`theme-toggle ${theme === "dark" ? "is-dark" : "is-light"}`}
							onClick={onThemeToggle}
							aria-label="Alternar tema"
							title={theme === "dark" ? "Ativar tema claro" : "Ativar tema escuro"}
						>
							<span className="theme-track">
								<span className="theme-icon moon">
									<MoonIcon />
								</span>
								<span className="theme-icon sun">
									<SunIcon />
								</span>
								<span className="theme-thumb" />
							</span>
						</button>
					</div>
				</div>

				<form onSubmit={handleSubmit} className="login-form" noValidate>
					{mode === "register" && (
						<label>
							<span>Nome Exibido</span>
							<input
								type="text"
								name="display_name"
								value={form.display_name}
								onChange={handleChange}
								placeholder="Seu nome"
							/>
						</label>
					)}

					<label>
						<span>Email</span>
						<input
							type="email"
							name="email"
							value={form.email}
							onChange={handleChange}
							placeholder="voce@empresa.com"
							required
							pattern="[^\s@]+@[^\s@]+\.[^\s@]+"
						/>
					</label>

					<label>
						<span>Senha</span>
						<div className="password-field">
							<input
								type={showPassword ? "text" : "password"}
								name="password"
								value={form.password}
								onChange={handleChange}
								placeholder="••••••••"
								required
							/>
							<button
								type="button"
								className="password-toggle"
								aria-label={showPassword ? "Esconder senha" : "Mostrar senha"}
								onClick={() => setShowPassword((s) => !s)}
							>
								{showPassword ? (
									<EyeOffIcon style={{ transform: "translateY(-4px)", display: "block" }} />
								) : (
									<EyeIcon style={{ transform: "translateY(-4px)", display: "block" }} />
								)}
							</button>
						</div>
					</label>

					{mode === "register" && (
						<label>
							<span>Confirme a senha</span>
							<div className="password-field">
								<input
									type={showPassword ? "text" : "password"}
									name="confirm_password"
									value={form.confirm_password}
									onChange={handleChange}
									placeholder="Confirme a senha"
									required
								/>
								<button
									type="button"
									className="password-toggle"
									aria-label={showPassword ? "Esconder senha" : "Mostrar senha"}
									onClick={() => setShowPassword((s) => !s)}
								>
									{showPassword ? (
										<EyeOffIcon style={{ transform: "translateY(-4px)", display: "block" }} />
									) : (
										<EyeIcon style={{ transform: "translateY(-4px)", display: "block" }} />
									)}
								</button>
							</div>
						</label>
					)}

					{error && <div className="err">{error}</div>}

					<button type="submit" className="primary" disabled={loading}>
						{loading ? "Processando..." : mode === "register" ? "Criar conta" : "Entrar"}
					</button>
				</form>

				<div className="login-footer">
					<span>{mode === "register" ? "Já possui conta?" : "Novo por aqui?"}</span>
					<button
						type="button"
						className="link"
						onClick={() => {
							setMode((m) => (m === "register" ? "login" : "register"));
							setError(null);
						}}
					>
						{mode === "register" ? "Entrar" : "Criar conta"}
					</button>
				</div>
			</div>
		</div>
	);
}
