import jsPDF from 'jspdf';
import 'jspdf-autotable';

// ════════════════════════════════════════════════════════════════════════
// SISTEMA DE DISEÑO — tokens de marca reutilizados en TODOS los documentos
// (equivalente a variables CSS, pero para dibujo directo en jsPDF)
// ════════════════════════════════════════════════════════════════════════
const BRAND = {
  primary:    [30, 126, 52],   // verde marca
  primaryLt:  [240, 248, 240], // verde muy claro (fondos)
  border:     [223, 223, 223], // líneas sutiles
  borderLt:   [237, 237, 237],
  textDark:   [35, 35, 35],
  textMid:    [95, 95, 95],
  textLight:  [150, 150, 150],
  warning:    [196, 92, 12],   // saldo pendiente
  white:      [255, 255, 255],
  font: 'helvetica',
};

const fmt = n => `$${Number(n||0).toLocaleString('es-CO')}`;
const fmtDate = d => d ? new Date(d+'T12:00').toLocaleDateString('es-CO') : '';
// Hora SIEMPRE en formato AM/PM — nunca militar/24h, en ningún documento
const fmtHora12 = t => {
  if (!t) return '';
  const [hh, mm] = t.split(':').map(Number);
  const ampm = hh >= 12 ? 'p.m.' : 'a.m.';
  let h12 = hh % 12; if (h12 === 0) h12 = 12;
  return `${h12}:${String(mm).padStart(2,'0')} ${ampm}`;
};
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

// ── Número a letras (pesos colombianos) ─────────────────────────────────
const UNIDADES = ['', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve'];
const DECENAS = ['', '', 'veinte', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
const ESPECIALES = { 10:'diez',11:'once',12:'doce',13:'trece',14:'catorce',15:'quince',16:'dieciséis',17:'diecisiete',18:'dieciocho',19:'diecinueve',21:'veintiuno',22:'veintidós',23:'veintitrés',24:'veinticuatro',25:'veinticinco',26:'veintiséis',27:'veintisiete',28:'veintiocho',29:'veintinueve' };
const CENTENAS = ['', 'cien', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos'];

function convertirGrupo(n) {
  if (n === 0) return '';
  if (n === 100) return 'cien';
  let resultado = '';
  const c = Math.floor(n / 100);
  const resto = n % 100;
  if (c > 0) resultado += CENTENAS[c] + ' ';
  if (ESPECIALES[resto]) {
    resultado += ESPECIALES[resto];
  } else {
    const d = Math.floor(resto / 10);
    const u = resto % 10;
    if (d > 0) { resultado += DECENAS[d]; if (u > 0) resultado += ' y ' + UNIDADES[u]; }
    else if (u > 0) { resultado += UNIDADES[u]; }
  }
  return resultado.trim();
}

function numeroALetras(num) {
  num = Math.round(num);
  if (num === 0) return 'cero pesos';
  const millones = Math.floor(num / 1000000);
  const miles = Math.floor((num % 1000000) / 1000);
  const resto = num % 1000;
  let partes = [];
  if (millones > 0) partes.push(millones === 1 ? 'un millón' : convertirGrupo(millones) + ' millones');
  if (miles > 0) {
    let textoMiles = convertirGrupo(miles).replace(/^uno$/, 'un').replace(/veintiuno$/, 'veintiún');
    partes.push(miles === 1 ? 'mil' : textoMiles + ' mil');
  }
  if (resto > 0) partes.push(convertirGrupo(resto));
  let texto = partes.join(' ').trim();
  texto = texto.charAt(0).toUpperCase() + texto.slice(1);
  return texto + ' pesos ML';
}

// Nombre de archivo: individual incluye empresa, en lote usa fecha
function nombreArchivo(prefijo, pedidos) {
  const fecha = new Date().toISOString().slice(0,10);
  if (pedidos.length === 1) {
    const limpio = (pedidos[0].nombre_empresa || 'Cliente')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '').slice(0, 40);
    return `${prefijo}_${limpio}.pdf`;
  }
  return `${prefijo}_Lote_${fecha}.pdf`;
}

// El domicilio es un item más dentro de pedido_items (nombre_producto = 'Domicilio').
const totalPedido = (items) => items.reduce((s,i)=>s+(i.subtotal||0),0);

// ── Carga de imágenes remotas como dataURL (logo y fotos de producto) ──────
const imageCache = new Map();
async function loadImageDataUrl(url) {
  if (!url) return null;
  if (imageCache.has(url)) return imageCache.get(url);
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    imageCache.set(url, dataUrl);
    return dataUrl;
  } catch (e) { return null; }
}
function detectFormat(dataUrl) {
  if (!dataUrl) return 'JPEG';
  if (dataUrl.startsWith('data:image/png')) return 'PNG';
  if (dataUrl.startsWith('data:image/webp')) return 'WEBP';
  return 'JPEG';
}
function getImageDimensions(dataUrl) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.width, h: img.height });
    img.onerror = () => resolve({ w: 1, h: 1 });
    img.src = dataUrl;
  });
}
function fitBox(natW, natH, maxSize) {
  const ratio = natW / natH;
  if (ratio >= 1) return { w: maxSize, h: maxSize / ratio };
  return { w: maxSize * ratio, h: maxSize };
}
const dimCache = new Map();
async function preloadAllImages(urls) {
  const unicas = [...new Set(urls.filter(Boolean))];
  await Promise.all(unicas.map(async (url) => {
    const dataUrl = await loadImageDataUrl(url);
    if (dataUrl) dimCache.set(url, await getImageDimensions(dataUrl));
  }));
}
async function prepararLogo(config) {
  if (!config.logo_url) return null;
  const dataUrl = await loadImageDataUrl(config.logo_url);
  if (!dataUrl) return null;
  const dim = await getImageDimensions(dataUrl);
  return { dataUrl, format: detectFormat(dataUrl), dim };
}

