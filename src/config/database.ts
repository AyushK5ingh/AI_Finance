// Database connection and configuration
import { Pool, PoolClient } from "pg";
import dotenv from "dotenv";

dotenv.config();

// Database connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : false,
  max: parseInt(process.env.DB_POOL_MAX || "20"), // Maximum connections in pool
  min: parseInt(process.env.DB_POOL_MIN || "5"), // Minimum connections
  idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || "30000"),
  connectionTimeoutMillis: parseInt(
    process.env.DB_CONNECTION_TIMEOUT || "5000"
  ),
  statement_timeout: parseInt(process.env.DB_STATEMENT_TIMEOUT || "30000"),
  query_timeout: parseInt(process.env.DB_QUERY_TIMEOUT || "30000"),
});

// Connection event handlers
pool.on("connect", (client: PoolClient) => {
  console.log("✅ New client connected to PostgreSQL database");
});

pool.on("error", (err: Error) => {
  console.error("❌ Unexpected error on idle client:", err);
  process.exit(-1);
});

// Test database connection
export const testConnection = async (): Promise<void> => {
  try {
    const client = await pool.connect();
    const result = await client.query(
      "SELECT NOW() as current_time, version() as pg_version"
    );
    console.log("✅ Database connected successfully!");
    console.log(`📅 Current time: ${result.rows[0].current_time}`);
    console.log(
      `🗄️ PostgreSQL version: ${result.rows[0].pg_version.split(" ")[0]}`
    );
    client.release();
  } catch (error) {
    console.error("❌ Database connection failed:", error);
    throw error;
  }
};

// Query helper function with error handling
export const query = async (text: string, params?: any[]): Promise<any> => {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log(`🔍 Query executed in ${duration}ms`);
    return result;
  } catch (error) {
    console.error("❌ Database query error:", error);
    console.error("Query:", text);
    console.error("Params:", params);
    throw error;
  }
};

// Transaction helper
export const transaction = async (
  callback: (client: PoolClient) => Promise<any>
): Promise<any> => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

// Get pool instance for advanced usage
export const getPool = (): Pool => pool;

// Graceful shutdown
export const closePool = async (): Promise<void> => {
  await pool.end();
  console.log("🔚 Database pool closed");
};

export default pool;
