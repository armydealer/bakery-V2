export const APPS_SCRIPT_CODE_GS = `/**
 * شیرین‌تراز OS — اسکریپت همگام‌سازی دوطرفه با گوگل شیت
 * این کد ۶ تب رابطه‌ای استاندارد را به صورت خودکار می‌سازد و به‌روزرسانی می‌کند:
 * Ingredients | Recipes_Costing | Overhead_Payroll | Checks_Cashflow | Forecast_Snapshot | App_State_Backup
 */

const TAB_NAMES = [
  'Ingredients',
  'Recipes_Costing',
  'Overhead_Payroll',
  'Checks_Cashflow',
  'Forecast_Snapshot',
  'App_State_Backup'
];

function getOrCreateSheet_(ss, name) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  return sheet;
}

function writeTable_(sheet, headers, rows) {
  sheet.clearContents();
  const data = [headers].concat(rows || []);
  if (data.length > 0 && data[0].length > 0) {
    sheet.getRange(1, 1, data.length, data[0].length).setValues(data);
    sheet.getRange(1, 1, 1, data[0].length).setFontWeight('bold');
  }
}

function doPost(e) {
  try {
    const raw = e && e.postData && e.postData.contents ? e.postData.contents : '{}';
    const payload = JSON.parse(raw);
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    TAB_NAMES.forEach(function(name) { getOrCreateSheet_(ss, name); });

    if (payload.action === 'pull') {
      return doGet();
    }

    // 1. Ingredients
    const ingSheet = getOrCreateSheet_(ss, 'Ingredients');
    writeTable_(
      ingSheet,
      ['شناسه', 'نام ماده', 'دسته', 'بسته‌بندی', 'مقدار در بسته', 'واحد پایه', 'قیمت بسته (تومان)', 'تورم ماهانه (%)', 'موجودی فعلی', 'حداقل اطمینان'],
      (payload.tables && payload.tables.ingredients) || []
    );

    // 2. Recipes_Costing
    const recSheet = getOrCreateSheet_(ss, 'Recipes_Costing');
    writeTable_(
      recSheet,
      ['شناسه', 'نام شیرینی', 'دسته', 'بهای تمام‌شده/کیلو', 'قیمت ویترین/کیلو', 'سود خالص/کیلو', 'حاشیه سود (%)', 'فروش ماهانه (کیلو)', 'سود در ساعت فر', 'سقف اتحادیه'],
      (payload.tables && payload.tables.recipes) || []
    );

    // 3. Overhead_Payroll
    const ovhSheet = getOrCreateSheet_(ss, 'Overhead_Payroll');
    writeTable_(
      ovhSheet,
      ['نوع', 'عنوان / نام', 'دسته / سمت', 'مبلغ پایه ماهانه', 'سربار قانونی / بیمه و عیدی', 'هزینه واقعی کل ماهانه'],
      (payload.tables && payload.tables.overheadPayroll) || []
    );

    // 4. Checks_Cashflow
    const chkSheet = getOrCreateSheet_(ss, 'Checks_Cashflow');
    writeTable_(
      chkSheet,
      ['نوع چک', 'طرف حساب', 'مبلغ (تومان)', 'سررسید شمسی', 'شناسه صیادی', 'وضعیت'],
      (payload.tables && payload.tables.checks) || []
    );

    // 5. Forecast_Snapshot
    const fcSheet = getOrCreateSheet_(ss, 'Forecast_Snapshot');
    writeTable_(
      fcSheet,
      ['ماه شمسی', 'مناسبت', 'ضریب فصلی', 'درآمد پایه', 'هزینه کل', 'سود اسمی پایه', 'سود بدبینانه P10', 'سود خوش‌بینانه P90', 'سود واقعی'],
      (payload.tables && payload.tables.forecast) || []
    );

    // 6. App_State_Backup (Full JSON State for 1-click Pull)
    const backupSheet = getOrCreateSheet_(ss, 'App_State_Backup');
    backupSheet.clearContents();
    backupSheet.getRange(1, 1, 1, 3).setValues([['UpdatedAt', 'WorkshopName', 'StateJSON']]);
    backupSheet.getRange(2, 1, 1, 3).setValues([[
      new Date().toISOString(),
      (payload.workshopName || 'ShirinTaraz OS'),
      JSON.stringify(payload.state || {})
    ]]);

    return ContentService
      .createTextOutput(JSON.stringify({ ok: true, syncedAt: new Date().toISOString() }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const backupSheet = ss.getSheetByName('App_State_Backup');
    if (!backupSheet || backupSheet.getLastRow() < 2) {
      return ContentService
        .createTextOutput(JSON.stringify({ ok: false, error: 'نسخه پشتیبانی در تب App_State_Backup یافت نشد.' }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    const updatedAt = backupSheet.getRange(2, 1).getValue();
    const rawState = backupSheet.getRange(2, 3).getValue();
    return ContentService
      .createTextOutput(JSON.stringify({ ok: true, updatedAt: updatedAt, state: JSON.parse(rawState) }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
`;
