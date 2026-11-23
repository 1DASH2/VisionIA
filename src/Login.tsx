
import { useState, type FormEvent } from "react";
import {
    ArrowRight,
    Eye,
    EyeOff,
    LockKeyhole,
    ScanLine,
    ShieldCheck,
    UserRound,
} from "lucide-react";

import "./login.css";

const API =
    import.meta.env.VITE_API_URL ||
    "http://localhost:8000";
const API_BASE = API.replace(/\/$/, "");

export type AuthUser = {
    id: number;
    username: string;
    role: string;
};

export default function Login({
    onLogin,
}: {
    onLogin: (token: string, user: AuthUser) => void;
}) {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setLoading(true);
        setError("");

        try {
            const response = await fetch(
                `${API_BASE}/api/v1/auth/login`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        username: username.trim(),
                        password,
                    }),
                }
            );

            if (!response.ok) {
                throw new Error(
                    response.status === 401
                        ? "Usuario o contraseña incorrectos."
                        : "No se pudo iniciar sesión."
                );
            }

            const data = await response.json();

            onLogin(data.access_token, data.user);
        } catch (err) {
            const message = err instanceof Error ? err.message : "";
            setError(
                message === "Failed to fetch" || message.includes("NetworkError")
                    ? `No se pudo conectar con FastAPI (${API_BASE}). Inicia el backend en el puerto 8000 y revisa la URL.`
                    : message || "Error de conexión."
            );
        } finally {
            setLoading(false);
        }
    }

    return (
        <main className="login-screen">
            <div className="login-glow" />

            <section className="login-card">
                <div className="login-brand">
                    <div className="login-logo">
                        <ScanLine size={30} />
                    </div>

                    <div>
                        <strong>VISION AI</strong>
                        <span>ENTERPRISE 2.0</span>
                    </div>
                </div>

                <div className="login-heading">
                    <span className="login-eyebrow">
                        <ShieldCheck size={15} />
                        ACCESO SEGURO
                    </span>

                    <h1>Bienvenido de nuevo</h1>

                    <p>
                        Inicia sesión para acceder al centro
                        de inteligencia visual.
                    </p>
                </div>

                <form onSubmit={submit}>
                    <label htmlFor="login-username">
                        Usuario
                    </label>

                    <div className="login-field">
                        <UserRound size={18} />
                        <input
                            id="login-username"
                            type="text"
                            autoComplete="username"
                            placeholder="Nombre de usuario"
                            value={username}
                            onChange={(event) =>
                                setUsername(event.target.value)
                            }
                            required
                        />
                    </div>

                    <label htmlFor="login-password">
                        Contraseña
                    </label>

                    <div className="login-field">
                        <LockKeyhole size={18} />

                        <input
                            id="login-password"
                            type={showPassword ? "text" : "password"}
                            autoComplete="current-password"
                            placeholder="Tu contraseña"
                            value={password}
                            onChange={(event) =>
                                setPassword(event.target.value)
                            }
                            required
                        />

                        <button
                            type="button"
                            className="login-eye"
                            onClick={() =>
                                setShowPassword((value) => !value)
                            }
                            aria-label={
                                showPassword
                                    ? "Ocultar contraseña"
                                    : "Mostrar contraseña"
                            }
                        >
                            {showPassword ? (
                                <EyeOff size={18} />
                            ) : (
                                <Eye size={18} />
                            )}
                        </button>
                    </div>

                    {error && (
                        <p className="login-error" role="alert">
                            {error}
                        </p>
                    )}

                    <button
                        className="login-submit"
                        type="submit"
                        disabled={loading}
                    >
                        {loading
                            ? "Verificando..."
                            : "Iniciar sesión"}
                        <ArrowRight size={19} />
                    </button>
                </form>

                <div className="login-footer">
                    <ShieldCheck size={15} />
                    Plataforma de acceso restringido
                </div>
            </section>
        </main>
    );
}
