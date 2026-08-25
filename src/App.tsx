import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import "./App.css";

type ProductType = "A" | "B" | "C";
type Sensitivity = "Alta" | "Media" | "Baja";
type SaleMode = "single" | "fractioned";
type Format = "Caja" | "Blíster" | "Unidad";
type Inputs = { name: string; cost: string; vat: string; type: ProductType; sensitivity: Sensitivity; competitor1: string; competitor2: string; pmv: string; discount: string; saleMode: SaleMode; unitsPerBox: string; unitsPerBlister: string; referenceFormat: Format };
type Settings = { minimumMargin: string; marginA: string; marginB: string; marginC: string; typeDeltaA: string; typeDeltaB: string; typeDeltaC: string; sensitivityHigh: string; sensitivityMedium: string; sensitivityLow: string };
type Price = { cost: number; minimum: number; costPlus: number; competitive: number | null; premium: number; recommended: number; promo: number | null; profit: number; margin: number; promoNotice: string | null };
type FormatPrice = { format: Format; units: number; price: Price };
type Calculation = { formats: FormatPrice[]; explanation: string };
type HistoryItem = { id: string; savedAt: string; inputs: Inputs; settings: Settings; calculation: Calculation };

const initialInputs: Inputs = { name: "", cost: "", vat: "19", type: "B", sensitivity: "Media", competitor1: "", competitor2: "", pmv: "", discount: "", saleMode: "single", unitsPerBox: "", unitsPerBlister: "", referenceFormat: "Caja" };
const initialSettings: Settings = { minimumMargin: "10", marginA: "12", marginB: "20", marginC: "30", typeDeltaA: "-1", typeDeltaB: "0", typeDeltaC: "3", sensitivityHigh: "-2", sensitivityMedium: "0", sensitivityLow: "2" };
const helpType: Record<ProductType, string> = { A: "Se vende con frecuencia: puede funcionar con menor margen por mayor volumen.", B: "Salida normal: es la opción equilibrada para la mayoría de productos.", C: "Salida baja o especialidad: necesita mayor margen por vencimiento y dinero inmovilizado." };
const helpSensitivity: Record<Sensitivity, string> = { Alta: "El cliente compara precios; se busca ser más competitivo.", Media: "Equilibrio entre precio, disponibilidad y servicio. Recomendada si tienes duda.", Baja: "El cliente prioriza disponibilidad o confianza más que comparar el precio." };
const n = (value: string) => Number(value) || 0;
const copy = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const money = (value: number) => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(value);
const stored = <T,>(key: string, fallback: T): T => { try { return JSON.parse(localStorage.getItem(key) ?? "") as T; } catch { return fallback; } };
const roundedPrice = (price: number, cap: number) => { const result = price < 1000 ? Math.ceil(price / 10) * 10 : Math.ceil((price - 900) / 1000) * 1000 + 900; return cap > 0 && result > cap ? Math.min(price, cap) : result; };

