# Anacleto Pro 🚀
### Plataforma SaaS Enterprise de Presupuestos, Facturación, CRM y Dibujo Técnico CAD con IA (Gemini 2.5)

Anacleto Pro es una solución full-stack moderna y de alto rendimiento diseñada para talleres de carpintería de aluminio, vidrio arquitectónico y mobiliario a medida. Integra un agente de IA en tiempo real para presupuestos y facturación, persistencia multi-colección en Firebase Firestore, y un motor de **Dibujo Técnico 2D** interactivo con cotas, despiece tipo puzzle y visualización en 5 fases de construcción.

---

## 🌟 Características Principales

### 1. Dashboard Principal
- **Sidebar lateral interactivo** con navegación fluida entre:
  - **Dashboard**: Vista general con 4 tarjetas resumen (Total Presupuestos, Facturas Emitidas, Empresas Registradas, Dibujos Generados), KPIs financieros y actividad reciente.
  - **CRM (Empresas)**: Registro y gestión de clientes y colaboradores, con datos fiscales (NIF/CIF), persona de contacto y acceso directo para crear presupuestos.
  - **Presupuestos**: Cotizador dinámico con ítems, subtotales, IVA configurable, descuentos y botón de exportación a PDF oficial.
  - **Facturas**: Libro de facturación con numeración correlativa automática (`FAC-2026-001`), gestión de estados (Pendiente / Pagada) y exportación a PDF.
  - **Dibujo Técnico**: Motor CAD interactivo de dos paneles (instrucciones IA + lienzo SVG escalable con zoom/pan) y despiece con cotas en 5 fases.
  - **Configuración**: Edición de datos de emisor (razón social, NIF, IBAN bancario, moneda, etc.).

### 2. Agente de IA para Presupuestos y Facturas (Gemini 2.5)
- Describe en lenguaje natural los trabajos y el agente generará automáticamente:
  - Descripción técnica, cantidad, precio unitario de mercado y subtotal.
  - Recálculo en vivo de base imponible, impuestos y total.
- Responde a comandos interactivos como:
  - *"cambia el IVA al 21%"*
  - *"añade un descuento del 10%"*
  - *"genera la factura de este presupuesto"*
  - *"añade 2 ventanas correderas de 150x120"*

### 3. Módulo "Dibujo Técnico" (Motor CAD 2D en 5 Fases)
- Describe cualquier pieza (ej: *"una mesa de madera de 120x80x75 cm con 4 patas"*, *"un armario de 2 puertas de 180x60x200 cm"*, *"una pieza en L de 90x90 cm con un corte a 45°"*).
- Visualización interactiva en SVG con zoom, arrastre (pan), cotas numéricas legibles y flechas de cota:
  - **Paso 1: Definición de dimensiones generales** (envolvente perimetral y cotas generales ancho × alto × profundidad).
  - **Paso 2: Despiece** (lista de componentes rotulados como *"Pieza 1 - Tablero superior"*, *"Pieza 2 - Pata izquierda"*, medidas y cantidades).
  - **Paso 3: Corte de cada pieza con sus cotas** (patrón de corte individual, ángulos a 45° o 90° y tolerancias).
  - **Paso 4: Ensamblaje tipo puzzle** (vista explosionada con flechas de unión y orden secuencial de montaje).
  - **Paso 5: Resultado final** (render técnico 100% ensamblado, acabado y cotas finales).
- **Exportar dibujo a PDF** con un solo clic incluyendo la memoria técnica completa y todas las especificaciones.

---

## 🛠️ Stack Tecnológico
- **Frontend**: React 19, TypeScript, Vite, TailwindCSS.
- **Backend / Proxy**: Node.js, Express, `server.ts` con `@google/genai` TypeScript SDK (modelos Gemini 2.5 Flash).
- **Persistencia & Auth**: Firebase Firestore (colecciones `companies`, `quotes`, `invoices`, `technical_drawings`, `ledger`, `sender_config`).
- **Exportación PDF**: `jsPDF` + `jspdf-autotable`.

---

## 🚀 Ejecución Local

1. **Instalar dependencias**:
   ```bash
   npm install
   ```

2. **Variables de entorno**:
   Copia el archivo de ejemplo a `.env.local`:
   ```bash
   cp .env.example .env.local
   ```
   Configura tu clave de Gemini:
   ```env
   GEMINI_API_KEY="AIzaSy..."
   ```

3. **Iniciar el servidor de desarrollo**:
   ```bash
   npm run dev
   ```
   Abre [http://localhost:3000](http://localhost:3000) en tu navegador.

---

## 📦 Despliegue en Vercel

La aplicación está preparada para despliegue en Vercel mediante `vercel.json` y el script `vercel-build`:

1. Conecta tu repositorio de GitHub a Vercel.
2. Añade la variable de entorno `GEMINI_API_KEY` en el panel de Vercel (**Settings > Environment Variables**).
3. Despliega con:
   ```bash
   vercel --prod
   ```
