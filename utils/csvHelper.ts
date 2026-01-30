import fs from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';

/**
 * File Helper for reading bulk upload files
 * Supports CSV, JSON, XLSX, and XLS formats
 */

export interface BulkPORecord {
  supplier?: string;
  documentDate?: string;
  purchaseOrg?: string;
  purchaseGroup?: string;
  companyCode?: string;
  accountAssignment?: string;
  material: string;
  quantity: string;
  unit?: string;
  price: string;
  plant?: string;
  glAccount?: string;
  costCenter?: string;
}

/**
 * Normalize row object keys to lowercase without spaces
 */
function normalizeRow(row: any): any {
  const normalized: any = {};
  for (const key of Object.keys(row)) {
    const normalizedKey = key.toLowerCase().replace(/\s+/g, '');
    normalized[normalizedKey] = row[key];
  }
  return normalized;
}

/**
 * Map a raw row object to BulkPORecord with flexible column name matching
 */
function mapToRecord(row: any): BulkPORecord {
  const r = normalizeRow(row);

  return {
    supplier: String(r.supplier || r.supplierno || r.vendor || ''),
    documentDate: String(r.documentdate || r.date || r.docdate || ''),
    purchaseOrg: String(r.purchaseorg || r.purchorg || r.porg || 'ACS'),
    purchaseGroup: String(r.purchasegroup || r.purchgroup || r.pgroup || 'ACS'),
    companyCode: String(r.companycode || r.company || 'ACS'),
    accountAssignment: String(r.accountassignment || r.acctassign || r.aa || 'K'),
    material: String(r.material || r.mat || 'P-A2026-3'),
    quantity: String(r.quantity || r.poquantity || r.qty || '1'),
    unit: String(r.unit || r.unitofmeasure || r.uom || 'EA'),
    price: String(r.price || r.netprice || '1000'),
    plant: String(r.plant || 'ACS'),
    glAccount: String(r.glaccount || r.gl || '610010'),
    costCenter: String(r.costcenter || r.cc || 'ACSC110')
  };
}

/**
 * Parse JSON content into array of records
 */
function parseJSON(content: string): BulkPORecord[] {
  try {
    const data = JSON.parse(content);
    const records: BulkPORecord[] = [];

    // Handle both array and single object
    const items = Array.isArray(data) ? data : [data];

    for (const item of items) {
      records.push(mapToRecord(item));
    }

    console.log(`Parsed ${records.length} records from JSON`);
    return records;
  } catch (error) {
    console.error('Error parsing JSON:', error);
    throw new Error('Invalid JSON format');
  }
}

/**
 * Parse Excel file (XLSX/XLS) into array of records
 */
function parseExcel(filePath: string): BulkPORecord[] {
  try {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    // Convert sheet to JSON
    const data = XLSX.utils.sheet_to_json(worksheet);
    const records: BulkPORecord[] = [];

    for (const row of data) {
      records.push(mapToRecord(row));
    }

    console.log(`Parsed ${records.length} records from Excel (${sheetName})`);
    return records;
  } catch (error) {
    console.error('Error parsing Excel file:', error);
    throw error;
  }
}

/**
 * Parse CSV content into array of records
 */
function parseCSV(content: string): BulkPORecord[] {
  const lines = content.split('\n').filter(line => line.trim());

  if (lines.length < 2) {
    return [];
  }

  // Parse headers
  const headers = lines[0].split(',').map(h => h.trim());
  console.log('CSV Headers:', headers);

  // Parse data rows
  const records: BulkPORecord[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim());
    const row: any = {};

    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });

    // Use common mapToRecord for consistent field mapping
    records.push(mapToRecord(row));
  }

  console.log(`Parsed ${records.length} records from CSV`);
  return records;
}

/**
 * Read bulk PO file and return array of BulkPORecord
 * Supports CSV, JSON, XLSX, and XLS formats
 */
export function readBulkPOCSV(filePath: string): BulkPORecord[] {
  try {
    const resolvedPath = path.resolve(filePath);
    const ext = path.extname(resolvedPath).toLowerCase();

    console.log(`Reading bulk PO file from: ${resolvedPath}`);
    console.log(`Detected file format: ${ext}`);

    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`File not found: ${resolvedPath}`);
    }

    let records: BulkPORecord[] = [];

    switch (ext) {
      case '.json':
        console.log('Parsing as JSON...');
        const jsonContent = fs.readFileSync(resolvedPath, 'utf-8');
        records = parseJSON(jsonContent);
        break;

      case '.xlsx':
      case '.xls':
        console.log('Parsing as Excel...');
        records = parseExcel(resolvedPath);
        break;

      case '.csv':
      default:
        console.log('Parsing as CSV...');
        const csvContent = fs.readFileSync(resolvedPath, 'utf-8');
        records = parseCSV(csvContent);
        break;
    }

    console.log(`✓ Successfully read ${records.length} rows from ${ext || 'file'}`);

    // Log first record for debugging
    if (records.length > 0) {
      console.log('First record:', JSON.stringify(records[0], null, 2));
    }

    return records;
  } catch (error) {
    console.error('Error reading bulk PO file:', error);
    throw error;
  }
}

/**
 * Async wrapper for readBulkPOCSV
 */
export async function readBulkPOCSVAsync(csvPath: string): Promise<BulkPORecord[]> {
  return readBulkPOCSV(csvPath);
}
