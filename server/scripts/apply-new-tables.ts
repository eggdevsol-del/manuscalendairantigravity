import "dotenv/config";
import mysql from "mysql2/promise";

async function run() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL not found");
    process.exit(1);
  }

  const connection = await mysql.createConnection(process.env.DATABASE_URL);

  console.log("Connected to DB...");

  try {
    // Portfolios
    await connection.execute(`
            CREATE TABLE IF NOT EXISTS portfolios (
                id INT AUTO_INCREMENT PRIMARY KEY,
                artistId VARCHAR(64) NOT NULL,
                imageUrl TEXT NOT NULL,
                description TEXT,
                createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (artistId) REFERENCES users(id) ON DELETE CASCADE
            );
        `);
    console.log("Created portfolios table");

    // Portfolio Likes
    await connection.execute(`
            CREATE TABLE IF NOT EXISTS portfolio_likes (
                id INT AUTO_INCREMENT PRIMARY KEY,
                portfolioId INT NOT NULL,
                userId VARCHAR(64) NOT NULL,
                createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (portfolioId) REFERENCES portfolios(id) ON DELETE CASCADE,
                FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
                UNIQUE KEY user_portfolio_like (userId, portfolioId)
            );
        `);
    console.log("Created portfolio_likes table");

    // Voucher Templates
    await connection.execute(`
            CREATE TABLE IF NOT EXISTS voucher_templates (
                id INT AUTO_INCREMENT PRIMARY KEY,
                artistId VARCHAR(64) NOT NULL,
                name VARCHAR(255) NOT NULL,
                value INT NOT NULL,
                description TEXT,
                createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (artistId) REFERENCES users(id) ON DELETE CASCADE
            );
        `);
    console.log("Created voucher_templates table");

    // Issued Vouchers
    await connection.execute(`
            CREATE TABLE IF NOT EXISTS issued_vouchers (
                id INT AUTO_INCREMENT PRIMARY KEY,
                templateId INT NOT NULL,
                artistId VARCHAR(64) NOT NULL,
                clientId VARCHAR(64) NOT NULL,
                code VARCHAR(50) NOT NULL UNIQUE,
                status ENUM('active', 'redeemed', 'expired') NOT NULL DEFAULT 'active',
                expiresAt TIMESTAMP NULL,
                createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                redeemedAt TIMESTAMP NULL,
                FOREIGN KEY (templateId) REFERENCES voucher_templates(id) ON DELETE CASCADE,
                FOREIGN KEY (artistId) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (clientId) REFERENCES users(id) ON DELETE CASCADE,
                INDEX idx_voucher_code (code)
            );
        `);
    console.log("Created issued_vouchers table");
  } catch (e) {
    console.error("Error creating tables:", e);
  } finally {
    await connection.end();
  }
}

run();
