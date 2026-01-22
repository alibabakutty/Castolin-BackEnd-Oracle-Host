import express from 'express';
import OracleService from '../services/oracle.service.js';
import { toOracleDate } from '../utils/helpers.js';
import oracledb from 'oracledb';

const router = express.Router();
const oracleService = OracleService;

// Get all orders
router.get('/orders', async (req, res) => {
  try {
    const result = await oracleService.executeQuery('SELECT * FROM orders');

    res.json({
      success: true,
      data: result.rows,
      count: result.rows?.length || 0,
    });
  } catch (error) {
    console.error('Orders fetch error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch orders',
      details: error.message,
    });
  }
});

// Get Orders by Order Number
router.get('/orders-by-number/:order_no', async (req, res) => {
  const { order_no } = req.params;
  const { created_at } = req.query; // optional filter

  if (!order_no) {
    return res.status(400).json({
      success: false,
      error: 'Order Number is required',
    });
  }

  let sql = 'SELECT * FROM orders WHERE order_no = :1';
  const params = [order_no];

  // Optional created_at filter
  if (created_at) {
    sql += ' AND created_at = :2';
    params.push(created_at);
  }

  try {
    const result = await oracleService.executeQuery(sql, params);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Order not found',
      });
    }

    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length,
    });
  } catch (error) {
    console.error('Database query error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

// Get next order number
router.get('api/orders/next-order-number', async (req, res) => {
  try {
    const result = await oracleService.executeQuery(
      `SELECT order_no FROM orders 
       WHERE order_no LIKE 'SQ-%' 
       ORDER BY created_at DESC FETCH FIRST 1 ROWS ONLY`,
    );

    let nextSequence = '0001';
    const today = new Date();
    const day = String(today.getDate()).padStart(2, '0');
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const year = today.getFullYear().toString().slice(-2);

    if (result.rows.length > 0 && result.rows[0].order_no) {
      const orderNo = result.rows[0].order_no;
      const parts = orderNo.split('-');

      if (parts.length >= 5) {
        const lastDate = `${parts[1]}-${parts[2]}-${parts[3]}`;
        const currentDate = `${day}-${month}-${year}`;

        if (lastDate === currentDate) {
          const lastSequence = parseInt(parts[4]) || 0;
          nextSequence = (lastSequence + 1).toString().padStart(4, '0');
        }
      }
    }

    res.json({
      success: true,
      orderNumber: `SQ-${day}-${month}-${year}-${nextSequence}`,
    });
  } catch (error) {
    console.error('Next order number error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Create orders (batch insert)
router.post('/orders', async (req, res) => {
  const data = req.body;

  // Validate request body
  if (!Array.isArray(data) || data.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'No orders provided',
    });
  }

  try {
    const operations = data.map((item, index) => {
      // Normalize and validate required fields
      const order_no = item.order_no?.trim();
      const order_date = toOracleDate(item.date) || new Date();
      const delivery_date = toOracleDate(item.delivery_date) || order_date; // default to order_date
      if (!order_no) throw new Error(`Order number is required for item at index ${index}`);
      if (!delivery_date) throw new Error(`Delivery date is required for order ${order_no}`);

      return {
        sql: `
          INSERT INTO orders (
            voucher_type, order_no, order_date, status, customer_code, executive, role,
            customer_name, item_code, item_name, hsn, gst, sgst, cgst, igst,
            delivery_date, delivery_mode, transporter_name, quantity, uom,
            rate, amount, net_rate, gross_amount, disc_percentage, disc_amount,
            spl_disc_percentage, spl_disc_amount, total_quantity,
            total_amount_without_tax, total_cgst_amount, total_sgst_amount,
            total_igst_amount, total_amount, remarks
          )
          VALUES (
            :voucher_type, :order_no, :order_date, :status,
            :customer_code, :executive, :role, :customer_name, :item_code,
            :item_name, :hsn, :gst, :sgst, :cgst, :igst,
            :delivery_date, :delivery_mode, :transporter_name,
            :quantity, :uom, :rate, :amount, :net_rate, :gross_amount,
            :disc_percentage, :disc_amount, :spl_disc_percentage,
            :spl_disc_amount, :total_quantity, :total_amount_without_tax,
            :total_cgst_amount, :total_sgst_amount, :total_igst_amount,
            :total_amount, :remarks
          )
          RETURNING id INTO :id
        `,
        binds: {
          voucher_type: item.voucher_type || 'Distributor Order-Web Based',
          order_no,
          order_date,
          status: item.status || 'pending',
          customer_code: item.customer_code || '',
          executive: item.executive || '',
          role: item.role || 'distributor',
          customer_name: item.customer_name || '',
          item_code: item.item_code || '',
          item_name: item.item_name || '',
          hsn: item.hsn || '',
          gst: item.gst != null ? String(item.gst).replace(/\s*%/, '') : 0,
          sgst: item.sgst ?? 0,
          cgst: item.cgst ?? 0,
          igst: item.igst ?? 0,
          delivery_date,
          delivery_mode: item.delivery_mode || '',
          transporter_name: item.transporter_name || '',
          quantity: item.quantity ?? 0,
          uom: item.uom || '',
          rate: item.rate ?? 0,
          amount: item.amount ?? 0,
          net_rate: item.net_rate ?? 0,
          gross_amount: item.gross_amount ?? 0,
          disc_percentage: item.disc_percentage ?? 0,
          disc_amount: item.disc_amount ?? 0,
          spl_disc_percentage: item.spl_disc_percentage ?? 0,
          spl_disc_amount: item.spl_disc_amount ?? 0,
          total_quantity: item.total_quantity ?? 0,
          total_amount_without_tax: item.total_amount_without_tax ?? 0,
          total_cgst_amount: item.total_cgst_amount ?? 0,
          total_sgst_amount: item.total_sgst_amount ?? 0,
          total_igst_amount: item.total_igst_amount ?? 0,
          total_amount: item.total_amount ?? 0,
          remarks: item.remarks || '',
          id: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
        },
      };
    });

    // Execute all inserts in a single transaction
    const results = await oracleService.executeTransaction(operations);

    // Extract all generated IDs from RETURNING
    const insertedIds = results.map(r => r.outBinds?.id?.[0]);

    res.json({
      success: true,
      message: 'Orders inserted successfully',
      insertedCount: data.length,
      insertedIds,
    });
  } catch (error) {
    console.error('Insert orders error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Update orders by order number
router.put('/orders-by-number/:order_no', async (req, res) => {
  const { order_no } = req.params;
  const allItems = [...req.body].sort((a, b) => (a.id || 0) - (b.id || 0));

  if (!order_no?.trim()) {
    return res.status(400).json({ success: false, error: 'Order Number is required' });
  }

  if (!Array.isArray(allItems) || allItems.length === 0) {
    return res.status(400).json({ success: false, error: 'No data provided' });
  }

  const itemsToInsert = allItems.filter(i => !i.id && !i._deleted);
  const itemsToUpdate = allItems.filter(i => i.id && !i._deleted);
  const itemsToDelete = allItems.filter(i => i.id && i._deleted);

  try {
    const operations = [];

    // Delete operations
    if (itemsToDelete.length) {
      const ids = itemsToDelete.map(i => i.id);
      const binds = ids.map((_, i) => `:${i + 1}`).join(',');
      operations.push({
        sql: `DELETE FROM orders WHERE id IN (${binds}) AND order_no = :${ids.length + 1}`,
        binds: [...ids, order_no],
      });
    }

    // Update operations
    const allowedFields = [
      'status',
      'disc_percentage',
      'disc_amount',
      'spl_disc_percentage',
      'spl_disc_amount',
      'net_rate',
      'gross_amount',
      'quantity',
      'gst',
      'sgst',
      'cgst',
      'igst',
      'hsn',
      'rate',
      'amount',
      'uom',
      'item_code',
      'item_name',
      'delivery_date',
      'delivery_mode',
      'transporter_name',
      'total_quantity',
      'total_amount',
      'total_amount_without_tax',
      'total_sgst_amount',
      'total_cgst_amount',
      'total_igst_amount',
      'remarks',
      'order_date',
    ];

    for (const row of itemsToUpdate) {
      const { id, _deleted, ...fields } = row;
      const filtered = Object.fromEntries(
        Object.entries(fields).filter(([k]) => allowedFields.includes(k)),
      );

      if (!Object.keys(filtered).length) continue;

      const keys = Object.keys(filtered);
      const setClause = keys.map((k, i) => `${k} = :${i + 1}`).join(', ');
      const values = keys.map(k => {
        if (k === 'order_date' || k === 'delivery_date') {
          return toOracleDate(filtered[k]);
        }
        return filtered[k];
      });
      values.push(id, order_no);

      operations.push({
        sql: `UPDATE orders SET ${setClause} WHERE id = :${values.length - 1} AND order_no = :${
          values.length
        }`,
        binds: values,
      });
    }

    // Insert operations
    for (const item of itemsToInsert) {
      const insertData = {
        order_no,
        voucher_type: item.voucher_type || 'Distributor Order-Web Based',
        order_date: toOracleDate(item.order_date) || new Date(),
        customer_code: item.customer_code || '',
        customer_name: item.customer_name || '',
        executive: item.executive || '',
        role: item.role || 'distributor',
        status: item.status || 'pending',
        item_code: item.item_code || '',
        item_name: item.item_name || '',
        hsn: item.hsn || '',
        gst: item.gst || 0,
        sgst: item.sgst || 0,
        cgst: item.cgst || 0,
        igst: item.igst || 0,
        delivery_date: toOracleDate(item.delivery_date),
        delivery_mode: item.delivery_mode || '',
        transporter_name: item.transporter_name || '',
        quantity: item.quantity || 0,
        uom: item.uom || '',
        rate: item.rate || 0,
        amount: item.amount || 0,
        net_rate: item.net_rate || 0,
        gross_amount: item.gross_amount || 0,
        disc_percentage: item.disc_percentage || 0,
        disc_amount: item.disc_amount || 0,
        spl_disc_percentage: item.spl_disc_percentage || 0,
        spl_disc_amount: item.spl_disc_amount || 0,
        total_quantity: item.total_quantity || 0,
        total_amount: item.total_amount || 0,
        total_amount_without_tax: item.total_amount_without_tax || 0,
        total_sgst_amount: item.total_sgst_amount || 0,
        total_cgst_amount: item.total_cgst_amount || 0,
        total_igst_amount: item.total_igst_amount || 0,
        remarks: item.remarks || '',
      };

      const cols = Object.keys(insertData);
      const vals = Object.values(insertData);
      const binds = cols.map((_, i) => `:${i + 1}`).join(',');

      operations.push({
        sql: `INSERT INTO orders (${cols.join(',')}) VALUES (${binds})`,
        binds: vals,
      });
    }

    await oracleService.executeTransaction(operations);

    // Get updated orders
    const result = await oracleService.executeQuery(
      'SELECT * FROM orders WHERE order_no = :1 ORDER BY id',
      [order_no],
    );

    res.json({
      success: true,
      data: result.rows,
      operations: {
        inserted: itemsToInsert.length,
        updated: itemsToUpdate.length,
        deleted: itemsToDelete.length,
      },
    });
  } catch (error) {
    console.error('❌ Transaction failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
