import express from 'express';
import  OracleService  from '../services/oracle.service.js';

const router = express.Router();
const oracleService = OracleService;

// Get all orders
router.get('/stock_item', async (req, res) => {
  try {
    const result = await oracleService.executeQuery(`SELECT * FROM stock_item ORDER BY stock_item_name`);

    res.json({
      success: true,
      data: result.rows,
      count: result.rows?.length || 0,
    });
  } catch (error) {
    console.error('Stock items fetch error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch stock items',
      details: error.message,
    });
  }
});

// Get specific order
router.get('/stock_item/:item_code', async (req, res) => {
  const { item_code } = req.params;

  if (!item_code) {
    return res.status(400).json({
      success: false,
      error: 'Stock Item Code is required',
    });
  }

  try {
    const result = await oracleService.executeQuery(`SELECT * FROM stock_item WHERE item_code = :1`, [item_code]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Stock Item not found',
      });
    }

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Database query error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

export default router;