// ════════════════════════════════════════════════════════════════════════
// HEADER CORPORATIVO — usado idéntico en los 5 documentos.
// Estructura: [logo] Nombre / NIT·Dirección / Tel·Email  ······  [caja tipo+No.]
// con una sola línea divisoria verde al final que atraviesa todo el ancho.
// ════════════════════════════════════════════════════════════════════════
function renderCorporateHeader(doc, { config, logo, x, y, pageW, marginRight, fontScale = 1, docType, docNumber, docDate }) {
  const fs = fontScale;
  const logoSize = 13 * fs;
  const topY = y;

  // Logo (proporción respetada, nunca deformado)
  let xTexto = x;
  if (logo) {
    const box = fitBox(logo.dim.w, logo.dim.h, logoSize);
    try { doc.addImage(logo.dataUrl, logo.format, x, topY - box.h * 0.6, box.w, box.h); } catch(e) {}
    xTexto = x + box.w + 3;
  }

  // Bloque de texto del negocio — 3 líneas compactas
  let ty = topY;
  doc.setTextColor(...BRAND.primary); doc.setFont(BRAND.font, 'bold'); doc.setFontSize(11.5 * fs);
  doc.text(config.nombre_negocio || 'Natilla Medellín', xTexto, ty);
  ty += 4 * fs;
  doc.setFont(BRAND.font, 'normal'); doc.setFontSize(7 * fs); doc.setTextColor(...BRAND.textMid);
  const l2 = [config.nit ? `NIT: ${config.nit}` : '', config.direccion || ''].filter(Boolean).join('   ·   ');
  if (l2) { doc.text(l2, xTexto, ty); ty += 3.3 * fs; }
  const l3 = [config.telefono ? `Tel: ${config.telefono}` : '', config.email || ''].filter(Boolean).join('   ·   ');
  if (l3) { doc.text(l3, xTexto, ty); ty += 3.3 * fs; }

  // Caja del tipo de documento, alineada arriba a la derecha
  let boxBottom = topY;
  if (docType) {
    const boxW = Math.max(38, doc.getTextWidth(docType) + 14) * fs;
    const boxX = pageW - marginRight - boxW;
    const boxTop = topY - 5.5 * fs;
    const boxH = (docDate ? 17 : 13) * fs;
    doc.setFillColor(...BRAND.primaryLt);
    doc.rect(boxX, boxTop, boxW, boxH, 'F');
    doc.setTextColor(...BRAND.primary); doc.setFont(BRAND.font, 'bold'); doc.setFontSize(6.8 * fs);
    doc.text(docType.toUpperCase(), boxX + boxW/2, boxTop + 4.2 * fs, { align:'center', charSpace: 0.3 });
    doc.setFontSize(11.5 * fs);
    doc.text(docNumber || '', boxX + boxW/2, boxTop + 10 * fs, { align:'center' });
    if (docDate) {
      doc.setFont(BRAND.font, 'normal'); doc.setFontSize(6 * fs); doc.setTextColor(...BRAND.textMid);
      doc.text(docDate, boxX + boxW/2, boxTop + 14.3 * fs, { align:'center' });
    }
    boxBottom = boxTop + boxH;
  }

  const bottom = Math.max(ty, boxBottom) + 2 * fs;
  doc.setDrawColor(...BRAND.primary); doc.setLineWidth(0.5);
  doc.line(x, bottom, pageW - marginRight, bottom);
  return bottom + 3.5 * fs;
}

