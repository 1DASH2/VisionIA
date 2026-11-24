
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

type DemoBox = { label: string; confidence: number; x: number; y: number; w: number; h: number; alert?: boolean };

const demoDetections: Record<Scenario, DemoBox[][]> = {
    industrial: [
        [{ label: "persona", confidence: 96, x: 172, y: 88, w: 150, h: 198 }, { label: "casco", confidence: 92, x: 214, y: 90, w: 67, h: 39 }, { label: "chaleco", confidence: 94, x: 199, y: 153, w: 97, h: 81 }, { label: "persona", confidence: 93, x: 485, y: 88, w: 145, h: 198 }, { label: "sin casco", confidence: 90, x: 513, y: 88, w: 80, h: 47, alert: true }],
        [{ label: "persona", confidence: 95, x: 172, y: 88, w: 150, h: 198 }, { label: "casco", confidence: 91, x: 214, y: 90, w: 67, h: 39 }, { label: "chaleco", confidence: 93, x: 199, y: 153, w: 97, h: 81 }, { label: "persona", confidence: 94, x: 485, y: 88, w: 145, h: 198 }, { label: "EPP incompleto", confidence: 89, x: 490, y: 153, w: 133, h: 83, alert: true }],
    ],
    warehouse: [
        [{ label: "pallet", confidence: 92, x: 70, y: 210, w: 260, h: 42 }, { label: "caja", confidence: 95, x: 92, y: 116, w: 78, h: 90 }, { label: "caja", confidence: 93, x: 178, y: 116, w: 77, h: 90 }, { label: "montacargas", confidence: 91, x: 412, y: 154, w: 206, h: 140, alert: true }],
        [{ label: "pallet", confidence: 91, x: 70, y: 210, w: 260, h: 42 }, { label: "caja", confidence: 94, x: 92, y: 116, w: 78, h: 90 }, { label: "caja", confidence: 95, x: 178, y: 116, w: 77, h: 90 }, { label: "intrusión zona", confidence: 88, x: 412, y: 154, w: 206, h: 140, alert: true }],
    ],
    quality: [
        [{ label: "producto conforme", confidence: 97, x: 105, y: 131, w: 145, h: 105 }, { label: "producto", confidence: 96, x: 328, y: 131, w: 145, h: 105 }, { label: "defecto", confidence: 88, x: 373, y: 157, w: 54, h: 48, alert: true }, { label: "producto conforme", confidence: 95, x: 552, y: 131, w: 145, h: 105 }],
        [{ label: "producto conforme", confidence: 98, x: 105, y: 131, w: 145, h: 105 }, { label: "NO CONFORME", confidence: 92, x: 328, y: 131, w: 145, h: 105, alert: true }, { label: "grieta", confidence: 89, x: 373, y: 157, w: 54, h: 48, alert: true }, { label: "producto conforme", confidence: 96, x: 552, y: 131, w: 145, h: 105 }],
    ],
    retail: [
        [{ label: "estante", confidence: 94, x: 42, y: 63, w: 191, h: 211 }, { label: "producto", confidence: 91, x: 68, y: 105, w: 61, h: 56 }, { label: "persona", confidence: 96, x: 302, y: 89, w: 124, h: 203 }, { label: "persona", confidence: 93, x: 444, y: 105, w: 117, h: 187 }, { label: "estante", confidence: 95, x: 582, y: 63, w: 183, h: 211 }],
        [{ label: "estante", confidence: 94, x: 42, y: 63, w: 191, h: 211 }, { label: "producto", confidence: 92, x: 68, y: 105, w: 61, h: 56 }, { label: "persona", confidence: 97, x: 302, y: 89, w: 124, h: 203 }, { label: "persona", confidence: 94, x: 444, y: 105, w: 117, h: 187 }, { label: "ocupación alta", confidence: 87, x: 292, y: 82, w: 278, h: 217, alert: true }],
    ],
};

