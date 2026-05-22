import express from "express";
import { leadsCol } from "./db.js"; // assuming leadsCol exported (need to export) 
import ExcelJS from "exceljs";

const router = express.Router();

// Helper to format stats
router.get("/stats", async (req, res) => {
    const total = await leadsCol.estimatedDocumentCount();
    const byStatus = await leadsCol.aggregate([
      { $group: { _id: "$holat", count: { $sum: 1 } } }
    ]).toArray();
    const upcoming = await leadsCol.find({
      uchrashuv_vaqti: { $gt: new Date() }
    }).sort({ uchrashuv_vaqti: 1 }).limit(5).toArray();
    // Provide empty placeholders for additional series
    const leadsPerDay = [];
    const meetingsPerDay = [];
    res.json({ total, byStatus, upcoming, leadsPerDay, meetingsPerDay });
});

// Export leads as Excel
router.get("/leads/export", async (req, res) => {
  try {
    const leads = await leadsCol.find({}).toArray();
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Leads");
    // header
    sheet.columns = [
      { header: "ID", key: "id", width: 24 },
      { header: "Ismi", key: "ismi", width: 20 },
      { header: "Tel", key: "tel", width: 15 },
      { header: "Holat", key: "holat", width: 15 },
      { header: "Uchrashuv Vaqti", key: "uchrashuv_vaqti", width: 25 },
      { header: "Created At", key: "created_at", width: 25 }
    ];
    leads.forEach(l => {
      sheet.addRow({
        id: String(l._id),
        ismi: l.ismi,
        tel: l.tel,
        holat: l.holat,
        uchrashuv_vaqti: l.uchrashuv_vaqti,
        created_at: l.created_at
      });
    });
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", "attachment; filename=leads.xlsx");
    await workbook.xlsx.write(res);
    res.end();
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "server_error" });
  }
});

export default router;
