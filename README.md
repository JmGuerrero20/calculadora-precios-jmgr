# Calculadora de Precios JMGR

Aplicación web para apoyar la fijación de precios en droguerías colombianas. Convierte el costo de compra en precios sugeridos, considerando IVA, margen, competencia, PMV, promociones y venta fraccionada por caja, blíster y unidad.

## Qué hace

- Calcula precio mínimo seguro, Cost-Plus, competitivo, premium y promocional.
- Admite productos vendidos por caja, blíster y unidad.
- Valida que el fraccionamiento sea exacto.
- Evita recomendaciones que superen un PMV ingresado.
- Explica tipo de producto y sensibilidad de precio para personal no financiero.
- Guarda configuración e historial de cálculos localmente en el navegador.
- Permite recuperar cálculos y copiar precios sugeridos.

## Uso

1. Ingresa el costo de compra, IVA, tipo y sensibilidad.
2. Activa **Caja, blíster y unidad** cuando el producto se venda fraccionado.
3. Añade competencia, PMV o descuento solo cuando los conozcas.
4. Selecciona **Calcular precio**.

> El PMV debe verificarse para la misma presentación comercial. Esta herramienta apoya la decisión de precio; no sustituye la validación tributaria o regulatoria.

## Tecnologías

- React
- TypeScript
- Vite
- CSS responsive
- localStorage para configuración e historial local

## Desarrollo local

```bash
npm install
npm run dev
```

## Autor

Elaborado por Juan Manuel Guerrero.

