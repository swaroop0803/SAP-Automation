import fs from 'fs';
import path from 'path';

/**
 * CSV Helper for reading bulk upload files
 * Supports CSV format with headers
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
 * Parse CSV content into array of records
 */
function parseCSV(content: string): BulkPORecord[] {
  const lines = content.split('\n').filter(line => line.trim());

  if (lines.length < 2) {
    return [];
  }

  // Parse headers (lowercase, remove spaces)
  const headers = lines[0].split(',').map(h =>
    h.trim().toLowerCase().replace(/\s+/g, '')
  );

  console.log('CSV Headers:', headers);

  // Parse data rows
  const records: BulkPORecord[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim());
    const row: any = {};

    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });

    // Map to BulkPORecord with flexible column name matching
    const record: BulkPORecord = {
      supplier: row.supplier || row.supplierno || row.vendor || '',
      documentDate: row.documentdate || row.date || row.docdate || '',
      purchaseOrg: row.purchaseorg || row.purchorg || row.porg || 'ACS',
      purchaseGroup: row.purchasegroup || row.purchgroup || row.pgroup || 'ACS',
      companyCode: row.companycode || row.company || row.cc || 'ACS',
      accountAssignment: row.accountassignment || row.acctassign || row.aa || 'K',
      material: row.material || row.mat || 'P-A2026-3',
      quantity: row.quantity || row.poquantity || row.qty || '1',
      unit: row.unit || row.unitofmeasure || row.uom || 'EA',
      price: row.price || row.netprice || '1000',
      plant: row.plant || 'ACS',
      glAccount: row.glaccount || row.gl || '610010',
      costCenter: row.costcenter || row.cc || 'ACSC110'
    };

    records.push(record);
  }

  console.log(`Parsed ${records.length} records from CSV`);
  return records;
}

/**
 * Read CSV file and return array of BulkPORecord
 */
export function readBulkPOCSV(csvPath: string): BulkPORecord[] {
  try {
    console.log(`Reading CSV from: ${csvPath}`);

    const resolvedPath = path.resolve(csvPath);
    console.log(`Resolved path: ${resolvedPath}`);

    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`CSV file not found: ${resolvedPath}`);
    }

    const content = fs.readFileSync(resolvedPath, 'utf-8');
    const records = parseCSV(content);

    console.log(`✓ Successfully read ${records.length} rows from CSV`);
    return records;
  } catch (error) {
    console.error('Error reading CSV file:', error);
    throw error;
  }
}

/**
 * Async wrapper for readBulkPOCSV
 */
export async function readBulkPOCSVAsync(csvPath: string): Promise<BulkPORecord[]> {
  return readBulkPOCSV(csvPath);
}
