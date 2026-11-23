import { authHeaders } from './auth';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity, AlertTriangle, ArrowRight, Box,
  HardHat, PackageCheck, ScanLine, ShoppingBag
} from 'lucide-react';
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer,
  Tooltip, XAxis, YAxis
} from 'recharts';

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000';

type EventStatus = 'Nueva' | 'Revisada' | 'Cerrada';
type EventRow = {
  id: string;
  timestamp: string;
  scenario: string;
  source: string;
  severity: string;
  message: string;
  detections: number;
  status: EventStatus;
};

type Scenario = 'industrial' | 'warehouse' | 'quality' | 'retail';

type Props = {
  view: 'dashboard' | 'alerts' | 'history';
  onScenario?: (scenario: Scenario) => void;
};

const scenarios = [
  { id: 'industrial', title: 'Seguridad industrial', sub: 'Detección de equipos de protección', icon: HardHat },
  { id: 'warehouse', title: 'Almacén inteligente', sub: 'Monitoreo de zonas restringidas', icon: Box },
  { id: 'quality', title: 'Control de calidad', sub: 'Inspección de productos', icon: PackageCheck },
  { id: 'retail', title: 'Retail analytics', sub: 'Ocupación y actividad', icon: ShoppingBag }
] as const;

const titles: Record<string, string> = Object.fromEntries(
  scenarios.map(s => [s.id, s.title])
);