// Pie de página corporativo — pequeño, no compite con el contenido
function renderCorporateFooter(doc, { config, x, pageW, y, fontScale = 1 }) {
  const mensaje = (config.mensaje || '').trim();
  if (!mensaje) return;
  doc.setDrawColor(...BRAND.borderLt); doc.setLineWidth(0.3);
  doc.line(x, y - 3 * fontScale, pageW - x, y - 3 * fontScale);
  doc.setTextColor(...BRAND.textLight); doc.setFontSize(6 * fontScale); doc.setFont(BRAND.font, 'normal');
  doc.text(mensaje, (pageW) / 2, y, { align: 'center', maxWidth: pageW - x * 2 });
}

// Bloque de totales con jerarquía visual (usado en Recibo y Cuenta de Cobro)
function renderFinancialSummary(doc, { x, right, y, total, pagado, saldo, fontScale = 1 }) {
  const fs = fontScale;
  doc.setFont(BRAND.font, 'bold'); doc.setFontSize(9 * fs); doc.setTextColor(...BRAND.primary);
  doc.text('TOTAL', x, y);
  doc.text(fmt(total), right, y, { align: 'right' });
  y += 5 * fs;

  if (pagado > 0) {
    doc.setFont(BRAND.font, 'normal'); doc.setFontSize(7.5 * fs); doc.setTextColor(...BRAND.textMid);
    doc.text('Pagado', x, y);
    doc.setTextColor(...BRAND.primary);
    doc.text(fmt(pagado), right, y, { align: 'right' });
    y += 4.5 * fs;
  }

  doc.setDrawColor(...BRAND.borderLt); doc.setLineWidth(0.3);
  doc.line(x, y - 2 * fs, right, y - 2 * fs);

  if (saldo > 0) {
    doc.setFont(BRAND.font, 'bold'); doc.setFontSize(9.5 * fs); doc.setTextColor(...BRAND.warning);
    doc.text('SALDO PENDIENTE', x, y + 1.5 * fs);
    doc.text(fmt(saldo), right, y + 1.5 * fs, { align: 'right' });
    y += 6 * fs;
  } else {
    doc.setFont(BRAND.font, 'bold'); doc.setFontSize(8.5 * fs); doc.setTextColor(...BRAND.primary);
    doc.text('PAGADO COMPLETO', (x + right) / 2, y + 1.5 * fs, { align: 'center' });
    y += 6 * fs;
  }
  return y;
}

// Estilos de tabla compartidos — consistentes en todos los documentos
const tableTheme = (fs = 1) => ({
  styles: { font: BRAND.font, fontSize: 8 * fs, cellPadding: 2 * fs, textColor: BRAND.textDark, lineColor: BRAND.borderLt, lineWidth: 0.15 },
  headStyles: { fillColor: BRAND.primary, textColor: 255, fontStyle: 'bold', fontSize: 7.6 * fs, halign: 'left' },
  footStyles: { fontStyle: 'bold', fillColor: BRAND.primaryLt, textColor: BRAND.textDark, fontSize: 8 * fs },
  alternateRowStyles: { fillColor: [250, 252, 250] },
});

