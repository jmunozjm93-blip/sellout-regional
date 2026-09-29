# Sell Out Regional · Grupo Depor

Sell out de **calzado** de los clientes regionales que no informan venta, solo stock. La venta se calcula restando fotos de stock y sumando lo que les facturamos. Misma arquitectura que `cargas` y `pagina-web`: página estática en GitHub Pages; los Excel se convierten a JSON en el navegador y se suben al repositorio con un token.

**Sitio publicado:** https://jmunozjm93-blip.github.io/sellout-regional/ (usuario `depor`, la misma clave del sitio de sell out)
**Carga de archivos:** https://jmunozjm93-blip.github.io/sellout-regional/cargar.html

| Archivo | Descripción |
|---|---|
| `index.html` | Dashboard: indicadores, estatus de facturación por cliente y detalle por modelo con foto. Descarga a Excel |
| `cargar.html` | App de carga: reconoce el formato, lee solo calzado, confirma cliente y fecha, sube el JSON a GitHub |
| `js/lectores.js` | Los lectores de cada formato de Excel (ver tabla abajo). Para un formato nuevo se agrega una función aquí |
| `js/acceso.js` | Pantalla de usuario y contraseña (cortina, no seguridad real) |
| `data/manifiesto.json` | Índice de lo publicado: fotos de stock por cliente y fecha, facturación, fotos, catálogo |
| `data/stock/<cliente>_<aaaa-mm-dd>.json` | Una foto de stock convertida: modelo-color → stock (y costo, precio, venta informada si el archivo los trae) |
| `data/facturacion.json` | Facturación Detallada, solo calzado: cliente, fecha, modelo-color, cantidad, neto, FAC/NC |
| `data/imagenes.json` | Modelo-color → ID de foto en Google Drive (desde `Excel_Macro.xlsx`) |
| `data/catalogo.json` | Atributos por modelo (descripción, status, duración, temporada, género, marca, full price, BO02, KAM, Regionales), tomados del Dashboard sell out |

## Rutina

1. Abrir **cargar.html** (la primera vez, pegar el token: ver abajo).
2. Arrastrar los Excel: fotos de stock de cada cliente, la Facturación Detallada, o `Excel_Macro.xlsx` para refrescar las fotos.
3. Revisar el cliente y la fecha que propone (salen del nombre del archivo) y pulsar **Subir a GitHub**.
4. En 1–2 minutos el dashboard recalcula. Subir otra vez el mismo cliente y fecha reemplaza; la facturación nueva reemplaza a la anterior (es acumulada). **Quitar** saca una foto de stock.

Los Excel no se suben: se quedan en el PC (carpeta `fuentes/`, ignorada por git).

**Token:** fine-grained, *Contents: Read and write* solo sobre `sellout-regional` (se puede agregar este repositorio al token que ya usas en Cargas). Se pega una vez en `cargar.html` y queda guardado en ese navegador.

## Formatos que reconoce (`js/lectores.js`)

| Formato | Ejemplo | Código-color |
|---|---|---|
| Resumen por modelo (MOD, COLOR PROV, COMPRA, STOCK, PRECIO, $ Venta) | Casa Anny 18-05 | MOD + COLOR PROV. PRECIO = costo, $ Venta = precio público |
| SAP por SKU-talla (Número de artículo, Descripción, En stock) | Casa Anny 08-07 | modelo + el color que sigue al modelo en la descripción (Umbro: 82291U-3611 → 82291U-A66) |
| Lista modelo-color (1ª columna el código, columna STK/Stock) | Nace 04-02 | la misma columna |
| Detalle SKU-talla (cod color, linea, Stock actual) | Nace 11-05 | "cod color"; solo linea = CALZADO |
| Venta y stock del cliente (Modelo, Color, PVP, UPC, Unid Vta Total, Inv Actual) | Multihogar | si el modelo no trae color, el color que se le facturó. Si hay filas "Total <artículo>", manda el total (el detalle por talla puede venir incompleto). PVP = precio, UPC = costo |
| Facturación Detallada (Card Name, Modelo-Color, Cantidad, Total Neto, Tipo Doc) | V-Facturacion Detallada | Modelo-Color |
| Excel_Macro, hoja Imagenes (Nombre del Archivo, Link) | Excel_Macro.xlsx | nombre del archivo |

Cliente desde el nombre: "anny" → CASA ANNY, "nace" → COMERCIAL NACE, "multihoga" → MULTIHOGAR; si no, se propone el nombre sin fecha y se corrige a mano. Fecha: `08-07-2026`, `11.05.26`, `25-3-2026`.

En la facturación, cada cliente se reconoce por su Card Name (CENTRO COMERCIAL CASA ANNY LTDA. → CASA ANNY; DISTRIBUIDORA MULTIHOGAR S.A. → MULTIHOGAR).

## Cálculo

- **Venta UN** = stock anterior + facturado en el período − stock actual. Se cuentan facturas y notas de crédito emitidas entre las dos fotos, corridas **7 días de tránsito** (se cambia en el dashboard).
- **REPUESTO**: el stock subió más de lo facturado (compra a otro proveedor, traspaso o foto anterior incompleta). **NUEVO**: no estaba en la foto anterior y no tiene factura en el período.
- **Venta $** = Vta UN × precio ÷ 1,19. **Margen** = (precio ÷ 1,19 − costo) ÷ (precio ÷ 1,19), ponderado por venta neta; costo = el del archivo del cliente o nuestro precio neto facturado.
- **Rotación** = Vta UN ÷ stock inicial (verde si equivale a 30% o más al mes). **Meses de stock** = stock actual ÷ venta mensual (verde ≤ 4). Margen ≥ 25% en verde.
- Los porcentajes nunca se promedian: se suman los absolutos y luego se divide.

## Estatus de facturación

Por cliente: pares facturados, notas de crédito, neto en pares y $, primera y última factura, stock de la última foto y lo facturado después de esa foto (todavía no debería verse en su stock).