function priceFor(cost: number, inputs: Inputs, settings: Settings, reference: boolean): Price | { error: string } {
  const vat = n(inputs.vat) / 100;
  const minMargin = n(settings.minimumMargin) / 100;
  const targets: Record<ProductType, number> = { A: n(settings.marginA) / 100, B: n(settings.marginB) / 100, C: n(settings.marginC) / 100 };
  const typeDeltas: Record<ProductType, number> = { A: n(settings.typeDeltaA) / 100, B: n(settings.typeDeltaB) / 100, C: n(settings.typeDeltaC) / 100 };
  const sensitivityDeltas: Record<Sensitivity, number> = { Alta: n(settings.sensitivityHigh) / 100, Media: n(settings.sensitivityMedium) / 100, Baja: n(settings.sensitivityLow) / 100 };
  if (minMargin < 0 || minMargin >= 1 || targets[inputs.type] < 0 || targets[inputs.type] >= 1) return { error: "Los márgenes deben estar entre 0% y 99%." };
  const minimum = (cost / (1 - minMargin)) * (1 + vat);
  const costPlus = (cost / (1 - targets[inputs.type])) * (1 + vat);
  const cap = reference ? n(inputs.pmv) : 0;
  const competitors = reference ? [n(inputs.competitor1), n(inputs.competitor2)].filter((value) => value > 0) : [];
  const lowest = competitors.length ? Math.min(...competitors) : null;
  const competitive = lowest ? lowest * (1 + typeDeltas[inputs.type] + sensitivityDeltas[inputs.sensitivity]) : null;
  if (cap > 0 && cap < minimum) return { error: `El PMV (${money(cap)}) es menor que el mínimo seguro (${money(minimum)}).` };
  let base = competitive ? Math.max(minimum, Math.min(costPlus, competitive)) : costPlus;
  if (cap > 0) base = Math.min(base, cap);
  const recommended = roundedPrice(base, cap);
  if (recommended < minimum) return { error: "No se encontró un precio que cumpla el margen mínimo y el PMV." };
  const discount = n(inputs.discount) / 100;
  if (discount < 0 || discount >= 1) return { error: "El descuento debe estar entre 0% y 99%." };
  const rawPromo = discount > 0 ? Math.ceil(recommended * (1 - discount) / 100) * 100 : null;
  const promo = rawPromo ? Math.max(minimum, rawPromo) : null;
  const net = recommended / (1 + vat);
  return { cost, minimum, costPlus, competitive, premium: (competitive ?? costPlus) * 1.02, recommended, promo, profit: net - cost, margin: (net - cost) / net, promoNotice: rawPromo && rawPromo < minimum ? `El descuento se ajustó al mínimo seguro: ${money(minimum)}.` : null };
}

function calculate(inputs: Inputs, settings: Settings): Calculation | { error: string } {
  const boxCost = n(inputs.cost);
  if (boxCost <= 0) return { error: "Ingresa un costo de compra mayor que cero." };
  const formats: { format: Format; units: number; cost: number }[] = [];
  if (inputs.saleMode === "fractioned") {
    const units = n(inputs.unitsPerBox); const perBlister = n(inputs.unitsPerBlister);
    if (!Number.isInteger(units) || !Number.isInteger(perBlister) || units <= 0 || perBlister <= 0) return { error: "Ingresa cantidades enteras de unidades por caja y por blíster." };
    if (units % perBlister !== 0) return { error: `La caja tiene ${units} unidades y no se puede dividir exactamente en blísteres de ${perBlister}.` };
    formats.push({ format: "Caja", units, cost: boxCost }, { format: "Blíster", units: perBlister, cost: boxCost / units * perBlister }, { format: "Unidad", units: 1, cost: boxCost / units });
  } else formats.push({ format: "Caja", units: 1, cost: boxCost });
  const calculated: FormatPrice[] = [];
  for (const item of formats) {
    const outcome = priceFor(item.cost, inputs, settings, item.format === inputs.referenceFormat || inputs.saleMode === "single");
    if ("error" in outcome) return { error: `${item.format}: ${outcome.error}` };
    calculated.push({ format: item.format, units: item.units, price: outcome });
  }
  const referenceName = inputs.saleMode === "fractioned" ? `La competencia y el PMV se aplicaron a ${inputs.referenceFormat.toLowerCase()}.` : "La competencia y el PMV se aplicaron a esta presentación.";
  return { formats: calculated, explanation: `${referenceName} Los demás precios se calcularon con costo proporcional y margen seguro.` };
}

