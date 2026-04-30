import mysql from 'mysql2/promise';
import { initDatabase } from './init-schema';

// ────────────────────────────────────────────────────────────────
// MySQL 数据库 — mysql2/promise 连接池
// ────────────────────────────────────────────────────────────────

type QueryParams = (string | number | boolean | null | Buffer | Date)[];

let pool: mysql.Pool | null = null;

async function getPool(): Promise<mysql.Pool> {
    if (!pool) {
        const url = process.env.MYSQL_URL;
        if (!url) {
            throw new Error('MYSQL_URL 环境变量未设置');
        }

        pool = mysql.createPool(url, {
            waitForConnections: true,
            connectionLimit: 10,
            charset: 'utf8mb4',
        });

        // 自动建表
        const conn = await pool.getConnection();
        try {
            await initDatabase(conn);
            console.log('[DB] MySQL 已连接');
        } finally {
            conn.release();
        }
    }
    return pool;
}

/**
 * 查询多行数据
 */
export async function query<T = Record<string, unknown>>(
    sql: string,
    params?: QueryParams
): Promise<T[]> {
    const [rows] = await (await getPool()).query(sql, params);
    return rows as T[];
}

/**
 * 查询单行数据
 */
export async function queryOne<T = Record<string, unknown>>(
    sql: string,
    params?: QueryParams
): Promise<T | null> {
    const [rows] = await (await getPool()).query(sql, params);
    const arr = rows as T[];
    return arr.length > 0 ? arr[0] : null;
}

/**
 * 查询标量值（COUNT 等聚合）
 */
export async function queryScalar<T = number>(
    sql: string,
    params?: QueryParams
): Promise<T | null> {
    const [rows] = await (await getPool()).query(sql, params);
    const arr = rows as Record<string, unknown>[];
    if (arr.length === 0) return null;
    return arr[0][Object.keys(arr[0])[0]] as T;
}

/**
 * 执行写操作 (INSERT / UPDATE / DELETE)
 */
export async function execute(
    sql: string,
    params?: QueryParams
): Promise<{ affectedRows: number; insertId: number }> {
    const [result] = await (await getPool()).query(sql, params);
    const rs = result as mysql.ResultSetHeader;
    return { affectedRows: rs.affectedRows, insertId: rs.insertId };
}

/**
 * 异步事务封装
 */
export async function transaction<T>(
    fn: (conn: mysql.PoolConnection) => Promise<T>
): Promise<T> {
    const p = await getPool();
    const conn = await p.getConnection();
    try {
        await conn.beginTransaction();
        const result = await fn(conn);
        await conn.commit();
        return result;
    } catch (err) {
        await conn.rollback();
        throw err;
    } finally {
        conn.release();
    }
}

/**
 * 关闭连接池
 */
export async function closePool(): Promise<void> {
    if (pool) {
        await pool.end();
        pool = null;
    }
}

export default getPool;
