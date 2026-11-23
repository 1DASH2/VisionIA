
import React, {
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { createRoot } from "react-dom/client";

import {
    Activity,
    AlertTriangle,
    ArrowDownToLine,
    ArrowRight,
    Bell,
    Box,
    Check,
    CheckCircle2,
    Clock3,
    Database,
    FileText,
    HardHat,
    LayoutDashboard,
    Menu,
    PackageCheck,
    Play,
    ScanLine,
    Search,
    Settings2,
    ShieldCheck,
    ShoppingBag,
    SlidersHorizontal,
    Sparkles,
    X,
    Zap,
} from "lucide-react";

import {
    Area,
    AreaChart,
    CartesianGrid,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";

import BackendEvents from "./BackendEvents";
import LiveCamera from "./LiveCamera";
import "./style.css";
import Login, { type AuthUser } from "./Login";
import { setAccessToken, authHeaders } from "./auth";

type Scenario =
    | "industrial"
    | "warehouse"
    | "quality"
    | "retail";

type Page =
    | "dashboard"
    | "analysis"
    | "alerts"
    | "history"
    | "settings";

type WorkspaceMode = "demo" | "real";

type Detection = {
    label: string;
    confidence: number;
    x: number;
    y: number;
    w: number;
    h: number;
    color: string;
};

type Analysis = {
    id: string;
    scenario: Scenario;
    mode: string;
    date: string;
    duration: number;
    detections: Detection[];
    alerts: string[];
    confidence: number;
};

type DemoAlert = {
    id: string;
    analysisId: string;
    scenario: Scenario;
    message: string;
    severity: "Alta" | "Media";
    status: "Nueva" | "Revisada" | "Cerrada";
    date: string;
};

const API =
    import.meta.env.VITE_API_URL ||
    "http://localhost:8000";

const scenarios = [
    {
        id: "industrial" as Scenario,
        title: "Seguridad industrial",
        sub: "Monitoreo de personal y EPP",
        icon: HardHat,
        message:
            "Posible incumplimiento de EPP en simulación",
        severity: "Alta" as const,
        detections: [
            {
                label: "Persona",
                confidence: 0.97,
                x: 0.28,
                y: 0.16,
                w: 0.29,
                h: 0.72,
                color: "#40c7f4",
            },
            {
                label: "Casco",
                confidence: 0.93,
                x: 0.35,
                y: 0.15,
                w: 0.12,
                h: 0.13,
                color: "#58dfb0",
            },
            {
                label: "Chaleco ausente",
                confidence: 0.87,
                x: 0.31,
                y: 0.38,
                w: 0.23,
                h: 0.35,
                color: "#ffb56b",
            },
        ],
    },
    {
        id: "warehouse" as Scenario,
        title: "Almacén inteligente",
        sub: "Objetos y zonas restringidas",
        icon: Box,
        message:
            "Objeto en zona restringida de simulación",
        severity: "Alta" as const,
        detections: [
            {
                label: "Pallet",
                confidence: 0.96,
                x: 0.13,
                y: 0.48,
                w: 0.29,
                h: 0.33,
                color: "#40c7f4",
            },
            {
                label: "Zona restringida",
                confidence: 0.91,
                x: 0.53,
                y: 0.3,
                w: 0.36,
                h: 0.54,
                color: "#ffb56b",
            },
            {
                label: "Caja",
                confidence: 0.94,
                x: 0.57,
                y: 0.42,
                w: 0.21,
                h: 0.23,
                color: "#58dfb0",
            },
        ],
    },
    {
        id: "quality" as Scenario,
        title: "Control de calidad",
        sub: "Inspección de productos",
        icon: PackageCheck,
        message:
            "Defecto superficial simulado",
        severity: "Media" as const,
        detections: [
            {
                label: "Producto",
                confidence: 0.98,
                x: 0.24,
                y: 0.24,
                w: 0.51,
                h: 0.49,
                color: "#40c7f4",
            },
            {
                label: "Defecto simulado",
                confidence: 0.89,
                x: 0.51,
                y: 0.4,
                w: 0.14,
                h: 0.16,
                color: "#ffb56b",
            },
        ],
    },
    {
        id: "retail" as Scenario,
        title: "Retail analytics",
        sub: "Conteo y actividad comercial",
        icon: ShoppingBag,
        message:
            "Ocupación elevada en simulación",
        severity: "Media" as const,
        detections: [
            {
                label: "Persona",
                confidence: 0.96,
                x: 0.26,
                y: 0.2,
                w: 0.18,
                h: 0.64,
                color: "#40c7f4",
            },
            {
                label: "Estante",
                confidence: 0.94,
                x: 0.56,
                y: 0.21,
                w: 0.32,
                h: 0.56,
                color: "#58dfb0",
            },
        ],
    },
];

const navigation = [
    {
        id: "dashboard" as Page,
        label: "Dashboard",
        icon: LayoutDashboard,
    },
    {
        id: "analysis" as Page,
        label: "Análisis visual",
        icon: ScanLine,
    },
    {
        id: "alerts" as Page,
        label: "Centro de alertas",
        icon: Bell,
    },
    {
        id: "history" as Page,
        label: "Historial y reportes",
        icon: FileText,
    },
    {
        id: "settings" as Page,
        label: "Configuración",
        icon: Settings2,
    },
];

const STORAGE_KEY = "vision-ai-enterprise-v2";

function readStorage(): {
    threshold?: number;
    analyses?: Analysis[];
    alerts?: DemoAlert[];
} {
    try {
        return JSON.parse(
            localStorage.getItem(STORAGE_KEY) || "{}"
        );
    } catch {
        return {};
    }
}

function formatDate(value: string) {
    return new Date(value).toLocaleString("es-PE", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

function newId() {
    return `VA-${Date.now().toString(36).toUpperCase()}`;
}

function MotionDemo({
    scenario,
}: {
    scenario: Scenario;
}) {
    const [playing, setPlaying] = useState(true);
    const [tick, setTick] = useState(0);

    useEffect(() => {
        setTick(0);
        setPlaying(true);
    }, [scenario]);

    useEffect(() => {
        if (!playing) return;

        const timer = window.setInterval(() => {
            setTick((previous) => (previous + 0.05) % 12);
        }, 50);

        return () => window.clearInterval(timer);
    }, [playing]);

    const current = scenarios.find(
        (item) => item.id === scenario
    )!;

    const position = Math.sin(tick) * 35;

    return (
        <div className="motion-demo">
            <div className="motion-head">
                <div>
                    <strong>
                        <span className="pulse-dot" />
                        {" "}SIMULACIÓN ANIMADA
                    </strong>
                    <small>
                        {current.title} · Datos sintéticos,
                        no inferencia real
                    </small>
                </div>
                <span className="motion-live">
                    {playing
                        ? "● EN REPRODUCCIÓN"
                        : "Ⅱ PAUSADO"}
                </span>
            </div>

            <svg
                className="motion-stage"
                viewBox="0 0 800 350"
                role="img"
                aria-label={`Simulación de ${current.title}`}
            >
                <defs>
                    <linearGradient
                        id="demoBackground"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                    >
                        <stop
                            offset="0"
                            stopColor="#142c49"
                        />
                        <stop
                            offset="1"
                            stopColor="#091525"
                        />
                    </linearGradient>
                </defs>

                <rect
                    width="800"
                    height="350"
                    fill="url(#demoBackground)"
                />

                <path
                    d="M0 250H800V350H0Z"
                    fill="#152b43"
                />

                {scenario === "industrial" && (
                    <>
                        <path
                            d="M60 250V80H220V250M580 250V80H740V250"
                            stroke="#536c83"
                            strokeWidth="12"
                            fill="none"
                        />
                        {[250, 470].map((x, index) => (
                            <g
                                key={index}
                                transform={`translate(${x + position * (index ? -1 : 1)
                                    } 0)`}
                            >
                                <circle
                                    cx="0"
                                    cy="135"
                                    r="17"
                                    fill="#f4c99e"
                                />
                                <rect
                                    x="-20"
                                    y="155"
                                    width="40"
                                    height="65"
                                    rx="6"
                                    fill={
                                        index === 0
                                            ? "#ffce55"
                                            : "#3677b7"
                                    }
                                />
                                <path
                                    d="M-10 220L-16 250M10 220L16 250"
                                    stroke="#a8b9d1"
                                    strokeWidth="10"
                                />
                                <rect
                                    x="-30"
                                    y="105"
                                    width="60"
                                    height="130"
                                    fill="none"
                                    stroke={
                                        index === 0
                                            ? "#49d6ee"
                                            : "#ffae68"
                                    }
                                    strokeWidth="3"
                                    strokeDasharray="8 5"
                                />
                            </g>
                        ))}
                        <text
                            x="35"
                            y="40"
                            fill="#b5d9f1"
                            fontSize="17"
                        >
                            MONITOREO DE PERSONAL · DEMO
                        </text>
                    </>
                )}

                {scenario === "warehouse" && (
                    <>
                        {[0, 1, 2].map((row) => (
                            <g key={row}>
                                <rect
                                    x="60"
                                    y={70 + row * 55}
                                    width="270"
                                    height="40"
                                    fill="#56718c"
                                />
                                {[0, 1, 2, 3].map((column) => (
                                    <rect
                                        key={column}
                                        x={75 + column * 65}
                                        y={78 + row * 55}
                                        width="45"
                                        height="30"
                                        fill="#b88957"
                                    />
                                ))}
                            </g>
                        ))}
                        <rect
                            x="475"
                            y="75"
                            width="275"
                            height="170"
                            fill="#f5a44416"
                            stroke="#ffb76b"
                            strokeWidth="3"
                            strokeDasharray="10 7"
                        />
                        <rect
                            x={355 + position * 3}
                            y="205"
                            width="105"
                            height="45"
                            rx="7"
                            fill="#f0ae42"
                        />
                        <text
                            x="495"
                            y="110"
                            fill="#ffcd91"
                            fontSize="17"
                        >
                            ZONA RESTRINGIDA
                        </text>
                    </>
                )}

                {scenario === "quality" && (
                    <>
                        <rect
                            x="20"
                            y="175"
                            width="760"
                            height="75"
                            rx="12"
                            fill="#405c75"
                        />
                        {[0, 1, 2, 3, 4].map((index) => (
                            <g
                                key={index}
                                transform={`translate(${((index * 175 + tick * 60) % 1000) -
                                    120
                                    } 0)`}
                            >
                                <rect
                                    y="145"
                                    width="110"
                                    height="80"
                                    rx="7"
                                    fill={
                                        index === 2
                                            ? "#b87a4e"
                                            : "#75aeca"
                                    }
                                />
                                {index === 2 && (
                                    <path
                                        d="M35 175L65 160L80 190L50 205Z"
                                        fill="#fa714f"
                                    />
                                )}
                            </g>
                        ))}
                        <text
                            x="30"
                            y="40"
                            fill="#b5d9f1"
                            fontSize="17"
                        >
                            INSPECCIÓN DE PRODUCTOS · DEMO
                        </text>
                    </>
                )}

                {scenario === "retail" && (
                    <>
                        {[50, 560].map((x) => (
                            <g key={x}>
                                <rect
                                    x={x}
                                    y="65"
                                    width="190"
                                    height="185"
                                    fill="#2c465e"
                                    stroke="#7294ae"
                                    strokeWidth="4"
                                />
                                {[0, 1, 2].map((row) => (
                                    <path
                                        key={row}
                                        d={`M${x + 10} ${120 + row * 50
                                            }H${x + 180}`}
                                        stroke="#8ba7bc"
                                        strokeWidth="7"
                                    />
                                ))}
                            </g>
                        ))}
                        {[310, 420].map((x, index) => (
                            <g
                                key={index}
                                transform={`translate(${x + position * (index ? -1 : 1)
                                    } 0)`}
                            >
                                <circle
                                    cx="0"
                                    cy="150"
                                    r="16"
                                    fill="#f4c99e"
                                />
                                <rect
                                    x="-19"
                                    y="170"
                                    width="38"
                                    height="60"
                                    rx="7"
                                    fill="#7f9fe6"
                                />
                                <path
                                    d="M-10 230L-15 250M10 230L15 250"
                                    stroke="#a8b9d1"
                                    strokeWidth="9"
                                />
                            </g>
                        ))}
                        <text
                            x="30"
                            y="40"
                            fill="#b5d9f1"
                            fontSize="17"
                        >
                            FLUJO DE CLIENTES · DEMO
                        </text>
                    </>
                )}

                <path
                    d={`M${(tick / 12) * 800} 0V350`}
                    stroke="#50dcf6"
                    strokeWidth="2"
                    opacity=".45"
                />

                <rect
                    x="20"
                    y="305"
                    width="760"
                    height="27"
                    rx="5"
                    fill="#071424bb"
                />

                <text
                    x="32"
                    y="324"
                    fill="#c3e4fb"
                    fontSize="12"
                >
                    VISION AI · MOTOR DE SIMULACIÓN
                </text>
            </svg>

            <div className="motion-controls">
                <button
                    type="button"
                    onClick={() =>
                        setPlaying((value) => !value)
                    }
                >
                    {playing ? "Ⅱ Pausar" : "▶ Reproducir"}
                </button>

                <button
                    type="button"
                    onClick={() => setTick(0)}
                >
                    ↺ Reiniciar
                </button>

                <input
                    aria-label="Posición de simulación"
                    type="range"
                    min="0"
                    max="12"
                    step="0.05"
                    value={tick}
                    onChange={(event) =>
                        setTick(Number(event.target.value))
                    }
                />

                <span>{tick.toFixed(1)}s / 12s</span>
            </div>
        </div>
    );
}

function DashboardApp({
    user,
    onLogout,
}: {
    user: AuthUser;
    onLogout: () => void;
}) {

    const initial = useMemo(readStorage, []);

    const [page, setPage] =
        useState<Page>("dashboard");

    const [scenario, setScenario] =
        useState<Scenario>("industrial");

    const [workspaceMode, setWorkspaceMode] =
        useState<WorkspaceMode>(() =>
            sessionStorage.getItem("vision-ai-mode") ===
                "real"
                ? "real"
                : "demo"
        );

    const [threshold, setThreshold] =
        useState(initial.threshold ?? 75);

    const [analyses, setAnalyses] =
        useState<Analysis[]>(
            initial.analyses ?? []
        );

    const [alerts, setAlerts] =
        useState<DemoAlert[]>(
            initial.alerts ?? []
        );

    const [active, setActive] =
        useState<Analysis | null>(null);

    const [mobile, setMobile] =
        useState(false);

    const [busy, setBusy] =
        useState(false);

    const [progress, setProgress] =
        useState(0);

    const [filter, setFilter] =
        useState("");

    const [statusFilter, setStatusFilter] =
        useState("Todos");

    const [toast, setToast] =
        useState("");

    const [error, setError] =
        useState("");

    const [apiOnline, setApiOnline] =
        useState(false);

    const [modelLoaded, setModelLoaded] =
        useState(false);

    const sidebarRef =
        useRef<HTMLElement>(null);

    const menuButtonRef =
        useRef<HTMLButtonElement>(null);

    const isReal = workspaceMode === "real";

    const current = scenarios.find(
        (item) => item.id === scenario
    )!;

    const pageTitle = navigation.find(
        (item) => item.id === page
    )?.label;

    const detected = analyses.reduce(
        (total, item) =>
            total + item.detections.length,
        0
    );

    const openAlerts = alerts.filter(
        (item) => item.status === "Nueva"
    ).length;

    const averageConfidence = analyses.length
        ? Math.round(
            (analyses.reduce(
                (total, item) =>
                    total + item.confidence,
                0
            ) /
                analyses.length) *
            100
        )
        : 0;

    const chart = useMemo(() => {
        const days = [
            "Lun",
            "Mar",
            "Mié",
            "Jue",
            "Vie",
            "Sáb",
            "Dom",
        ];

        return days.map((day, index) => ({
            day,
            value: analyses.filter(
                (_, position) =>
                    position % 7 === index
            ).length,
        }));
    }, [analyses]);

    useEffect(() => {
        localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({
                threshold,
                analyses,
                alerts,
            })
        );
    }, [threshold, analyses, alerts]);

    useEffect(() => {
        sessionStorage.setItem(
            "vision-ai-mode",
            workspaceMode
        );
    }, [workspaceMode]);

    useEffect(() => {
        if (!toast) return;

        const timer = window.setTimeout(
            () => setToast(""),
            3500
        );

        return () => window.clearTimeout(timer);
    }, [toast]);

    // Cierra el menú al pulsar fuera o presionar Esc.
    useEffect(() => {
        if (!mobile) return;

        function handleOutsideClick(
            event: PointerEvent
        ) {
            const target = event.target as Node;

            if (
                !sidebarRef.current?.contains(target) &&
                !menuButtonRef.current?.contains(target)
            ) {
                setMobile(false);
            }
        }

        function handleEscape(
            event: KeyboardEvent
        ) {
            if (event.key === "Escape") {
                setMobile(false);
            }
        }

        document.addEventListener(
            "pointerdown",
            handleOutsideClick
        );

        document.addEventListener(
            "keydown",
            handleEscape
        );

        return () => {
            document.removeEventListener(
                "pointerdown",
                handleOutsideClick
            );

            document.removeEventListener(
                "keydown",
                handleEscape
            );
        };
    }, [mobile]);

    // Comprueba que el backend y YOLO estén disponibles.
    useEffect(() => {
        let cancelled = false;

        async function checkBackend() {
            try {
                const response = await fetch(
                    `${API}/api/v1/health`
                );

                if (!response.ok) {
                    throw new Error("Backend no disponible");
                }

                const data = await response.json();

                if (!cancelled) {
                    setApiOnline(true);
                    setModelLoaded(
                        data.model_loaded === true
                    );
                }
            } catch {
                if (!cancelled) {
                    setApiOnline(false);
                    setModelLoaded(false);
                }
            }
        }

        void checkBackend();

        const timer = window.setInterval(
            checkBackend,
            10000
        );

        return () => {
            cancelled = true;
            window.clearInterval(timer);
        };
    }, []);

    function navigate(selected: Page) {
        setPage(selected);
        setMobile(false);
        setError("");
    }


    function openScenario(selected: Scenario) {
        setScenario(selected);
        setActive(null);
        setError("");
        setProgress(0);
        setPage("analysis");
        setMobile(false);

        // Desplaza el contenido principal al inicio.
        const mainContent = document.querySelector(".main");

        if (mainContent instanceof HTMLElement) {
            mainContent.scrollTo({
                top: 0,
                behavior: "smooth",
            });
        }

        window.scrollTo({
            top: 0,
            behavior: "smooth",
        });
    }


    function changeWorkspace(
        selected: WorkspaceMode
    ) {
        setWorkspaceMode(selected);
        setActive(null);
        setError("");
        setMobile(false);
    }

    function runDemo() {
        if (busy || isReal) return;

        setBusy(true);
        setProgress(0);
        setError("");

        const started = performance.now();
        let progressValue = 0;

        const timer = window.setInterval(() => {
            progressValue = Math.min(
                100,
                progressValue + 20
            );

            setProgress(progressValue);

            if (progressValue < 100) return;

            window.clearInterval(timer);

            const detections =
                current.detections.filter(
                    (item) =>
                        item.confidence * 100 >=
                        threshold
                );

            const average = detections.length
                ? detections.reduce(
                    (total, item) =>
                        total + item.confidence,
                    0
                ) / detections.length
                : 0;

            const alertLabels = [
                "Chaleco ausente",
                "Zona restringida",
                "Defecto simulado",
            ];

            const hasAlert = detections.some(
                (item) =>
                    alertLabels.includes(item.label)
            );

            const analysis: Analysis = {
                id: newId(),
                scenario,
                mode: "DEMO",
                date: new Date().toISOString(),
                duration: Number(
                    (
                        (performance.now() - started) /
                        1000
                    ).toFixed(1)
                ),
                detections,
                alerts: hasAlert
                    ? [current.message]
                    : [],
                confidence: average,
            };

            setAnalyses((previous) => [
                analysis,
                ...previous,
            ]);

            setActive(analysis);

            if (hasAlert) {
                const alert: DemoAlert = {
                    id: newId(),
                    analysisId: analysis.id,
                    scenario,
                    message: current.message,
                    severity: current.severity,
                    status: "Nueva",
                    date: analysis.date,
                };

                setAlerts((previous) => [
                    alert,
                    ...previous,
                ]);
            }

            setBusy(false);
            setToast(
                "Análisis DEMO registrado correctamente"
            );
        }, 100);
    }

    async function saveRealEvent(
        count: number
    ) {
        if (!isReal || count <= 0) return;

        try {
            const response = await fetch(
                `${API}/api/v1/events`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        scenario,
                        source: "CAMARA_REAL",
                        severity: "Media",
                        message:
                            `${count} detección(es) generales ` +
                            "observadas mediante YOLO. " +
                            "Pendiente de revisión humana.",
                        detections: count,
                    }),
                }
            );

            if (!response.ok) {
                throw new Error(
                    "No se pudo guardar el evento"
                );
            }

            setToast(
                "Observación real guardada en SQLite"
            );
        } catch {
            setError(
                "No se pudo registrar la observación en el backend."
            );
        }
    }

    function updateAlert(
        alert: DemoAlert,
        status: DemoAlert["status"]
    ) {
        setAlerts((previous) =>
            previous.map((item) =>
                item.id === alert.id
                    ? { ...item, status }
                    : item
            )
        );
    }

    function exportCsv() {
        const header = [
            "ID",
            "Escenario",
            "Fecha",
            "Detecciones",
            "Confianza",
            "Modo",
        ];

        const rows = analyses.map((item) => [
            item.id,
            item.scenario,
            item.date,
            String(item.detections.length),
            String(
                Math.round(item.confidence * 100)
            ),
            item.mode,
        ]);

        const csv = [header, ...rows]
            .map((row) =>
                row
                    .map((value) =>
                        `"${value.replace(/"/g, '""')}"`
                    )
                    .join(",")
            )
            .join("\r\n");

        const blob = new Blob(
            ["\uFEFF", csv],
            {
                type: "text/csv;charset=utf-8",
            }
        );

        const url = URL.createObjectURL(blob);
        const link =
            document.createElement("a");

        link.href = url;
        link.download =
            "vision-ai-historial-demo.csv";
        link.click();

        URL.revokeObjectURL(url);
    }

    return (
        <div className="app">
            {mobile && (
                <div
                    className="mobile-overlay"
                    onClick={() => setMobile(false)}
                    aria-hidden="true"
                />
            )}

            <aside
                ref={sidebarRef}
                className={
                    "sidebar " +
                    (mobile ? "mobile-open" : "")
                }
            >
                <div className="brand">
                    <div className="brand-icon">
                        <ScanLine size={24} />
                    </div>
                    <div>
                        <strong>VISION AI</strong>
                        <small>ENTERPRISE 2.0</small>
                    </div>
                </div>

                <div
                    className="environment-switch"
                    role="group"
                    aria-label="Seleccionar entorno"
                >
                    <button
                        type="button"
                        className={
                            !isReal ? "chosen" : ""
                        }
                        onClick={() =>
                            changeWorkspace("demo")
                        }
                    >
                        ◈ MODO DEMO
                    </button>

                    <button
                        type="button"
                        className={
                            isReal ? "chosen" : ""
                        }
                        onClick={() =>
                            changeWorkspace("real")
                        }
                    >
                        ◉ MODO REAL
                    </button>
                </div>

                <p className="environment-caption">
                    {isReal
                        ? "Cámara real · FastAPI + YOLO"
                        : "Simulación · Datos sintéticos"}
                </p>

                <div className="nav-label">
                    PLATAFORMA
                </div>

                <nav>
                    {navigation.map((item) => (
                        <button
                            key={item.id}
                            type="button"
                            className={
                                "nav-item " +
                                (page === item.id
                                    ? "selected"
                                    : "")
                            }
                            onClick={() =>
                                navigate(item.id)
                            }
                        >
                            <item.icon size={18} />
                            {item.label}

                            {!isReal &&
                                item.id === "alerts" &&
                                openAlerts > 0 && (
                                    <span className="nav-count">
                                        {openAlerts}
                                    </span>
                                )}
                        </button>
                    ))}
                </nav>

                <div className="sidebar-bottom">
                    <div className="engine-card">
                        <div className="engine-top">
                            <span className="pulse-dot" />
                            MOTOR DE ANÁLISIS
                        </div>

                        <strong>
                            {isReal
                                ? "FastAPI + YOLO"
                                : "DemoVisionAdapter"}
                        </strong>

                        <small>
                            {isReal
                                ? modelLoaded
                                    ? "Modelo general cargado"
                                    : "Modelo no disponible"
                                : "Simulación sin inferencia"}
                        </small>

                        <div className="engine-bar">
                            <span />
                        </div>
                    </div>

                    <div className="user">
                        <div>
                            <b>{user.username}</b>
                            <small>Administrador</small>

                            <button
                                type="button"
                                onClick={onLogout}
                                style={{
                                    marginTop: 8,
                                    padding: "7px 12px",
                                    cursor: "pointer",
                                    borderRadius: 8,
                                }}
                            >
                                Cerrar sesión
                            </button>
                        </div>
                        <div className="avatar">
                            VA
                        </div>
                        <div>
                            <b>Operador VISION AI</b>
                            <small>
                                {isReal
                                    ? "Entorno real"
                                    : "Entorno demostrativo"}
                            </small>
                        </div>
                    </div>
                </div>
            </aside>

            <div className="main">
                <header className="topbar">
                    <div className="breadcrumb">
                        <button
                            ref={menuButtonRef}
                            type="button"
                            className="mobile-menu"
                            aria-label={
                                mobile
                                    ? "Cerrar menú"
                                    : "Abrir menú"
                            }
                            aria-expanded={mobile}
                            onClick={() =>
                                setMobile((value) => !value)
                            }
                        >
                            <Menu size={20} />
                        </button>

                        <span>Plataforma</span>
                        <span className="slash">
                            /
                        </span>
                        <b>{pageTitle}</b>
                    </div>

                    <div className="top-actions">
                        <div className="top-mode-actions">
                            <button
                                type="button"
                                className={
                                    !isReal
                                        ? "top-mode-btn selected demo"
                                        : "top-mode-btn"
                                }
                                onClick={() =>
                                    changeWorkspace("demo")
                                }
                            >
                                ◈ MODO DEMO
                            </button>

                            <button
                                type="button"
                                className={
                                    isReal
                                        ? "top-mode-btn selected real"
                                        : "top-mode-btn"
                                }
                                onClick={() =>
                                    changeWorkspace("real")
                                }
                            >
                                ◉ MODO REAL
                            </button>
                        </div>

                        <span className="top-date">
                            {new Date()
                                .toLocaleDateString("es-PE")}
                        </span>

                        <button
                            type="button"
                            className="icon-btn"
                            aria-label="Ver alertas"
                            onClick={() =>
                                navigate("alerts")
                            }
                        >
                            <Bell size={19} />
                        </button>
                    </div>
                </header>

                <main className="content">
                    {page === "dashboard" && (
                        <>
                            <div className="heading">
                                <div>
                                    <div className="eyebrow">
                                        <Sparkles size={14} />
                                        INTELLIGENCE OVERVIEW
                                    </div>

                                    <h1>
                                        Centro de inteligencia visual
                                    </h1>

                                    <p>
                                        {isReal
                                            ? "Operación con inferencia real mediante YOLO."
                                            : "Panel de demostración con datos sintéticos."}
                                    </p>
                                </div>

                                <button
                                    className="primary"
                                    onClick={() =>
                                        navigate("analysis")
                                    }
                                >
                                    <ScanLine size={17} />
                                    {isReal
                                        ? "Abrir cámara"
                                        : "Nuevo análisis"}
                                    <ArrowRight size={17} />
                                </button>
                            </div>

                            <div className="hero">
                                <div className="hero-copy">
                                    <span className="hero-pill">
                                        <span className="pulse-dot" />
                                        PLATAFORMA OPERATIVA ·
                                        {isReal ? " REAL" : " DEMO"}
                                    </span>

                                    <h2>
                                        Inteligencia visual
                                        <em> en tiempo real.</em>
                                    </h2>

                                    <p>
                                        Cuatro escenarios empresariales
                                        con supervisión humana.
                                    </p>

                                    <button
                                        onClick={() =>
                                            navigate("analysis")
                                        }
                                    >
                                        Explorar análisis
                                        <ArrowRight size={16} />
                                    </button>
                                </div>

                                <div className="hero-art">
                                    <div className="orb orb-one" />
                                    <div className="orb orb-two" />
                                    <div className="hero-reticle">
                                        <ScanLine
                                            size={90}
                                            strokeWidth={0.75}
                                        />
                                    </div>
                                </div>
                            </div>

                            {isReal ? (
                                <>
                                    <div className="section-header">
                                        <h3>
                                            Actividad del backend
                                        </h3>
                                        <span>
                                            Datos reales de SQLite
                                        </span>
                                    </div>

                                    <BackendEvents
                                        view="dashboard"
                                    />
                                </>
                            ) : (
                                <>
                                    <div className="section-header">
                                        <h3>
                                            Indicadores generales
                                        </h3>
                                        <span>
                                            Datos de demostración
                                        </span>
                                    </div>

                                    <div className="metrics">
                                        {[
                                            {
                                                label:
                                                    "Análisis realizados",
                                                value: analyses.length,
                                                icon: ScanLine,
                                                color: "blue",
                                            },
                                            {
                                                label:
                                                    "Objetos detectados",
                                                value: detected,
                                                icon: Box,
                                                color: "purple",
                                            },
                                            {
                                                label:
                                                    "Alertas pendientes",
                                                value: openAlerts,
                                                icon: AlertTriangle,
                                                color: "orange",
                                            },
                                            {
                                                label:
                                                    "Confianza promedio",
                                                value:
                                                    `${averageConfidence}%`,
                                                icon: Activity,
                                                color: "green",
                                            },
                                        ].map((metric) => (
                                            <div
                                                className="metric"
                                                key={metric.label}
                                            >
                                                <div className="metric-top">
                                                    <span>
                                                        {metric.label}
                                                    </span>
                                                    <div
                                                        className={
                                                            "metric-icon " +
                                                            metric.color
                                                        }
                                                    >
                                                        <metric.icon
                                                            size={19}
                                                        />
                                                    </div>
                                                </div>

                                                <div className="metric-value">
                                                    {metric.value}
                                                </div>

                                                <div className="metric-foot">
                                                    Datos sintéticos
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}

                            <div className="dashboard-grid">
                                {!isReal && (
                                    <div className="panel chart-panel">
                                        <div className="panel-title">
                                            <div>
                                                <h3>
                                                    Actividad de análisis
                                                </h3>
                                                <p>
                                                    Registros DEMO
                                                </p>
                                            </div>
                                        </div>

                                        <div className="chart">
                                            <ResponsiveContainer
                                                width="100%"
                                                height="100%"
                                            >
                                                <AreaChart data={chart}>
                                                    <CartesianGrid
                                                        stroke="#243047"
                                                        strokeDasharray="3 5"
                                                        vertical={false}
                                                    />
                                                    <XAxis
                                                        dataKey="day"
                                                        stroke="#8290aa"
                                                    />
                                                    <YAxis
                                                        allowDecimals={false}
                                                        stroke="#8290aa"
                                                    />
                                                    <Tooltip />
                                                    <Area
                                                        type="monotone"
                                                        dataKey="value"
                                                        stroke="#719cff"
                                                        fill="#719cff33"
                                                        strokeWidth={3}
                                                    />
                                                </AreaChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>
                                )}

                                <div className="panel quick-panel">
                                    <div className="panel-title">
                                        <div>
                                            <h3>
                                                Escenarios disponibles
                                            </h3>
                                            <p>
                                                Casos de uso empresariales
                                            </p>
                                        </div>
                                        <span className="small-tag">
                                            04 módulos
                                        </span>
                                    </div>
                                    <div className="quick-list">
                                        {scenarios.map((item) => {
                                            const Icon = item.icon;

                                            return (
                                                <button
                                                    key={item.id}
                                                    type="button"
                                                    onClick={() => openScenario(item.id)}
                                                    aria-label={`Abrir ${item.title}`}
                                                >
                                                    <span className="quick-icon">
                                                        <Icon size={19} />
                                                    </span>

                                                    <span>
                                                        <b>{item.title}</b>
                                                        <small>{item.sub}</small>
                                                    </span>

                                                    <ArrowRight size={17} />
                                                </button>
                                            );
                                        })}
                                    </div>

                                </div>
                            </div>

                            {!isReal && (
                                <div className="panel recent">
                                    <div className="panel-title">
                                        <div>
                                            <h3>
                                                Actividad reciente
                                            </h3>
                                            <p>
                                                Últimos análisis DEMO
                                            </p>
                                        </div>

                                        <button
                                            className="text-button"
                                            onClick={() =>
                                                navigate("history")
                                            }
                                        >
                                            Ver historial
                                            <ArrowRight size={15} />
                                        </button>
                                    </div>

                                    {analyses.length === 0 ? (
                                        <div className="empty">
                                            <Clock3 size={26} />
                                            <b>
                                                Sin actividad reciente
                                            </b>
                                            <p>
                                                Ejecuta una demostración
                                                para generar registros.
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="rows">
                                            {analyses
                                                .slice(0, 4)
                                                .map((item) => (
                                                    <div
                                                        className="data-row"
                                                        key={item.id}
                                                    >
                                                        <ScanLine size={18} />
                                                        <div>
                                                            <b>
                                                                {
                                                                    scenarios.find(
                                                                        (s) =>
                                                                            s.id ===
                                                                            item.scenario
                                                                    )?.title
                                                                }
                                                            </b>
                                                            <small>
                                                                {formatDate(
                                                                    item.date
                                                                )}
                                                            </small>
                                                        </div>
                                                        <span className="success-tag">
                                                            <Check size={13} />
                                                            Completado
                                                        </span>
                                                    </div>
                                                ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </>
                    )}

                    {page === "analysis" && (
                        <>
                            <div className="heading">
                                <div>
                                    <div className="eyebrow">
                                        <ScanLine size={14} />
                                        ANALYSIS WORKSPACE
                                    </div>
                                    <h1>
                                        Centro de análisis visual
                                    </h1>
                                    <p>
                                        {isReal
                                            ? "Inferencia mediante cámara y YOLO."
                                            : "Escenarios sintéticos para demostración."}
                                    </p>
                                </div>

                                <span className="info-tag">
                                    <ShieldCheck size={16} />
                                    {isReal
                                        ? "MODO REAL"
                                        : "MODO DEMO"}
                                </span>
                            </div>

                            <div className="analysis-layout">
                                <div className="analysis-main">
                                    <div className="panel analysis-panel">
                                        <div className="panel-title">
                                            <div>
                                                <h3>
                                                    Escenario de análisis
                                                </h3>
                                                <p>
                                                    Selecciona un escenario
                                                </p>
                                            </div>
                                            <span className="small-tag">
                                                04 disponibles
                                            </span>
                                        </div>

                                        <div className="scenario-grid">
                                            {scenarios.map((item) => (
                                                <button
                                                    key={item.id}
                                                    type="button"
                                                    className={
                                                        "scenario-card " +
                                                        (scenario === item.id
                                                            ? "active"
                                                            : "")
                                                    }
                                                    onClick={() =>
                                                        openScenario(item.id)
                                                    }
                                                >
                                                    <item.icon
                                                        size={21}
                                                    />
                                                    <b>
                                                        {item.title}
                                                    </b>
                                                    <small>
                                                        {item.sub}
                                                    </small>

                                                    {scenario === item.id && (
                                                        <span className="scenario-check">
                                                            <Check size={12} />
                                                        </span>
                                                    )}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="panel viewer-panel">
                                        <div className="panel-title">
                                            <div>
                                                <h3>
                                                    Visor inteligente
                                                </h3>
                                                <p>
                                                    {current.title}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="environment-banner">
                                            {isReal
                                                ? "Inferencia real con YOLO. Las clases especializadas requieren modelos entrenados."
                                                : "Simulación animada: resultados sintéticos."}
                                        </div>

                                        {isReal ? (
                                            <LiveCamera
                                                key={scenario}
                                                scenario={scenario}
                                                threshold={threshold}
                                                onEvent={(count) => {
                                                    void saveRealEvent(
                                                        count
                                                    );
                                                }}
                                            />
                                        ) : (
                                            <MotionDemo
                                                scenario={scenario}
                                            />
                                        )}

                                        <div className="viewer-footer">
                                            <span>
                                                {isReal
                                                    ? "Origen: cámara real"
                                                    : "Origen: simulación"}
                                            </span>
                                            <span>
                                                {isReal
                                                    ? "YOLO · observaciones generales"
                                                    : "Datos ilustrativos"}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="analysis-side">
                                    <div className="panel controls">
                                        <div className="panel-title">
                                            <div>
                                                <h3>
                                                    Configuración
                                                </h3>
                                                <p>
                                                    Parámetros de ejecución
                                                </p>
                                            </div>
                                            <SlidersHorizontal
                                                size={18}
                                            />
                                        </div>

                                        <div className="range-title">
                                            <label className="field-label">
                                                Umbral de confianza
                                            </label>
                                            <b>{threshold}%</b>
                                        </div>

                                        <input
                                            className="range"
                                            type="range"
                                            min="20"
                                            max="99"
                                            value={threshold}
                                            onChange={(event) =>
                                                setThreshold(
                                                    Number(
                                                        event.target.value
                                                    )
                                                )
                                            }
                                        />

                                        <div className="range-label">
                                            <span>20%</span>
                                            <span>99%</span>
                                        </div>

                                        {error && (
                                            <div className="error">
                                                {error}
                                            </div>
                                        )}

                                        {!isReal && (
                                            <button
                                                type="button"
                                                className="primary run"
                                                disabled={busy}
                                                onClick={runDemo}
                                            >
                                                <Play size={17} />
                                                {busy
                                                    ? `Procesando ${progress}%`
                                                    : "Ejecutar análisis DEMO"}
                                                <ArrowRight size={16} />
                                            </button>
                                        )}

                                        {isReal && (
                                            <div className="notice">
                                                <ShieldCheck size={18} />
                                                {apiOnline &&
                                                    modelLoaded
                                                    ? "Backend conectado y modelo YOLO cargado."
                                                    : "Revisa la conexión con FastAPI y el modelo."}
                                            </div>
                                        )}

                                        <p className="disclaimer">
                                            {isReal
                                                ? "Las detecciones reales no equivalen a certificación de seguridad industrial."
                                                : "Los resultados DEMO son sintéticos."}
                                        </p>
                                    </div>

                                    <div className="panel results">
                                        <div className="panel-title">
                                            <div>
                                                <h3>
                                                    Resultados
                                                </h3>
                                                <p>
                                                    {isReal
                                                        ? "Ver detecciones sobre la cámara"
                                                        : active
                                                            ? active.id
                                                            : "Esperando ejecución"}
                                                </p>
                                            </div>
                                        </div>

                                        {isReal ? (
                                            <div className="result-empty">
                                                <ScanLine size={29} />
                                                <b>
                                                    Inferencia en vivo
                                                </b>
                                                <span>
                                                    Las cajas y etiquetas
                                                    aparecen directamente
                                                    sobre el video.
                                                </span>
                                            </div>
                                        ) : !active ? (
                                            <div className="result-empty">
                                                <ScanLine size={29} />
                                                <b>
                                                    Sin resultados
                                                </b>
                                                <span>
                                                    Ejecuta el análisis
                                                    DEMO.
                                                </span>
                                            </div>
                                        ) : (
                                            <>
                                                <div className="result-stats">
                                                    <div>
                                                        <small>
                                                            Detecciones
                                                        </small>
                                                        <b>
                                                            {
                                                                active.detections
                                                                    .length
                                                            }
                                                        </b>
                                                    </div>
                                                    <div>
                                                        <small>
                                                            Confianza media
                                                        </small>
                                                        <b>
                                                            {Math.round(
                                                                active.confidence *
                                                                100
                                                            )}
                                                            %
                                                        </b>
                                                    </div>
                                                </div>

                                                <div className="result-list">
                                                    {active.detections.map(
                                                        (item, index) => (
                                                            <div key={index}>
                                                                <span
                                                                    className="legend"
                                                                    style={{
                                                                        background:
                                                                            item.color,
                                                                    }}
                                                                />
                                                                <b>
                                                                    {item.label}
                                                                </b>
                                                                <span>
                                                                    {Math.round(
                                                                        item.confidence *
                                                                        100
                                                                    )}
                                                                    %
                                                                </span>
                                                            </div>
                                                        )
                                                    )}
                                                </div>

                                                {active.alerts.length >
                                                    0 && (
                                                        <div className="inline-alert">
                                                            <AlertTriangle
                                                                size={17}
                                                            />
                                                            {
                                                                active.alerts[0]
                                                            }
                                                        </div>
                                                    )}
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </>
                    )}

                    {page === "alerts" &&
                        (isReal ? (
                            <BackendEvents
                                view="alerts"
                            />
                        ) : (
                            <>
                                <div className="heading">
                                    <div>
                                        <div className="eyebrow">
                                            <Bell size={14} />
                                            INCIDENT MANAGEMENT
                                        </div>
                                        <h1>
                                            Centro de alertas
                                        </h1>
                                        <p>
                                            Alertas sintéticas
                                            sujetas a revisión.
                                        </p>
                                    </div>
                                    <span className="info-tag">
                                        {openAlerts} pendientes
                                    </span>
                                </div>

                                <div className="panel table-panel">
                                    <div className="panel-title">
                                        <h3>
                                            Alertas registradas
                                        </h3>

                                        <select
                                            className="filter-select"
                                            value={statusFilter}
                                            onChange={(event) =>
                                                setStatusFilter(
                                                    event.target.value
                                                )
                                            }
                                        >
                                            <option>Todos</option>
                                            <option>Nueva</option>
                                            <option>
                                                Revisada
                                            </option>
                                            <option>
                                                Cerrada
                                            </option>
                                        </select>
                                    </div>

                                    <div className="alert-list">
                                        {alerts
                                            .filter(
                                                (item) =>
                                                    statusFilter ===
                                                    "Todos" ||
                                                    item.status ===
                                                    statusFilter
                                            )
                                            .map((item) => (
                                                <div
                                                    className="alert-item"
                                                    key={item.id}
                                                >
                                                    <span
                                                        className={
                                                            "severity-icon " +
                                                            (item.severity ===
                                                                "Alta"
                                                                ? "high"
                                                                : "medium")
                                                        }
                                                    >
                                                        <AlertTriangle
                                                            size={20}
                                                        />
                                                    </span>

                                                    <div className="alert-description">
                                                        <b>
                                                            {item.message}
                                                        </b>
                                                        <small>
                                                            {formatDate(
                                                                item.date
                                                            )}
                                                        </small>
                                                    </div>

                                                    <span
                                                        className={
                                                            "status " +
                                                            item.status.toLowerCase()
                                                        }
                                                    >
                                                        {item.status}
                                                    </span>

                                                    <div className="alert-actions">
                                                        {item.status ===
                                                            "Nueva" && (
                                                                <button
                                                                    onClick={() =>
                                                                        updateAlert(
                                                                            item,
                                                                            "Revisada"
                                                                        )
                                                                    }
                                                                >
                                                                    Revisar
                                                                </button>
                                                            )}

                                                        {item.status !==
                                                            "Cerrada" && (
                                                                <button
                                                                    onClick={() =>
                                                                        updateAlert(
                                                                            item,
                                                                            "Cerrada"
                                                                        )
                                                                    }
                                                                >
                                                                    Cerrar
                                                                </button>
                                                            )}
                                                    </div>
                                                </div>
                                            ))}

                                        {alerts.length === 0 && (
                                            <div className="empty">
                                                <ShieldCheck
                                                    size={25}
                                                />
                                                <b>
                                                    Sin alertas
                                                </b>
                                                <p>
                                                    Ejecuta una
                                                    demostración.
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </>
                        ))}

                    {page === "history" &&
                        (isReal ? (
                            <BackendEvents
                                view="history"
                            />
                        ) : (
                            <>
                                <div className="heading">
                                    <div>
                                        <div className="eyebrow">
                                            <Database size={14} />
                                            AUDIT & REPORTING
                                        </div>
                                        <h1>
                                            Historial y reportes
                                        </h1>
                                        <p>
                                            Registro de análisis
                                            sintéticos.
                                        </p>
                                    </div>

                                    <button
                                        className="primary"
                                        onClick={exportCsv}
                                    >
                                        <ArrowDownToLine
                                            size={17}
                                        />
                                        Exportar CSV
                                    </button>
                                </div>

                                <div className="panel table-panel">
                                    <div className="panel-title">
                                        <h3>
                                            Registro de análisis
                                        </h3>

                                        <div className="searchbox">
                                            <Search size={16} />
                                            <input
                                                placeholder="Buscar..."
                                                value={filter}
                                                onChange={(event) =>
                                                    setFilter(
                                                        event.target.value
                                                    )
                                                }
                                            />
                                        </div>
                                    </div>

                                    <div className="table-scroll">
                                        <table>
                                            <thead>
                                                <tr>
                                                    <th>ID</th>
                                                    <th>ESCENARIO</th>
                                                    <th>FECHA</th>
                                                    <th>
                                                        DETECCIONES
                                                    </th>
                                                    <th>
                                                        CONFIANZA
                                                    </th>
                                                    <th>ACCIÓN</th>
                                                </tr>
                                            </thead>

                                            <tbody>
                                                {analyses
                                                    .filter((item) =>
                                                        (
                                                            item.id +
                                                            " " +
                                                            item.scenario
                                                        )
                                                            .toLowerCase()
                                                            .includes(
                                                                filter.toLowerCase()
                                                            )
                                                    )
                                                    .map((item) => (
                                                        <tr key={item.id}>
                                                            <td>
                                                                {item.id}
                                                            </td>
                                                            <td>
                                                                {
                                                                    scenarios.find(
                                                                        (s) =>
                                                                            s.id ===
                                                                            item.scenario
                                                                    )?.title
                                                                }
                                                            </td>
                                                            <td>
                                                                {formatDate(
                                                                    item.date
                                                                )}
                                                            </td>
                                                            <td>
                                                                {
                                                                    item.detections
                                                                        .length
                                                                }
                                                            </td>
                                                            <td>
                                                                {Math.round(
                                                                    item.confidence *
                                                                    100
                                                                )}
                                                                %
                                                            </td>
                                                            <td>
                                                                <button
                                                                    className="text-button"
                                                                    onClick={() => {
                                                                        openScenario(
                                                                            item.scenario
                                                                        );
                                                                        setActive(
                                                                            item
                                                                        );
                                                                    }}
                                                                >
                                                                    Ver
                                                                    <ArrowRight
                                                                        size={14}
                                                                    />
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </>
                        ))}

                    {page === "settings" && (
                        <>
                            <div className="heading">
                                <div>
                                    <div className="eyebrow">
                                        <Settings2 size={14} />
                                        CONFIGURATION
                                    </div>
                                    <h1>
                                        Configuración
                                    </h1>
                                    <p>
                                        Parámetros de VISION AI.
                                    </p>
                                </div>
                            </div>

                            <div className="settings-grid">
                                <div className="panel controls">
                                    <div className="panel-title">
                                        <h3>
                                            Motor de visión
                                        </h3>
                                        <Zap size={20} />
                                    </div>

                                    <div className="setting-row">
                                        <span>
                                            Entorno activo
                                        </span>
                                        <b>
                                            {isReal
                                                ? "REAL"
                                                : "DEMO"}
                                        </b>
                                    </div>

                                    <div className="setting-row">
                                        <span>
                                            Backend
                                        </span>
                                        <b>
                                            {apiOnline
                                                ? "Conectado"
                                                : "Desconectado"}
                                        </b>
                                    </div>

                                    <div className="setting-row">
                                        <span>
                                            Modelo general
                                        </span>
                                        <b>
                                            {modelLoaded
                                                ? "Cargado"
                                                : "No disponible"}
                                        </b>
                                    </div>

                                    <div className="range-title">
                                        <label className="field-label">
                                            Confianza mínima
                                        </label>
                                        <b>
                                            {threshold}%
                                        </b>
                                    </div>

                                    <input
                                        className="range"
                                        type="range"
                                        min="20"
                                        max="99"
                                        value={threshold}
                                        onChange={(event) =>
                                            setThreshold(
                                                Number(
                                                    event.target.value
                                                )
                                            )
                                        }
                                    />
                                </div>

                                <div className="panel controls">
                                    <div className="panel-title">
                                        <h3>
                                            Acerca de VISION AI
                                        </h3>
                                        <ShieldCheck
                                            size={20}
                                        />
                                    </div>

                                    <div className="setting-row">
                                        <span>
                                            Versión
                                        </span>
                                        <b>2.0</b>
                                    </div>

                                    <div className="setting-row">
                                        <span>
                                            Frontend
                                        </span>
                                        <b>
                                            React + TypeScript
                                        </b>
                                    </div>

                                    <div className="setting-row">
                                        <span>
                                            Backend
                                        </span>
                                        <b>
                                            FastAPI + YOLO
                                        </b>
                                    </div>

                                    <div className="setting-row">
                                        <span>
                                            Escenarios
                                        </span>
                                        <b>4</b>
                                    </div>

                                    <div className="notice">
                                        <AlertTriangle
                                            size={18}
                                        />
                                        Los modelos industriales
                                        especializados todavía
                                        requieren entrenamiento
                                        y validación.
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </main>

                <footer>
                    © 2026 VISION AI · Enterprise
                    Intelligence Platform
                    <span>
                        {isReal
                            ? "ENTORNO REAL · YOLO"
                            : "ENTORNO DEMO"}
                    </span>
                </footer>
            </div>

            {toast && (
                <div className="toast">
                    <CheckCircle2 size={18} />
                    {toast}
                    <button
                        type="button"
                        onClick={() =>
                            setToast("")
                        }
                    >
                        <X size={15} />
                    </button>
                </div>
            )}
        </div>
    );
}

function App() {
    const [user, setUser] = useState<AuthUser | null>(null);

    function handleLogin(
        token: string,
        nextUser: AuthUser
    ) {
        setAccessToken(token);
        setUser(nextUser);
    }

    function handleLogout() {
        setAccessToken(null);
        setUser(null);
    }

    if (!user) {
        return <Login onLogin={handleLogin} />;
    }

    return (
        <DashboardApp
            user={user}
            onLogout={handleLogout}
        />
    );
}


createRoot(
    document.getElementById("root")!
).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
);