// ════════════════════════════════════════════════════════════════════════
// REMISIÓN / ORDEN DE DESPACHO — media carta horizontal (216×140mm)
// ════════════════════════════════════════════════════════════════════════
function renderOrden(doc, pedido, items, config, logo) {
  const W = 216, H = 140, M = 9;
  doc.setDrawColor(...BRAND.border); doc.setLineWidth(0.4);
  doc.rect(M, M, W-M*2, H-M*2);

  const fr = new Date(pedido.fecha_registro||Date.now());
  let y = renderCorporateHeader(doc, {
    config, logo, x: M+3, y: M+7, pageW: W, marginRight: M+3,
    docType: 'Remisión', docNumber: `No. ${String(pedido.consecutivo).padStart(4,'0')}`,
    docDate: `${fr.getDate()}/${fr.getMonth()+1}/${fr.getFullYear()}`,
  });

  doc.setTextColor(...BRAND.textDark); doc.setFontSize(8);
  const campo = (l, v, lx, vx) => { doc.setFont(BRAND.font,'bold'); doc.text(l, lx, y); doc.setFont(BRAND.font,'normal'); doc.text(v||'', vx, y); };
  campo('SEÑOR(ES):', pedido.nombre_empresa, M+3, M+27);
  y += 5;
  campo('DIRECCIÓN:', pedido.direccion, M+3, M+27);
  y += 5;
  doc.setFont(BRAND.font,'bold'); doc.text('TEL:', M+3, y);
  doc.setFont(BRAND.font,'normal'); doc.text(pedido.telefono||'', M+13, y);
  doc.setFont(BRAND.font,'bold'); doc.text('ENTREGA:', M+58, y);
  doc.setFont(BRAND.font,'normal');
  doc.text(`${fmtDate(pedido.fecha_entrega)} ${fmtHora12(pedido.hora_entrega)}`, M+78, y);
  y += 4;

  doc.autoTable({
    startY: y,
    margin: {left:M+3, right:M+3},
    head:[['CANT.','DESCRIPCIÓN','VR. UNITARIO','VR. TOTAL']],
    body: items.map(i=>[i.cantidad, i.nombre_producto, fmt(i.precio_unitario), fmt(i.subtotal)]),
    foot: [['','','TOTAL', fmt(totalPedido(items))]],
    ...tableTheme(),
    columnStyles:{0:{cellWidth:16,halign:'center'},2:{cellWidth:30,halign:'right'},3:{cellWidth:30,halign:'right'}},
  });

  const ay = doc.lastAutoTable.finalY+5;
  doc.setFontSize(7.3); doc.setTextColor(...BRAND.textDark);
  doc.setFont(BRAND.font,'bold'); doc.text('DESPACHADO POR:', M+3, ay);
  doc.setDrawColor(...BRAND.border); doc.line(M+30, ay, M+68, ay);
  doc.text('MENSAJERO:', M+73, ay);
  doc.setFont(BRAND.font,'normal'); doc.text(pedido.domiciliarios?.nombre||'', M+92, ay);
  doc.setFont(BRAND.font,'bold'); doc.text('RECIBIDO POR:', M+3, ay+6);
  doc.line(M+27, ay+6, M+68, ay+6);
  doc.setFont(BRAND.font,'normal'); doc.setTextColor(...BRAND.textMid);
  doc.text(pedido.tiene_anticipo?'Con anticipo':'Sin anticipo', M+73, ay+6);

  renderCorporateFooter(doc, { config, x: M+3, pageW: W, y: H-M-3 });
}

export async function imprimirOrdenes(pedidos, itemsPorPedido, config) {
  if(!pedidos.length) return;
  const logo = await prepararLogo(config);
  const doc = new jsPDF({orientation:'landscape', unit:'mm', format:[216,140]});
  pedidos.forEach((p,i) => {
    if(i>0) doc.addPage([216,140],'landscape');
    renderOrden(doc, p, itemsPorPedido[p.id]||[], config, logo);
  });
  doc.save(nombreArchivo('Orden', pedidos));
}

