// Explicit, one-time adoption of the audited existing Tattoi database.
// Never called by build/start. Run without --apply to inspect first.
import mysql from 'mysql2/promise';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const apply=process.argv.includes('--apply');
if(!process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_'))throw new Error('This reconciliation is restricted to the authorized Stripe test environment.');
const db=await mysql.createConnection(process.env.DATABASE_URL);
const ident=value=>'`'+value.replaceAll('`','``')+'`';
try {
 const [columns]=await db.query('SELECT TABLE_NAME,COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE()');
 const have=new Set(columns.map(r=>`${r.TABLE_NAME}.${r.COLUMN_NAME}`));
 const [journal]=await db.query('SELECT id,created_at FROM __drizzle_migrations ORDER BY created_at DESC LIMIT 1');
 const [foreignKeys]=await db.query('SELECT CONSTRAINT_NAME FROM information_schema.REFERENTIAL_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME=?',['procedure_logs']);
 const edits=[];
 if(!have.has('stripe_webhook_events.id'))edits.push(await readFile('drizzle/0023_webhook_receipts.sql','utf8'));
 if(!have.has('waitlist_entries.id'))edits.push(await readFile('drizzle/0025_cancellation_waitlist.sql','utf8'));
 for(const fk of foreignKeys){if(['procedure_logs_appointmentId_appointments_id_fk','procedure_logs_artistId_users_id_fk','procedure_logs_clientId_users_id_fk'].includes(fk.CONSTRAINT_NAME))edits.push(`ALTER TABLE procedure_logs DROP FOREIGN KEY ${ident(fk.CONSTRAINT_NAME)}`);}
 for(const [table,column,definition] of [['supplierShippingRates','rateType',"enum('price_based','weight_based') DEFAULT 'price_based'"],['supplierShippingRates','createdAt','timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP'],['supplierShippingZones','createdAt','timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP']]){
  if(!have.has(`${table}.${column}`))edits.push(`ALTER TABLE ${ident(table)} ADD COLUMN ${ident(column)} ${definition}`);
 }
 console.log('Planned schema statements:',edits.length,'Migration journal:',journal.length?'present':'empty; adoption baseline required');
 if(!apply){console.log(edits.join('\n'));process.exitCode=edits.length?2:0;}
 else {
  // Back up only the existing tables touched below, with their original DDL.
  await db.query('CREATE TABLE IF NOT EXISTS _tattoi_rebuild_backup_manifest (tableName varchar(100) PRIMARY KEY, createSql longtext NOT NULL, backedUpAt timestamp DEFAULT CURRENT_TIMESTAMP)');
  for(const table of ['procedure_logs','supplierShippingRates','supplierShippingZones','__drizzle_migrations']){
   const backup=`_tattoi_211_backup_${table}`;
   const [record]=await db.query('SELECT tableName FROM _tattoi_rebuild_backup_manifest WHERE tableName=?',[table]);
   if(record.length)continue;
   const [count]=await db.query(`SELECT COUNT(*) AS n FROM ${ident(table)}`);
   if(count[0].n>50000)throw new Error('Use a full managed backup for tables larger than 50,000 rows.');
   const [ddl]=await db.query(`SHOW CREATE TABLE ${ident(table)}`);
   await db.query(`CREATE TABLE IF NOT EXISTS ${ident(backup)} LIKE ${ident(table)}`);
   await db.beginTransaction();
   try {
    await db.query(`INSERT IGNORE INTO ${ident(backup)} SELECT * FROM ${ident(table)}`);
    const [saved]=await db.query(`SELECT COUNT(*) AS n FROM ${ident(backup)}`);
    if(saved[0].n!==count[0].n)throw new Error('Backup row count differs; stop and inspect concurrent writes.');
    await db.query('INSERT INTO _tattoi_rebuild_backup_manifest (tableName,createSql) VALUES (?,?)',[table,ddl[0]['Create Table']]);
    await db.commit();
   }catch(error){await db.rollback();throw error;}
  }
  for(const sql of edits)await db.query(sql);
  // Establish an explicit adoption boundary. This does not claim old migrations ran.
  // Subsequent Drizzle runs start after 0025 rather than replaying legacy DDL.
  const timestamp=1788912000002;
  if(!journal.length||Number(journal[0].created_at)<timestamp){
   const migration=await readFile('drizzle/0025_cancellation_waitlist.sql','utf8');
   await db.query('INSERT INTO __drizzle_migrations (hash,created_at) VALUES (?,?)',[createHash('sha256').update(migration).digest('hex'),timestamp]);
  }
  console.log('Targeted reconciliation complete. Backups retained in _tattoi_211_backup_* and original DDL in _tattoi_rebuild_backup_manifest. Run deploy:check next.');
 }
}finally{await db.end();}
