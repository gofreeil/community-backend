'use strict';

// חתימת אמנת חכמי העדה נכשלה ב-500 (invalid input syntax for type json):
// העמודות name/business_name/role/city/disqualified_reason/disqualified_by נוצרו כ-jsonb,
// אבל האפליקציה שולחת מחרוזות רגילות. Strapi לא ממיר jsonb→varchar אוטומטית
// (Postgres דורש USING מפורש), אז ההמרה נעשית כאן. הטבלה ריקה — הקאסט טריוויאלי.
// Postgres בלבד; מריצה רק עמודות שעדיין jsonb (אידמפוטנטי).

const TABLE = 'ch_charter_signatures';
const COLUMNS = [
  ['name', 'varchar(255)'],
  ['business_name', 'varchar(255)'],
  ['role', 'varchar(255)'],
  ['city', 'varchar(255)'],
  ['disqualified_reason', 'text'],
  ['disqualified_by', 'varchar(255)'],
];

async function up(knex) {
  if (knex.client.config.client !== 'postgres') return;
  if (!(await knex.schema.hasTable(TABLE))) return;

  for (const [col, type] of COLUMNS) {
    const row = await knex('information_schema.columns')
      .select('data_type')
      .where({ table_name: TABLE, column_name: col })
      .first();
    if (row && row.data_type === 'jsonb') {
      await knex.raw(`ALTER TABLE ?? ALTER COLUMN ?? TYPE ${type} USING ??::text`, [TABLE, col, col]);
    }
  }
}

async function down() {
  // לא משחזרים ל-jsonb
}

module.exports = { up, down };