// ════════════════════════════════════════════════════════════════════════
// COMANDA DE PRODUCCIÓN — media carta horizontal. Sin precios: solo cocina.
// ════════════════════════════════════════════════════════════════════════
function renderComanda(doc, pedido, items, config, logo) {
  const itemsProduccion = items.filter(i => i.nombre_producto !== 'Domicilio');
  const W = 216, H = 140, M = 9;
  doc.setDrawColor(...BRAND.border); doc.setLineWidth(0.4);
  doc.rect(M, M, W-M*2, H-M*2);

  let y = renderCorporateHeader(doc, {
    config, logo, x: M+3, y: M+7, pageW: W, marginRight: M+3,
    docType: 'Comanda', docNumber: `No. ${String(pedido.consecutivo).padStart(4,'0')}`,
  });

  doc.setTextColor(...BRAND.textDark); doc.setFontSize(8.5);
  doc.setFont(BRAND.font,'bold'); doc.text(`Cliente: ${pedido.nombre_empresa}`, M+3, y);
  doc.setFont(BRAND.font,'normal');
  doc.text(`Entrega: ${fmtDate(pedido.fecha_entrega)}  ·  Hora: ${fmtHora12(pedido.hora_entrega) || '-'}`, M+3, y+5);
  y += 10;

  doc.autoTable({
    startY: y,
    margin: {left:M+3, right:M+3},
    head:[['PRODUCTO','CANTIDAD']],
    body: itemsProduccion.map(i=>[i.nombre_producto, `${i.cantidad} und`]),
    ...tableTheme(1.05),
    columnStyles:{1:{halign:'center', cellWidth:40, fontStyle:'bold', textColor:BRAND.primary}},
  });

  const ay = doc.lastAutoTable.finalY+5;
  if(pedido.observaciones){
    doc.setFontSize(8); doc.setFont(BRAND.font,'bold'); doc.setTextColor(...BRAND.warning);
    doc.text('OBSERVACIONES:', M+3, ay);
    doc.setFont(BRAND.font,'normal'); doc.setTextColor(...BRAND.textDark);
    doc.text(pedido.observaciones, M+3, ay+5, { maxWidth: W-M*2-6 });
  }

  renderCorporateFooter(doc, { config, x: M+3, pageW: W, y: H-M-3 });
}

export async function imprimirComandas(pedidos, itemsPorPedido, config) {
  if(!pedidos.length) return;
  const logo = await prepararLogo(config);
  const doc = new jsPDF({orientation:'landscape', unit:'mm', format:[216,140]});
  pedidos.forEach((p,i) => {
    if(i>0) doc.addPage([216,140],'landscape');
    renderComanda(doc, p, itemsPorPedido[p.id]||[], config, logo);
  });
  doc.save(nombreArchivo('Comanda', pedidos));
}

