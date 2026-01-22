import express from 'express';
import { corsMiddleware } from './middleware/cors.js';
import  OracleService  from './services/oracle.service.js';
import { getPool } from './config/oracle-database.js';

// Import routes
import authRoutes from './routes/auth.js';
import adminRoutes from './routes/admin.js';
import customerRoutes from './routes/customers.js';
import orderRoutes from './routes/orders.js';
import stockRoutes from './routes/stock_item.js';

export const createApp = () => {
  const app = express();
  
  // Get pool and create OracleService
  const pool = getPool();
  const oracleService = OracleService;

  // Middleware
  app.use(corsMiddleware);
  app.use(express.json());

  // Health check
  app.get('/health', async (req, res) => {
    try {
      let oracleStatus = 'Disconnected';
      if (pool) {
        try {
          const connection = await pool.getConnection();
          await connection.execute('SELECT 1 FROM dual');
          oracleStatus = 'Connected';
          await connection.close();
        } catch (error) {
          oracleStatus = 'Connection Error';
        }
      }

      res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        oracle: oracleStatus,
        pool: pool ? 'Active' : 'Not initialized',
      });
    } catch (error) {
      res.status(500).json({
        status: 'ERROR',
        error: error.message,
      });
    }
  });

  // Test endpoint
  app.get('/test-query', async (req, res) => {
    try {
      const result = await oracleService.executeQuery(
        "SELECT 'Hello World' as message, SYSDATE as current_date FROM dual",
        {},
      );

      res.json({
        success: true,
        data: result.rows,
        meta: {
          rowsAffected: result.rowsAffected,
          rowsReturned: result.rows?.length || 0,
        },
      });
    } catch (error) {
      console.error('Test query error:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        errorCode: error.errorNum || error.code,
      });
    }
  });

  // Simple version for debugging (kept from original)
  app.get('/me-admin-simple', async (req, res) => {
    let connection;
    try {
      connection = await pool.getConnection();
      const result = await connection.execute(
        `SELECT id, username, email, role, mobile_number
         FROM admins
         WHERE firebase_uid = :uid`,
        { uid: req.query.uid },
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Admin not found' });
      }

      res.json(result.rows[0]);
    } catch (error) {
      console.error('Admin profile error (direct):', error);
      res.status(500).json({
        error: 'Database error',
        details: error.message,
        code: error.errorNum,
      });
    } finally {
      if (connection) {
        await connection.close();
      }
    }
  });

  // Mount routes with oracleService passed as middleware
  app.use((req, res, next) => {
    req.oracleService = oracleService;
    next();
  });

  app.use(authRoutes);
  app.use(adminRoutes);
  app.use(customerRoutes);
  app.use(orderRoutes);
  app.use(stockRoutes);

  // 404 handler
  app.use((req, res) => {
    res.status(404).json({
      error: 'Route not found',
      availableRoutes: [
        'GET    /health',
        'GET    /test-query',
        'POST   /signup-admin (requires auth)',
        'POST   /login-admin (requires auth)',
        'GET    /me-admin (requires auth)',
        'GET    /me-admin-alt (requires auth)',
        'GET    /me-admin-simple',
        'GET    /me-distributor (requires auth)',
        'GET    /me-corporate (requires auth)',
        'GET    /admins',
        'GET    /admins/:id',
        'GET    /customer',
        'GET    /customer/:customer_code',
        'GET    /distributors',
        'GET    /distributors/:customer_code',
        'PUT    /distributors/:customer_code',
        'GET    /corporates',
        'GET    /corporates/:customer_code',
        'PUT    /corporates/:customer_code',
        'GET    /stock_item',
        'GET    /stock_item/:item_code',
        'GET    /orders',
        'GET    /orders/:id',
        'GET    /orders-by-number/:order_no',
        'GET    /api/orders/next-order-number',
        'POST   /orders',
        'PUT    /orders-by-number/:order_no'
      ]
    });
  });

  // Error handler
  app.use((error, req, res, next) => {
    console.error('Server error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  });

  return app;
};