function MotionDemo({ scenario }: { scenario: Scenario }) {
    const [active, setActive] = useState(true);
    const [sample, setSample] = useState(0);
    useEffect(() => { setSample(0); setActive(true); }, [scenario]);
    useEffect(() => {
        if (!active) return;
        const timer = window.setInterval(() => setSample((n) => n + 1), 2400);
        return () => window.clearInterval(timer);
    }, [active]);
    const current = scenarios.find((item) => item.id === scenario)!;
    const boxes = demoDetections[scenario][sample % 2];
    const hasAlert = boxes.some((box) => box.alert);
    return (
        <div className="motion-demo detection-demo">
            <div className="motion-head">
                <div><strong><span className="pulse-dot" /> VISOR DE DETECCIÓN · DEMO</strong>
                    <small>{current.title} · Escena ilustrada fija, recuadros y datos sintéticos. NO es inferencia real.</small></div>
                <span className="motion-live">{active ? "● SIMULACIÓN ACTIVA" : "Ⅱ PAUSADA"}</span>
            </div>
            <svg className="motion-stage detection-stage" viewBox="0 0 800 350" role="img" aria-label={`Visor de detección simulada de ${current.title}`}>
                <defs><linearGradient id="cameraBg" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#20394e"/><stop offset="1" stopColor="#101e2e"/></linearGradient></defs>
                <rect width="800" height="350" fill="url(#cameraBg)" />
                <path d="M0 285H800V350H0Z" fill="#34465a" />
                {scenario === "industrial" && <>
                    <path d="M70 280V65H130M670 280V65H725" stroke="#52697b" strokeWidth="13" fill="none" />
                    {[247, 558].map((x, i) => <g key={i}>
                        <path d={`M${x-20} 230L${x-32} 286M${x+20} 230L${x+32} 286`} stroke="#657e97" strokeWidth="18" />
                        <rect x={x-37} y="152" width="74" height="81" rx="9" fill={i ? "#456d9a" : "#d7a644"} />
                        <path d={`M${x-37} 169L${x+37} 207M${x+37} 169L${x-37} 207`} stroke={i ? "#7c93ab" : "#e6ef8c"} strokeWidth="8" />
                        <circle cx={x} cy="115" r="29" fill="#d6a987" />
                        {!i && <path d={`M${x-32} 112Q${x} 63 ${x+32} 112Z`} fill="#f2d04b" />}
                    </g>)}
                </>}
                {scenario === "warehouse" && <>
                    <rect x="45" y="76" width="300" height="180" fill="#4c6174" />
                    {[0,1,2].map(r => <g key={r}><rect x="52" y={128+r*53} width="285" height="9" fill="#9cabb5" />
                        {[0,1,2].map(c => <rect key={c} x={80+c*88} y={88+r*53} width="66" height="37" fill="#ae845b" />)}</g>)}
                    <rect x="70" y="249" width="260" height="12" fill="#92724c" />
                    <path d="M535 175H750V290H535Z" fill="#e69c3820" stroke="#ffb25c" strokeWidth="3" strokeDasharray="9 6" />
                    <text x="552" y="194" fill="#ffbd73" fontSize="15">ZONA RESTRINGIDA</text>
                    <rect x="440" y="220" width="140" height="55" rx="9" fill="#d99d39" />
                    <path d="M520 220V160H588V274" fill="none" stroke="#d99d39" strokeWidth="11" />
                    <circle cx="468" cy="279" r="17" fill="#111e2b" /><circle cx="559" cy="279" r="17" fill="#111e2b" />
                </>}
                {scenario === "quality" && <>
                    <rect x="25" y="225" width="750" height="58" rx="10" fill="#667a8b" />
                    {[0,1,2].map(i => <g key={i}><rect x={105+i*223} y="132" width="145" height="104" rx="7" fill={i===1 ? "#bf906e" : "#82a7b6"} />
                        <rect x={119+i*223} y="145" width="117" height="76" rx="4" fill={i===1 ? "#d6aa87" : "#a9c6cf"} /></g>)}
                    <path d="M388 163L404 179L385 193L416 204" fill="none" stroke="#8e302c" strokeWidth="6" />
                    {[80,220,360,500,640].map(x => <circle key={x} cx={x} cy="268" r="7" fill="#2b4054" />)}
                </>}
                {scenario === "retail" && <>
                    {[43,583].map(x => <g key={x}><rect x={x} y="63" width="181" height="211" fill="#506477" />
                        {[0,1,2].map(r => <g key={r}><rect x={x+9} y={110+r*55} width="163" height="8" fill="#9ba9b2" />
                            {[0,1,2,3].map(c => <rect key={c} x={x+18+c*38} y={81+r*55} width="26" height="27" fill={c%2 ? "#d8a565" : "#82a9bf"} />)}</g>)}</g>)}
                    {[365,501].map((x,i) => <g key={i}><circle cx={x} cy="119" r="26" fill="#cda78c" />
                        <rect x={x-33} y="150" width="66" height="80" rx="9" fill={i ? "#b86c7b" : "#4c93b8"} />
                        <path d={`M${x-17} 230L${x-23} 285M${x+17} 230L${x+23} 285`} stroke="#7f94a9" strokeWidth="15" /></g>)}
                </>}
                <rect x="10" y="10" width="226" height="29" rx="5" fill="#081623cc" />
                <text x="20" y="30" fill="#bde9fb" fontSize="13">VISION IA · CÁMARA VIRTUAL DEMO</text>
                {boxes.map((box, index) => {
                    const color = box.alert ? "#ffad66" : "#46e0c1";
                    const labelWidth = Math.min(210, Math.max(94, box.label.length * 8 + 53));
                    const labelY = box.y > 44 ? box.y - 26 : box.y;
                    return <g key={`${index}-${box.label}`}>
                        <rect x={box.x} y={box.y} width={box.w} height={box.h} fill="none" stroke={color} strokeWidth="3" />
                        <rect x={box.x} y={labelY} width={labelWidth} height="25" fill={color} rx="2" />
                        <text x={box.x+6} y={labelY+17} fill="#09202b" fontSize="14" fontWeight="700">{box.label} {box.confidence}%</text>
                    </g>;
                })}
                <rect x="12" y="313" width="776" height="26" rx="5" fill="#061524e6" />
                <text x="23" y="331" fill="#b8d6ea" fontSize="12">SIMULACIÓN · {boxes.length} DETECCIONES · MUESTRA {sample+1} · SIN CÁMARA NI VIDEO</text>
            </svg>
            <div className="demo-status"><span>{hasAlert ? "⚠ Alerta simulada: revisar detección" : "✓ Sin alertas simuladas"}</span><span>{boxes.length} objetos · Confianza sintética</span></div>
            <div className="motion-controls">
                <button type="button" onClick={() => setActive(v => !v)}>{active ? "Ⅱ Pausar" : "▶ Reanudar"}</button>
                <button type="button" onClick={() => setSample(n => n+1)}>↻ Nueva detección</button>
                <span>La escena es fija; solo cambian los resultados simulados.</span>
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
                    `${API.replace(/\/$/, "")}/api/v1/health`
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
                `${API.replace(/\/$/, "")}/api/v1/events`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        ...authHeaders(),
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
                                                : "Visor de detección simulado: escena fija, recuadros y resultados sintéticos (sin video)."}
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