// ════════════════════════════════════════════════════════════════════════
// RECIBO DE CAJA — media carta vertical (140×216mm), muy compacto
// ════════════════════════════════════════════════════════════════════════
export async function imprimirRecibos(pedidos, pagosPorPedido, itemsPorPedido, config) {
  if(!pedidos.length) return;
  const logo = await prepararLogo(config);
  const doc = new jsPDF({orientation:'portrait', unit:'mm', format:[140,216]});

  pedidos.forEach((pedido, idx) => {
    if(idx>0) doc.addPage([140,216],'portrait');
    const W=140, M=7;
    const pagos = pagosPorPedido[pedido.id]||[];
    const items = itemsPorPedido[pedido.id]||[];
    const total = totalPedido(items);
    const totalPagado = pagos.reduce((s,p)=>s+(p.monto||0),0);
    const saldo = total - totalPagado;

    let y = renderCorporateHeader(doc, {
      config, logo, x: M, y: M+6, pageW: W, marginRight: M,
      docType: 'Recibo de Caja', docNumber: `No. ${String(pedido.consecutivo).padStart(4,'0')}`,
      docDate: fmtDate(new Date().toISOString().slice(0,10)),
      fontScale: 0.85,
    });

    doc.autoTable({
      startY: y,
      margin: {left:M, right:M},
      theme: 'grid',
      body: [
        [`NIT/CC: ${pedido.tipo_documento||''} ${pedido.numero_documento||''}`, `Entrega: ${fmtDate(pedido.fecha_entrega)}`],
        [`Cliente: ${pedido.nombre_empresa||''}`, `Hora: ${fmtHora12(pedido.hora_entrega)}`],
        [`Contacto: ${pedido.nombre_contacto||''}`, `Tel: ${pedido.telefono||''}`],
      ],
      styles: { font: BRAND.font, fontSize:6, cellPadding:1.4, textColor:BRAND.textDark, lineColor:BRAND.borderLt, lineWidth:0.15 },
      columnStyles: { 0:{cellWidth:(W-M*2)*0.55}, 1:{cellWidth:(W-M*2)*0.45} },
    });
    doc.autoTable({
      startY: doc.lastAutoTable.finalY,
      margin: {left:M, right:M},
      theme: 'grid',
      body: [[`Dirección: ${pedido.direccion||''}`]],
      styles: { font: BRAND.font, fontSize:6, cellPadding:1.4, textColor:BRAND.textDark, lineColor:BRAND.borderLt, lineWidth:0.15 },
    });
    y = doc.lastAutoTable.finalY + 4;

    doc.autoTable({
      startY: y,
      margin: {left:M, right:M},
      head: [['CANT','DESCRIPCIÓN','P.UNIT','TOTAL']],
      body: items.map(i => [i.cantidad, i.nombre_producto, fmt(i.precio_unitario), fmt(i.subtotal)]),
      ...tableTheme(0.85),
      columnStyles:{ 0:{cellWidth:11,halign:'center'}, 1:{cellWidth:'auto'}, 2:{cellWidth:17,halign:'right'}, 3:{cellWidth:19,halign:'right'} },
      tableWidth: W-M*2,
    });
    y = doc.lastAutoTable.finalY + 5;

    if (pagos.length) {
      doc.setFontSize(6.3); doc.setTextColor(...BRAND.textMid); doc.setFont(BRAND.font,'bold');
      doc.text('PAGOS REGISTRADOS', M, y); y += 3.6;
      doc.setFont(BRAND.font,'normal'); doc.setTextColor(...BRAND.textDark);
      pagos.forEach(p => {
        const tipoMostrar = p.tipo === 'Pago Normal' ? 'Pago Total' : p.tipo;
        doc.text(`${p.metodo} · ${tipoMostrar}`, M, y);
        doc.text(fmt(p.monto), W-M, y, {align:'right'});
        y += 3.6;
      });
      y += 2;
    }

    y = renderFinancialSummary(doc, { x: M, right: W-M, y, total, pagado: totalPagado, saldo, fontScale: 0.85 });

    // Firmas manuales
    y += 6;
    doc.setFontSize(6.5); doc.setTextColor(...BRAND.textDark); doc.setFont(BRAND.font,'normal');
    doc.text('Despachado por: ___________________________', M, y); y += 6;
    doc.text('Recibido por: ___________________________', M, y); y += 7;

    // Número de cuenta para consignación
    doc.setDrawColor(...BRAND.borderLt); doc.setLineWidth(0.3);
    doc.line(M, y-3, W-M, y-3);
    doc.setFontSize(6); doc.setTextColor(...BRAND.textMid);
    doc.text('Cuenta ahorros Bancolombia 27593819979 a nombre de Paula Gutiérrez', M, y, { maxWidth: W-M*2 });

    renderCorporateFooter(doc, { config, x: M, pageW: W, y: 216-M });
  });

  doc.save(nombreArchivo('Recibo', pedidos));
}

