import oracledb from 'oracledb';
import { getPool } from '../config/oracle-database.js';

class OracleService {
  get pool() {
    const pool = getPool();
    if (!pool) {
      throw new Error('Oracle pool not initialized');
    }
    return pool;
  }

  async executeQuery(query, bindParams = {}, options = {}) {
    let connection;
    try {
      connection = await this.pool.getConnection();

      const result = await connection.execute(query, bindParams, {
        autoCommit: options.autoCommit ?? false,
        outFormat: oracledb.OUT_FORMAT_OBJECT,
        ...options,
      });

      return result;
    } catch (error) {
      console.error('Error executing query:', error);
      console.error('Query:', query);
      console.error('Bind Params:', bindParams);
      throw error;
    } finally {
      if (connection) await connection.close();
    }
  }

  async executeTransaction(operations) {
  let connection;
  try {
    connection = await this.pool.getConnection();

    const results = [];
    for (const op of operations) {
      if (op.options) {
        results.push(await connection.execute(op.sql, op.binds, op.options));
      } else {
        results.push(await connection.execute(op.sql, op.binds));
      }
    }

    await connection.commit();
    return results;
  } catch (error) {
    if (connection) await connection.rollback();
    throw error;
  } finally {
    if (connection) await connection.close();
  }
}
}

export default new OracleService();
