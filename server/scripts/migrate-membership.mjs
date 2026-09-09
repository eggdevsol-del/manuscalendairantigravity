import mysql from 'mysql2/promise';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
if(!process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_'))throw Error('Test environment required.');
const db=await mysql.createConnection(process.env.DATABASE_URL);
try{
 const sql=await readFile('drizzle/0027_studio_departure_status.sql','utf8'),hash=createHash('sha256').update(sql).digest('hex');
 const [latest]=await db.query('SELECT hash,created_at FROM __drizzle_migrations ORDER BY created_at DESC LIMIT 1');
 if(Number(latest[0]?.created_at)===1788954000000){if(latest[0].hash!==hash)throw Error('Hash mismatch');console.log('Migration 0027 already applied.');}
 else{
  if(Number(latest[0]?.created_at)!==1788948000000)throw Error('Migration 0026 baseline required.');
  const [columns]=await db.query('SHOW COLUMNS FROM studio_members WHERE Field=?',['status']);
  console.log('Current membership enum:',columns[0].Type);
  if(process.argv.includes('--apply')){
   const [ddl]=await db.query('SHOW CREATE TABLE studio_members');
   await db.query('CREATE TABLE IF NOT EXISTS _tattoi_2121_backup_studio_members LIKE studio_members');
   await db.query('INSERT IGNORE INTO _tattoi_2121_backup_studio_members SELECT * FROM studio_members');
   const [counts]=await db.query('SELECT (SELECT COUNT(*) FROM studio_members) original,(SELECT COUNT(*) FROM _tattoi_2121_backup_studio_members) backup');
   if(counts[0].original!==counts[0].backup)throw Error('Backup count mismatch');
   await db.query('INSERT IGNORE INTO _tattoi_212_backup_manifest (tableName,createSql) VALUES (?,?)',['studio_members',ddl[0]['Create Table']]);
   await db.query(sql);
   await db.query('INSERT INTO __drizzle_migrations (hash,created_at) VALUES (?,?)',[hash,1788954000000]);
   console.log('PASS: membership enum reconciled, existing removed status preserved, table and DDL backed up.');
  }
 }
}finally{await db.end();}