// ════════════════════════════════════════════════════════════════════════
// COTIZACIÓN — tamaño carta, con imagen pequeña por producto y paginación
// ════════════════════════════════════════════════════════════════════════
export async function imprimirCotizaciones(pedidos, itemsPorPedido, config) {
  if(!pedidos.length) return;
  const todasLasUrls = pedidos.flatMap(p => (itemsPorPedido[p.id]||[]).map(i => i.imagen_url));
  await preloadAllImages(todasLasUrls);
  const logo = await prepararLogo(config);

  const doc = new jsPDF({orientation:'portrait', unit:'mm', format:'letter'});
  const PAGE_W = 216, PAGE_H = 279, M = 14;

  pedidos.forEach((pedido, idx) => {
    if (idx>0) doc.addPage('letter','portrait');
    const startPage = doc.internal.getNumberOfPages();
    const items = itemsPorPedido[pedido.id] || [];
    const fecha = new Date(pedido.fecha_registro||Date.now());

    let y = renderCorporateHeader(doc, {
      config, logo, x: M, y: M+7, pageW: PAGE_W, marginRight: M, fontScale: 1.15,
      docType: 'Cotización', docNumber: `No. ${String(pedido.consecutivo).padStart(4,'0')}`,
      docDate: `${fecha.getDate()} de ${MESES[fecha.getMonth()]} de ${fecha.getFullYear()}`,
    });
    y += 2;

    doc.setFont(BRAND.font,'bold'); doc.setFontSize(9); doc.setTextColor(...BRAND.textDark);
    doc.text('CLIENTE', M, y); y += 4.5;
    doc.setFont(BRAND.font,'normal'); doc.setFontSize(10);
    doc.text(pedido.nombre_empresa||'', M, y); y += 8;

    doc.autoTable({
      startY: y,
      margin: {left:M, right:M, bottom: 22},
      head:[['','CANT.','PRODUCTO','VR. UNITARIO','VR. TOTAL']],
      body: items.map(i=>['', i.cantidad, i.nombre_producto, fmt(i.precio_unitario), fmt(i.subtotal)]),
      foot: [['','','','TOTAL', fmt(totalPedido(items))]],
      ...tableTheme(1.15),
      styles: { ...tableTheme(1.15).styles, minCellHeight: 9 },
      columnStyles:{
        0:{cellWidth:11},
        1:{cellWidth:16,halign:'center'},
        3:{cellWidth:32,halign:'right'},
        4:{cellWidth:32,halign:'right'},
      },
      didDrawCell: (data) => {
        if (data.section === 'body' && data.column.index === 0) {
          const item = items[data.row.index];
          const dataUrl = item && imageCache.get(item.imagen_url);
          const dim = item && dimCache.get(item.imagen_url);
          if (dataUrl) {
            try {
              const box = dim ? fitBox(dim.w, dim.h, 7) : {w:7,h:7};
              doc.addImage(dataUrl, detectFormat(dataUrl), data.cell.x + (data.cell.width-box.w)/2, data.cell.y + (data.cell.height-box.h)/2, box.w, box.h);
            } catch(e) {}
          }
        }
      },
    });

    let fy = doc.lastAutoTable.finalY + 10;
    if (fy > PAGE_H - 45) { doc.addPage('letter','portrait'); fy = M; }
    doc.setFontSize(8); doc.setFont(BRAND.font,'normal'); doc.setTextColor(...BRAND.textMid);
    doc.text('Somos persona natural (no somos responsables de IVA)', M, fy); fy += 4;
    doc.text('Precios sujetos a cambio sin previo aviso. Cotización válida por 15 días.', M, fy);

    renderCorporateFooter(doc, { config, x: M, pageW: PAGE_W, y: PAGE_H - 16 });

    const endPage = doc.internal.getNumberOfPages();
    const totalPaginasPedido = endPage - startPage + 1;
    if (totalPaginasPedido > 1) {
      for (let pg = startPage; pg <= endPage; pg++) {
        doc.setPage(pg);
        doc.setFontSize(7.5); doc.setTextColor(...BRAND.textLight); doc.setFont(BRAND.font,'normal');
        doc.text(`Hoja ${pg-startPage+1} de ${totalPaginasPedido}`, PAGE_W - M, PAGE_H - 10, {align:'right'});
      }
    }
  });

  doc.save(nombreArchivo('Cotizacion', pedidos));
}

