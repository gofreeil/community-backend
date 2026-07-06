'use strict';

// ניקוי חד-פעמי: מחיקת שורת הבדיקה שנוצרה בזמן אימות תיקון ה-500
// (raw json→string). מזוהה לפי documentId המדויק וגם לפי שם הבדיקה,
// אידמפוטנטי — no-op אם כבר נמחקה.

const TABLE = 'ch_charter_signatures';
const TEST_DOCUMENT_ID = 'bbj5n15g3xkwysnhr8hcl12l';
const TEST_NAME = 'בדיקת תיקון - נא למחוק';

async function up(knex) {
  if (!(await knex.schema.hasTable(TABLE))) return;
  await knex(TABLE)
    .where('document_id', TEST_DOCUMENT_ID)
    .orWhere('name', TEST_NAME)
    .del();
}

async function down() {
  // אין שחזור לשורת בדיקה
}

module.exports = { up, down };