export default function App() {
  const [inputs, setInputs] = useState<Inputs>(copy(initialInputs));
  const [settings, setSettings] = useState<Settings>(() => stored("jmgr-price-settings", copy(initialSettings)));
  const [snapshot, setSnapshot] = useState<{ inputs: Inputs; settings: Settings } | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>(() => stored("jmgr-price-history", []));
  const [showSettings, setShowSettings] = useState(false); const [copied, setCopied] = useState<string | null>(null);
  useEffect(() => { localStorage.setItem("jmgr-price-settings", JSON.stringify(settings)); }, [settings]);
  useEffect(() => { localStorage.setItem("jmgr-price-history", JSON.stringify(history)); }, [history]);
  const result = useMemo(() => snapshot ? calculate(snapshot.inputs, snapshot.settings) : null, [snapshot]);
  const pending = snapshot && JSON.stringify(snapshot.inputs) !== JSON.stringify(inputs);
  const input = <K extends keyof Inputs>(key: K, value: Inputs[K]) => setInputs((current) => ({ ...current, [key]: value }));
  const setting = <K extends keyof Settings>(key: K, value: Settings[K]) => setSettings((current) => ({ ...current, [key]: value }));
  const submit = (event: FormEvent) => { event.preventDefault(); setSnapshot({ inputs: copy(inputs), settings: copy(settings) }); };
  const reset = () => { setInputs(copy(initialInputs)); setSnapshot(null); };
  const save = () => { if (!snapshot || !result || "error" in result) return; setHistory((items) => [{ id: crypto.randomUUID(), savedAt: new Date().toLocaleString("es-CO"), inputs: copy(snapshot.inputs), settings: copy(snapshot.settings), calculation: result }, ...items].slice(0, 20)); };
  const restore = (item: HistoryItem) => { setInputs(copy(item.inputs)); setSettings(copy(item.settings)); setSnapshot({ inputs: copy(item.inputs), settings: copy(item.settings) }); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const copyPrice = async (format: Format, value: number) => { await navigator.clipboard.writeText(String(Math.round(value))); setCopied(format); window.setTimeout(() => setCopied(null), 1600); };
  const numberField = (label: string, key: "cost" | "competitor1" | "competitor2" | "pmv" | "discount" | "unitsPerBox" | "unitsPerBlister", placeholder: string, optional = false) => <label className={optional ? "optional-field" : "required-field"}>{label}<span className={optional ? "optional-badge" : "required-badge"}>{optional ? "Opcional" : "Obligatorio"}</span><input type="number" min="0" inputMode="decimal" value={inputs[key]} onChange={(e) => input(key, e.target.value)} placeholder={placeholder} /></label>;
  const settingField = (label: string, key: keyof Settings) => <label>{label}<input type="number" value={settings[key]} onChange={(e) => setting(key, e.target.value)} /></label>;

  return <main className="app"><section className="calculator"><header className="brand-header"><div className="brand-row"><div className="brand-mark">JM</div><div><p className="eyebrow">HERRAMIENTA DE PRECIOS</p><p className="brand-name">JMGR · DROGUERÍA</p></div></div><span className="status-pill">PRECIO SEGURO</span><div className="hero-copy"><h1>Define el precio <em>correcto.</em></h1><p>Calcula precios rentables para caja, blíster y unidad sin usar fórmulas.</p></div></header>
    <form onSubmit={submit}><section className="input-section"><div className="section-heading required-heading"><div><p>1 · DATOS OBLIGATORIOS</p><h2>Completa estos campos primero</h2></div><span>Sin estos datos no se puede calcular un precio seguro.</span></div><div className="form-grid">
      {numberField(inputs.saleMode === "fractioned" ? "Costo de compra de la caja" : "Costo neto unitario", "cost", "Ej.: 5000")}
      <label className="required-field">IVA de venta<span className="required-badge">Obligatorio</span><select value={inputs.vat} onChange={(e) => input("vat", e.target.value)}><option value="0">0%</option><option value="5">5%</option><option value="19">19%</option></select></label>
      <label className="required-field">Tipo de producto<span className="required-badge">Obligatorio</span><select value={inputs.type} onChange={(e) => input("type", e.target.value as ProductType)}><option value="A">A · Alta rotación</option><option value="B">B · Rotación media</option><option value="C">C · Baja rotación / especialidad</option></select><small className="field-help">{helpType[inputs.type]}</small></label>
      <label className="required-field">Sensibilidad de precio<span className="required-badge">Obligatorio</span><select value={inputs.sensitivity} onChange={(e) => input("sensitivity", e.target.value as Sensitivity)}><option value="Alta">Alta · Cliente compara precio</option><option value="Media">Media · Equilibrada</option><option value="Baja">Baja · Menos sensible</option></select><small className="field-help">{helpSensitivity[inputs.sensitivity]}</small></label>
      <label className="optional-field">Nombre del producto <span className="optional-badge">Opcional</span><input value={inputs.name} onChange={(e) => input("name", e.target.value)} placeholder="Ej.: Acetaminofén 500 mg" /></label>
    </div>
    <section className="fraction-section"><div><p>FORMA DE VENTA</p><h3>¿Este producto se fracciona?</h3><span>Activa esta opción solo si compras por caja y vendes por blíster o por unidad.</span></div><div className="mode-control"><button type="button" className={inputs.saleMode === "single" ? "mode-option active" : "mode-option"} onClick={() => input("saleMode", "single")}>Solo caja</button><button type="button" className={inputs.saleMode === "fractioned" ? "mode-option active" : "mode-option"} onClick={() => input("saleMode", "fractioned")}>Caja, blíster y unidad</button></div></section>
    {inputs.saleMode === "fractioned" && <section className="fraction-details"><div className="section-heading required-heading"><div><p>1.1 · FRACCIONAMIENTO</p><h2>¿Cómo viene la caja?</h2></div><span>Estos datos también son obligatorios para calcular las tres presentaciones.</span></div><div className="form-grid">{numberField("Unidades que trae la caja", "unitsPerBox", "Ej.: 100")}{numberField("Unidades por blíster", "unitsPerBlister", "Ej.: 10")}<label className="required-field">Competencia y PMV corresponden a<span className="required-badge">Obligatorio</span><select value={inputs.referenceFormat} onChange={(e) => input("referenceFormat", e.target.value as Format)}><option>Caja</option><option>Blíster</option><option>Unidad</option></select><small className="field-help">Usa la misma presentación del precio que viste en el competidor o en el PMV.</small></label></div>{n(inputs.unitsPerBox) > 0 && n(inputs.unitsPerBlister) > 0 && n(inputs.unitsPerBox) % n(inputs.unitsPerBlister) === 0 && <div className="fraction-preview">Esta caja equivale a <strong>{n(inputs.unitsPerBox) / n(inputs.unitsPerBlister)} blísteres de {n(inputs.unitsPerBlister)} unidades</strong>, para un total de <strong>{n(inputs.unitsPerBox)} unidades</strong>.</div>}</section>}
    <section className="reference-section"><div className="section-heading optional-heading"><div><p>2 · DATOS OPCIONALES</p><h2>Competencia, regulación y promociones</h2></div><span>Mejoran la recomendación, pero puedes calcular sin ellos.</span></div><div className="form-grid">{numberField("Precio competidor 1", "competitor1", "Ej.: 8500", true)}{numberField("Precio competidor 2", "competitor2", "Ej.: 9000", true)}<label className="optional-field pmv-field">PMV / precio máximo regulado<span className="optional-badge">Opcional</span><input type="number" min="0" inputMode="decimal" value={inputs.pmv} onChange={(e) => input("pmv", e.target.value)} placeholder="Ej.: 10000" /><small className="field-help">Úsalo solo si este producto tiene un Precio Máximo de Venta (PMV) confirmado. Es el valor final máximo permitido: la calculadora nunca lo superará. Si no aplica o no lo conoces, déjalo vacío. Verifica que corresponda a esta misma presentación.</small></label>{numberField("Descuento promocional %", "discount", "Ej.: 10", true)}</div></section>
    </section><div className="actions"><button type="button" className="secondary" onClick={() => setShowSettings((value) => !value)}>⚙ Ajustar parámetros</button><button type="button" className="secondary" onClick={reset}>Limpiar</button><button className="calculate-button" type="submit">Calcular precio →</button></div></form>
    {showSettings && <section className="settings"><div className="settings-title"><div><p>CONFIGURACIÓN</p><h2>Reglas de precio</h2></div><span>Se guardan automáticamente en este navegador.</span></div><div className="settings-grid">{settingField("Margen mínimo %", "minimumMargin")}{settingField("Margen objetivo tipo A %", "marginA")}{settingField("Margen objetivo tipo B %", "marginB")}{settingField("Margen objetivo tipo C %", "marginC")}{settingField("Ajuste competencia tipo A %", "typeDeltaA")}{settingField("Ajuste competencia tipo B %", "typeDeltaB")}{settingField("Ajuste competencia tipo C %", "typeDeltaC")}{settingField("Ajuste sensibilidad alta %", "sensitivityHigh")}{settingField("Ajuste sensibilidad media %", "sensitivityMedium")}{settingField("Ajuste sensibilidad baja %", "sensitivityLow")}</div></section>}
    {pending && <div className="alert pending">Hay cambios sin calcular. Presiona <strong>“Calcular precio”</strong> para actualizar.</div>}
    {result && "error" in result && <div className="alert error">{result.error}</div>}
    {result && !("error" in result) && <section className="result"><p>{result.formats.length > 1 ? "PRECIOS RECOMENDADOS" : "PRECIO RECOMENDADO"}{snapshot?.inputs.name ? ` · ${snapshot.inputs.name}` : ""}</p>{result.formats.length === 1 ? <h2>{money(result.formats[0].price.recommended)}</h2> : <h2>3 presentaciones listas</h2>}<div className="result-actions">{result.formats.length === 1 && <button type="button" onClick={() => copyPrice(result.formats[0].format, result.formats[0].price.recommended)}>{copied === result.formats[0].format ? "✓ Precio copiado" : "Copiar precio"}</button>}<button type="button" className="save-button" onClick={save}>Guardar cálculo</button></div><p className="explanation">{result.explanation}</p><div className={result.formats.length > 1 ? "format-results" : "result-grid"}>{result.formats.map((item) => <article className={result.formats.length > 1 ? "format-card" : "single-card"} key={item.format}><span>{item.format}{item.units > 1 ? ` · ${item.units} unidades` : ""}</span><strong className="format-price">{money(item.price.recommended)}</strong>{result.formats.length > 1 && <button type="button" onClick={() => copyPrice(item.format, item.price.recommended)}>{copied === item.format ? "✓ Copiado" : "Copiar precio"}</button>}<small>Costo: {money(item.price.cost)} · Margen: {(item.price.margin * 100).toFixed(1)}%</small><small>Mínimo seguro: {money(item.price.minimum)}</small>{item.price.promo && <small>Promoción: {money(item.price.promo)}</small>}{item.price.promoNotice && <small className="warning-text">{item.price.promoNotice}</small>}</article>)}</div>{result.formats.length === 1 && <div className="result-grid secondary-results"><div><span>Cost-Plus</span><strong>{money(result.formats[0].price.costPlus)}</strong></div><div><span>Competitivo</span><strong>{result.formats[0].price.competitive ? money(result.formats[0].price.competitive) : "Sin dato"}</strong></div><div><span>Premium</span><strong>{money(result.formats[0].price.premium)}</strong></div><div><span>Promoción</span><strong>{result.formats[0].price.promo ? money(result.formats[0].price.promo) : "No aplica"}</strong></div><div><span>Ganancia / margen</span><strong>{money(result.formats[0].price.profit)} · {(result.formats[0].price.margin * 100).toFixed(1)}%</strong></div></div>}</section>}
    {history.length > 0 && <section className="history"><div className="history-title"><div><p>HISTORIAL LOCAL</p><h2>Últimos cálculos</h2></div><button type="button" className="link-button danger" onClick={() => setHistory([])}>Borrar todo</button></div>{history.map((item) => <div className="history-item" key={item.id}><button type="button" className="history-load" onClick={() => restore(item)}><div><strong>{item.inputs.name || "Producto sin nombre"}</strong><small>{item.savedAt} · {item.calculation.formats.length > 1 ? "Caja, blíster y unidad" : "Caja"}</small></div><strong>{money(item.calculation.formats[0].price.recommended)}</strong></button><button type="button" className="remove-button" aria-label="Eliminar cálculo" onClick={() => setHistory((items) => items.filter((entry) => entry.id !== item.id))}>×</button></div>)}</section>}
  </section><footer>Elaborado por <strong>Juan Manuel Guerrero</strong></footer></main>;
}