export default function BackendEvents({ view, onScenario }: Props) {
  const [rows, setRows] = useState<EventRow[]>([]);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('Todos');
  const [busy, setBusy] = useState('');

  const refresh = useCallback(async () => {
    try {
      const response = await fetch(`${API.replace(/\/$/, "")}/api/v1/events?limit=500`, { headers: authHeaders() });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data: EventRow[] = await response.json();
      setRows(data.filter(r => r.source === 'CAMARA_REAL'));
      setError('');
    } catch (e) {
      setError(`No se pudo consultar FastAPI: ${String(e)}`);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 5000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const totalObjects = useMemo(
    () => rows.reduce((sum, r) => sum + r.detections, 0),
    [rows]
  );

  const pending = rows.filter(r => r.status === 'Nueva').length;

  const chartData = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(now);
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() - (6 - index));

      const next = new Date(date);
      next.setDate(next.getDate() + 1);

      return {
        day: date.toLocaleDateString('es-PE', { weekday: 'short' }),
        events: rows.filter(r => {
          const t = new Date(r.timestamp).getTime();
          return t >= date.getTime() && t < next.getTime();
        }).length
      };
    });
  }, [rows]);

  async function change(id: string, status: EventStatus) {
    setBusy(id);
    try {
      const response = await fetch(`${API.replace(/\/$/, "")}/api/v1/events/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ status })
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      await refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy('');
    }
  }

  function exportCsv() {
    const header = [
      'ID', 'Fecha', 'Escenario', 'Origen',
      'Severidad', 'Mensaje', 'Detecciones', 'Estado'
    ];

    const data = rows.map(r => [
      r.id, r.timestamp, titles[r.scenario] || r.scenario,
      r.source, r.severity, r.message, r.detections, r.status
    ]);

    const csv = '\ufeff' + [header, ...data]
      .map(row => row.map(v =>
        '"' + String(v).replace(/"/g, '""') + '"'
      ).join(','))
      .join('\r\n');

    const url = URL.createObjectURL(
      new Blob([csv], { type: 'text/csv;charset=utf-8' })
    );

    const a = document.createElement('a');
    a.href = url;
    a.download = 'vision-ai-real-events.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  const filtered = rows.filter(
    r => filter === 'Todos' || r.status === filter
  );

  if (view === 'dashboard') {
    const metrics = [
      {
        label: 'Análisis registrados',
        value: rows.length,
        note: 'Observaciones guardadas',
        icon: ScanLine,
        color: 'blue'
      },
      {
        label: 'Objetos detectados',
        value: totalObjects,
        note: 'Suma de detecciones registradas',
        icon: Box,
        color: 'purple'
      },
      {
        label: 'Alertas pendientes',
        value: pending,
        note: 'Observaciones por revisar',
        icon: AlertTriangle,
        color: 'orange'
      },
      {
        label: 'Confianza promedio',
        value: '—',
        note: 'No almacenada por el backend',
        icon: Activity,
        color: 'green'
      }
    ];

    return (
      <div className="real-dashboard">
        <div className="section-header">
          <h3>Indicadores generales</h3>
          <span>Datos reales · FastAPI + SQLite</span>
        </div>

        <div className="metrics real-metrics">
          {metrics.map(m => (
            <div className="metric" key={m.label}>
              <div className="metric-top">
                <span>{m.label}</span>
                <div className={`metric-icon ${m.color}`}>
                  <m.icon size={19} />
                </div>
              </div>
              <div className="metric-value">{m.value}</div>
              <div className="metric-foot">
                <span className="tiny-dot" />
                {m.note}
              </div>
            </div>
          ))}
        </div>

        <div className="dashboard-grid real-dashboard-grid">
          <section className="panel chart-panel">
            <div className="panel-title">
              <div>
                <h3>Actividad de análisis</h3>
                <p>Observaciones de cámara registradas en los últimos 7 días</p>
              </div>
              <span className="small-tag">Últimos 7 días</span>
            </div>

            <div className="chart">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="realChartGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#49c9ff" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#49c9ff" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#263c5b" strokeDasharray="3 5" vertical={false} />
                  <XAxis dataKey="day" tick={{ fill: '#91a7c8', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fill: '#91a7c8', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: '#12213b', border: '1px solid #315a85', borderRadius: 10, color: '#fff' }} />
                  <Area type="monotone" dataKey="events" name="Eventos" stroke="#49c9ff" strokeWidth={3} fill="url(#realChartGradient)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="panel quick-panel">
            <div className="panel-title">
              <div>
                <h3>Escenarios disponibles</h3>
                <p>Casos de uso empresariales</p>
              </div>
              <span className="small-tag">04 módulos</span>
            </div>

            <div className="quick-list">
              {scenarios.map(s => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => onScenario?.(s.id)}
                >
                  <span className="quick-icon"><s.icon size={19} /></span>
                  <span>
                    <b>{s.title}</b>
                    <small>{s.sub}</small>
                  </span>
                  <ArrowRight size={17} />
                </button>
              ))}
            </div>
          </section>
        </div>

        <div className="real-events-heading">
          <h3>Actividad reciente</h3>
          <button className="outline" onClick={() => void refresh()}>
            Actualizar
          </button>
        </div>

        {error && <p className="live-error">{error}</p>}

        <div className="panel real-recent">
          {rows.length === 0 ? (
            <div className="empty">
              <b>Sin actividad reciente</b>
              <p>Las observaciones aparecerán cuando la cámara registre detecciones.</p>
            </div>
          ) : (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>FECHA</th>
                    <th>ESCENARIO</th>
                    <th>EVENTO</th>
                    <th>OBJETOS</th>
                    <th>ESTADO</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 5).map(r => (
                    <tr key={r.id}>
                      <td>{new Date(r.timestamp).toLocaleString('es-PE')}</td>
                      <td>{titles[r.scenario] || r.scenario}</td>
                      <td>{r.message}</td>
                      <td>{r.detections}</td>
                      <td>
                        <span className={`status ${r.status.toLowerCase()}`}>
                          {r.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <section className="panel real-events-panel">
      <div className="panel-title">
        <div>
          <h3>
            {view === 'alerts'
              ? 'Alertas y observaciones del backend'
              : 'Historial persistente del backend'}
          </h3>
          <p>Eventos de cámara real · SQLite · actualización cada 5 segundos</p>
        </div>
        <button className="outline" onClick={() => void refresh()}>
          Actualizar
        </button>
      </div>

      {error && <p className="live-error">{error}</p>}

      <div className="real-event-toolbar">
        <span className="small-tag">{rows.length} eventos</span>
        <span className="small-tag">{pending} pendientes</span>

        <select
          className="filter-select"
          value={filter}
          onChange={e => setFilter(e.target.value)}
        >
          {['Todos', 'Nueva', 'Revisada', 'Cerrada'].map(s => (
            <option key={s}>{s}</option>
          ))}
        </select>

        {view === 'history' && (
          <button className="outline" onClick={exportCsv}>
            Exportar CSV
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="empty">
          <b>No hay eventos para mostrar</b>
          <p>Los registros aparecerán cuando existan observaciones que coincidan con el filtro.</p>
        </div>
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>FECHA</th>
                <th>ESCENARIO</th>
                <th>ORIGEN</th>
                <th>EVENTO</th>
                <th>OBJETOS</th>
                <th>ESTADO</th>
                {view === 'alerts' && <th>REVISIÓN</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 100).map(r => (
                <tr key={r.id}>
                  <td>{new Date(r.timestamp).toLocaleString('es-PE')}</td>
                  <td>{titles[r.scenario] || r.scenario}</td>
                  <td>Cámara · YOLO</td>
                  <td>{r.message}</td>
                  <td>{r.detections}</td>
                  <td>
                    <span className={`status ${r.status.toLowerCase()}`}>
                      {r.status}
                    </span>
                  </td>
                  {view === 'alerts' && (
                    <td>
                      <div className="real-row-actions">
                        {r.status === 'Nueva' && (
                          <button
                            className="outline"
                            disabled={busy === r.id}
                            onClick={() => void change(r.id, 'Revisada')}
                          >
                            Revisar
                          </button>
                        )}
                        {r.status !== 'Cerrada' && (
                          <button
                            className="outline"
                            disabled={busy === r.id}
                            onClick={() => void change(r.id, 'Cerrada')}
                          >
                            Cerrar
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
