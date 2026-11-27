const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');

const CATEGORIES = [
  ['snack', 'Snack'],
  ['breakfast', 'Breakfast'],
  ['lunch', 'Lunch'],
  ['dinner', 'Dinner'],
  ['beverage', 'Champagne / Beverage'],
];
const CATEGORY_LABEL = Object.fromEntries(CATEGORIES);
const STATUS_LABEL = { pending: 'Pending', preparing: 'Preparing', prepared: 'Prepared', delivered: 'Delivered', completed: 'Completed' };
const HAUL_LABEL = { shortHaul: 'Short haul', mediumHaul: 'Medium haul', longHaul: 'Long haul' };
const STATUS_COLOR = { pending: '#8a5a00', preparing: '#1d4e89', prepared: '#0f6e5c', delivered: '#1f9d55', completed: '#6b6459' };

function pad(n) {
  return String(n).padStart(2, '0');
}

// Timestamps are stored in UTC; reports show the server's local time, which is
// the crew's wall-clock time when the server runs on the aircraft/ops laptop.
function localStamp(sqliteUtc) {
  const date = new Date(`${String(sqliteUtc).replace(' ', 'T')}Z`);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function fileStamp() {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

const mealName = (order, category) => (order.items[category] ? order.items[category].name : '-');
const conditionText = (order) => (order.conditions.length ? order.conditions.map((c) => c.label).join(', ') : '-');
const scopeText = (classType) => (classType ? `${classType} class only` : 'All cabin classes');

// ---------------------------------------------------------------------------
// Excel
// ---------------------------------------------------------------------------

function styleHeader(sheet) {
  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  header.alignment = { vertical: 'middle' };
  header.height = 22;
  header.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF141414' } };
  });
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: sheet.columnCount } };
}