// ════════════════════════════════════════════════════════════════════════
// CUENTA DE COBRO — tamaño carta
// ════════════════════════════════════════════════════════════════════════
export async function imprimirCuentasCobro(pedidos, itemsPorPedido, config) {
  if(!pedidos.length) return;
  const logo = await prepararLogo(config);
  const doc = new jsPDF({orientation:'portrait', unit:'mm', format:'letter'});
  const PAGE_W = 216, PAGE_H = 279, M = 15;

  pedidos.forEach((pedido, idx) => {
    if (idx>0) doc.addPage('letter','portrait');
    const items = itemsPorPedido[pedido.id] || [];
    const total = totalPedido(items);
    const fecha = new Date(pedido.fecha_registro||Date.now());

    let y = renderCorporateHeader(doc, {
      config, logo, x: M, y: M+7, pageW: PAGE_W, marginRight: M, fontScale: 1.15,
      docType: 'Cuenta de Cobro', docNumber: `No. ${String(pedido.consecutivo).padStart(4,'0')}`,
      docDate: `${fecha.getDate()} de ${MESES[fecha.getMonth()]} de ${fecha.getFullYear()}`,
    });
    y += 6;

    // Datos del cliente (quien debe pagar) — a la izquierda
    doc.setFontSize(8); doc.setFont(BRAND.font,'bold'); doc.setTextColor(...BRAND.textMid);
    doc.text('CLIENTE', M, y); y += 4.5;
    doc.setFont(BRAND.font,'normal'); doc.setFontSize(9.5); doc.setTextColor(...BRAND.textDark);
    doc.text(pedido.nombre_empresa||'', M, y); y += 4.3;
    doc.setFontSize(8); doc.setTextColor(...BRAND.textMid);
    doc.text(`${pedido.tipo_documento||''} ${pedido.numero_documento||''}`, M, y);
    y += 11;

    // "Debe a" — fijo, centrado, discreto
    doc.setDrawColor(...BRAND.borderLt); doc.setLineWidth(0.3);
    doc.line(M, y-4, PAGE_W-M, y-4);
    doc.setFont(BRAND.font,'bold'); doc.setFontSize(8); doc.setTextColor(...BRAND.textMid);
    doc.text('DEBE A', PAGE_W/2, y, {align:'center'}); y += 5;
    doc.setFont(BRAND.font,'normal'); doc.setFontSize(9.5); doc.setTextColor(...BRAND.textDark);
    doc.text('PAULA ANDREA GUTIERREZ SANTAMARIA', PAGE_W/2, y, {align:'center'}); y += 5;
    doc.setFontSize(8.5); doc.setTextColor(...BRAND.textMid);
    doc.text(`NATILLA MEDELLIN  ·  NIT. ${config.nit || '43.749.223-8'}`, PAGE_W/2, y, {align:'center'}); y += 10;
    doc.line(M, y-6, PAGE_W-M, y-6);

    // La suma de — bloque destacado
    doc.setFillColor(...BRAND.primaryLt);
    doc.rect(M, y-2, PAGE_W-M*2, 13, 'F');
    doc.setTextColor(...BRAND.primary); doc.setFont(BRAND.font,'bold'); doc.setFontSize(11);
    doc.text(`LA SUMA DE: ${numeroALetras(total)}`, M+4, y+5.5, {maxWidth: PAGE_W-M*2-8});
    doc.setFontSize(9);
    doc.text(`(${fmt(total)})`, PAGE_W-M-4, y+5.5, {align:'right'});
    y += 18;

    doc.setTextColor(...BRAND.textDark); doc.setFont(BRAND.font,'bold'); doc.setFontSize(9);
    doc.text('POR CONCEPTO DE', M, y); y += 5;

    doc.autoTable({
      startY: y,
      margin: {left:M, right:M},
      head: [['CANT.', 'PRODUCTO', 'VALOR UNITARIO', 'VALOR TOTAL']],
      body: items.map(i => [i.cantidad, i.nombre_producto, fmt(i.precio_unitario), fmt(i.subtotal)]),
      foot: [['', '', 'TOTAL', fmt(total)]],
      ...tableTheme(1.1),
      columnStyles: { 0:{cellWidth:22,halign:'center'}, 2:{cellWidth:38,halign:'right'}, 3:{cellWidth:38,halign:'right'} },
    });

    let fy = doc.lastAutoTable.finalY + 10;
    doc.setFontSize(8); doc.setFont(BRAND.font,'normal'); doc.setTextColor(...BRAND.textMid);
    doc.text('NO SOMOS RESPONSABLES DE IVA', M, fy);

    renderCorporateFooter(doc, { config, x: M, pageW: PAGE_W, y: PAGE_H - 16 });
  });
  doc.save(nombreArchivo('CuentaCobro', pedidos));
}

// ── Exportar Excel de toda la base de datos ─────────────────────────────────
export function exportarExcel(pedidos, pagos) {
  const XLSX = window.XLSX || require('xlsx');
  const pedidosData = pedidos.map(p => ({
    'No.': p.consecutivo,
    'Fecha Registro': p.fecha_registro ? new Date(p.fecha_registro).toLocaleDateString('es-CO') : '',
    'Fecha Entrega': p.fecha_entrega || '',
    'Empresa': p.nombre_empresa,
    'Contacto': p.nombre_contacto,
    'Teléfono': p.telefono,
    'Dirección': p.direccion,
    'Observaciones': p.observaciones || '',
    'Estado': p.estado || '',
  }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(pedidosData), 'Pedidos');
  XLSX.writeFile(wb, `Natilla_Export_${new Date().toISOString().slice(0, 10)}.xlsx`);
}
