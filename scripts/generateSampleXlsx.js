// Script to generate sample XLSX file for bulk PO upload
const XLSX = require('../backend/node_modules/xlsx');
const path = require('path');

const data = [
  {
    Supplier: "1",
    DocumentDate: "24.01.2026",
    PurchaseOrg: "ACS",
    PurchaseGroup: "ACS",
    CompanyCode: "ACS",
    AccountAssignment: "K",
    Material: "P-A2026-2",
    Quantity: 11,
    Unit: "EA",
    Price: 1299,
    Plant: "ACS",
    GLAccount: "610010",
    CostCenter: "ACSC110"
  },
  {
    Supplier: "1",
    DocumentDate: "23.01.2026",
    PurchaseOrg: "ACS",
    PurchaseGroup: "ACS",
    CompanyCode: "ACS",
    AccountAssignment: "K",
    Material: "P-A2026-3",
    Quantity: 34,
    Unit: "EA",
    Price: 4763,
    Plant: "ACS",
    GLAccount: "610010",
    CostCenter: "ACSC110"
  },
  {
    Supplier: "1",
    DocumentDate: "24.01.2026",
    PurchaseOrg: "ACS",
    PurchaseGroup: "ACS",
    CompanyCode: "ACS",
    AccountAssignment: "K",
    Material: "P-A2026-2",
    Quantity: 99,
    Unit: "EA",
    Price: 2541,
    Plant: "ACS",
    GLAccount: "610010",
    CostCenter: "ACSC110"
  }
];

// Create workbook and worksheet
const workbook = XLSX.utils.book_new();
const worksheet = XLSX.utils.json_to_sheet(data);

// Add worksheet to workbook
XLSX.utils.book_append_sheet(workbook, worksheet, 'PurchaseOrders');

// Write XLSX file
const xlsxPath = path.join(__dirname, '../frontend/public/sample-bulk-po.xlsx');
XLSX.writeFile(workbook, xlsxPath);
console.log('Created:', xlsxPath);

// Write XLS file (older format)
const xlsPath = path.join(__dirname, '../frontend/public/sample-bulk-po.xls');
XLSX.writeFile(workbook, xlsPath, { bookType: 'xls' });
console.log('Created:', xlsPath);

console.log('Sample files generated successfully!');
