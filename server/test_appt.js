"use strict";
const { createConnection } = require("mysql2/promise");
require("dotenv").config({ path: "./.env" });

async function check() {
    const conn = await createConnection(process.env.DATABASE_URL);
    const [rows] = await conn.query("SELECT id, clientId, artistId, title, startTime, serviceName, price FROM appointments ORDER BY id DESC LIMIT 10");
    console.log(rows);
    process.exit(0);
}

check();