// Passenger names are free text. exceljs stores plain strings as strings (never
// as formulas), so a name like "=HYPERLINK(...)" stays inert text in the file.
async function writeOrdersWorkbook(res, { orders, summary, demand, classType }) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Smart Flight Catering';
  workbook.created = new Date();

  // --- Summary ---
  const sum = workbook.addWorksheet('Summary');
  sum.columns = [{ width: 34 }, { width: 14 }];
  sum.addRow(['Order report']).font = { bold: true, size: 16 };
  sum.addRow([`Generated ${localStamp(new Date().toISOString().replace('T', ' ').replace('Z', ''))}  ·  ${scopeText(classType)}`]);
  sum.addRow([]);
  const section = (title, rows) => {
    sum.addRow([title]).font = { bold: true };
    rows.forEach(([label, value]) => sum.addRow([label, value]));
    sum.addRow([]);
  };
  section('Totals', [
    ['Orders', summary.totals.orders],
    ['Meals ordered', summary.totals.items],
    ['Orders declaring a health condition', summary.totals.withConditions],
  ]);
  section('Orders by status', summary.byStatus.map((r) => [STATUS_LABEL[r.key], r.count]));
  section('Orders by cabin class', summary.byClass.map((r) => [r.key, r.count]));
  section('Orders by flight length', summary.byHaul.map((r) => [HAUL_LABEL[r.key], r.count]));
  section('Meals ordered by category', summary.byCategory.map((r) => [CATEGORY_LABEL[r.key], r.count]));

  // --- Orders ---
  const sheet = workbook.addWorksheet('Orders');
  sheet.columns = [
    { header: 'Seat', width: 8 },
    { header: 'Cabin class', width: 12 },
    { header: 'Passenger', width: 20 },
    { header: 'Flight length', width: 14 },
    { header: 'Status', width: 12 },
    { header: 'Health conditions', width: 34 },
    ...CATEGORIES.map(([, label]) => ({ header: label, width: 28 })),
    { header: 'Placed', width: 17 },
    { header: 'Last updated', width: 17 },
  ];
  for (const order of orders) {
    sheet.addRow([
      order.seatId,
      order.classType,
      order.passengerName || '',
      HAUL_LABEL[order.haulLength],
      STATUS_LABEL[order.status],
      conditionText(order),
      ...CATEGORIES.map(([key]) => mealName(order, key)),
      localStamp(order.placedAt),
      localStamp(order.updatedAt),
    ]);
  }
  styleHeader(sheet);

  // --- Meal demand ---
  const meals = workbook.addWorksheet('Meal demand');
  meals.columns = [
    { header: 'Meal', width: 40 },
    { header: 'Cabin class', width: 12 },
    { header: 'Flight length', width: 14 },
    { header: 'Category', width: 22 },
    { header: 'Ordered', width: 10 },
    { header: 'Stock', width: 11 },
    { header: 'Remaining', width: 11 },
    { header: 'Available', width: 10 },
  ];
  for (const meal of demand) {
    meals.addRow([
      meal.name,
      meal.classType,
      HAUL_LABEL[meal.haulLength],
      CATEGORY_LABEL[meal.category] || meal.category,
      meal.ordered,
      meal.stock === null ? 'Unlimited' : meal.stock,
      meal.remaining === null ? 'Unlimited' : meal.remaining,
      meal.isAvailable ? 'Yes' : 'No',
    ]);
  }
  styleHeader(meals);

  // --- Health conditions ---
  const conditions = workbook.addWorksheet('Health conditions');
  conditions.columns = [
    { header: 'Condition', width: 36 },
    { header: 'Orders declaring it', width: 20 },
  ];
  summary.conditions.forEach((row) => conditions.addRow([row.label, row.count]));
  styleHeader(conditions);

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="orders-${fileStamp()}.xlsx"`);
  await workbook.xlsx.write(res);
  res.end();
}

// ---------------------------------------------------------------------------
// PDF
// ---------------------------------------------------------------------------

// The built-in PDF fonts only draw Latin-1 plus a few punctuation marks. Anything
// else (e.g. a passenger name typed in Arabic) would print as garbage, so it is
// shown as "?" instead. Accented menu names (Château, Crêpes) are unaffected.
function pdfText(value) {
  return String(value ?? '').replace(/[^ -~ -ÿ–—‘’“”•…]/g, '?');
}

const PAGE_MARGIN = 36;
const COLUMNS = [
  { key: 'seat', title: 'Seat', width: 42 },
  { key: 'class', title: 'Class', width: 56 },
  { key: 'name', title: 'Passenger', width: 100 },
  { key: 'status', title: 'Status', width: 66 },
  { key: 'conditions', title: 'Health conditions', width: 150 },
  { key: 'meals', title: 'Meals', width: 356 },
];

function writePdf(res, { orders, summary, classType }) {
  const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: PAGE_MARGIN, bufferPages: true, info: { Title: 'Order report', Author: 'Smart Flight Catering' } });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="orders-${fileStamp()}.pdf"`);
  doc.pipe(res);

  const bottom = () => doc.page.height - PAGE_MARGIN - 18;

  doc.font('Helvetica-Bold').fontSize(20).fillColor('#141414').text('Order report');
  doc.font('Helvetica').fontSize(9).fillColor('#6b6459')
    .text(`Generated ${localStamp(new Date().toISOString().replace('T', ' ').replace('Z', ''))}  |  ${scopeText(classType)}`);
  doc.moveDown(0.6);

  const line = (label, text) => {
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#141414').text(`${label}  `, { continued: true });
    doc.font('Helvetica').fillColor('#201a14').text(text);
  };
  line('Orders:', `${summary.totals.orders}    Meals ordered: ${summary.totals.items}    With a health condition: ${summary.totals.withConditions}`);
  line('By status:', summary.byStatus.map((r) => `${STATUS_LABEL[r.key]} ${r.count}`).join('   '));
  line('By class:', summary.byClass.map((r) => `${r.key} ${r.count}`).join('   '));
  line('By category:', summary.byCategory.map((r) => `${CATEGORY_LABEL[r.key]} ${r.count}`).join('   '));
  doc.moveDown(0.8);

  const drawHeader = () => {
    const y = doc.y;
    doc.rect(PAGE_MARGIN, y, doc.page.width - PAGE_MARGIN * 2, 18).fill('#141414');
    let x = PAGE_MARGIN;
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#ffffff');
    for (const col of COLUMNS) {
      doc.text(col.title, x + 5, y + 5, { width: col.width - 8, lineBreak: false });
      x += col.width;
    }
    doc.y = y + 22;
  };

  if (!orders.length) {
    doc.font('Helvetica-Oblique').fontSize(11).fillColor('#6b6459').text('No orders have been placed yet.');
  } else {
    drawHeader();
    orders.forEach((order, index) => {
      const cells = {
        seat: pdfText(order.seatId),
        class: pdfText(order.classType),
        name: pdfText(order.passengerName || '-'),
        status: STATUS_LABEL[order.status],
        conditions: pdfText(conditionText(order)),
        meals: pdfText(
          CATEGORIES.filter(([key]) => order.items[key]).map(([key, label]) => `${label}: ${order.items[key].name}`).join('\n') || '-'
        ),
      };

      doc.font('Helvetica').fontSize(8.5);
      const height = Math.max(...COLUMNS.map((col) => doc.heightOfString(cells[col.key], { width: col.width - 8 }))) + 10;

      if (doc.y + height > bottom()) {
        doc.addPage();
        drawHeader();
      }

      const y = doc.y;
      if (index % 2 === 0) doc.rect(PAGE_MARGIN, y - 2, doc.page.width - PAGE_MARGIN * 2, height).fill('#f6f4ee');

      let x = PAGE_MARGIN;
      for (const col of COLUMNS) {
        const bold = col.key === 'seat' || col.key === 'status';
        doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(8.5).fillColor(col.key === 'status' ? STATUS_COLOR[order.status] : '#201a14');
        doc.text(cells[col.key], x + 5, y + 3, { width: col.width - 8 });
        x += col.width;
      }
      doc.y = y + height;
    });
  }

  // Page numbers: written last, once the total page count is known. The bottom
  // margin is zeroed first, otherwise text this low would spill onto a new page.
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i += 1) {
    doc.switchToPage(range.start + i);
    doc.page.margins.bottom = 0;
    doc.font('Helvetica').fontSize(8).fillColor('#6b6459')
      .text(`Page ${i + 1} of ${range.count}`, PAGE_MARGIN, doc.page.height - PAGE_MARGIN, { width: doc.page.width - PAGE_MARGIN * 2, align: 'right', lineBreak: false });
  }
  doc.end();
}

module.exports = { writeOrdersWorkbook, writePdf, pdfText };
