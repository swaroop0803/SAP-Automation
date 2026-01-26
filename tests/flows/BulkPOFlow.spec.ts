import { test } from '@playwright/test';
import { Login } from '../Login';
import { BulkPurchaseOrderCreation, POParameters } from '../BulkPurchaseOrder';
import { readBulkPOCSV } from '../../utils/csvHelper';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Bulk PO Creation Test
 * Reads CSV file from BULK_CSV_PATH environment variable
 * Creates all POs in a single browser session (more efficient)
 */

test('Create Bulk Purchase Orders from CSV', async ({ page }) => {
    // Get CSV path from environment variable or use default from frontend public folder
    let csvPath = process.env.BULK_CSV_PATH;

    if (!csvPath) {
        console.log('No BULK_CSV_PATH provided, using default test file from frontend/public');
        // Use the test file from frontend public folder
        const defaultPath = path.join(__dirname, '../../frontend/public/sample-bulk-po.csv');
        if (fs.existsSync(defaultPath)) {
            csvPath = defaultPath;
        } else {
            throw new Error('BULK_CSV_PATH environment variable is required or create frontend/public/test-bulk-upload.csv');
        }
    }

    console.log('Reading bulk PO data from:', csvPath);

    // Read CSV file
    const records = readBulkPOCSV(csvPath);

    if (records.length === 0) {
        throw new Error('No records found in CSV file');
    }

    console.log(`Found ${records.length} PO records to create`);

    // Step 1: Login once
    console.log('='.repeat(50));
    console.log('Step 1: Logging into SAP');
    console.log('='.repeat(50));
    await Login(page);

    // Results tracking
    const results: Array<{ row: number; material: string; poNumber?: string; error?: string }> = [];

    // Step 2: Create each PO
    for (let i = 0; i < records.length; i++) {
        const record = records[i];
        const rowNum = i + 1;

        console.log('='.repeat(50));
        console.log(`Processing row ${rowNum}/${records.length}: Supplier=${record.supplier || 'F4'}, Material=${record.material}, Qty=${record.quantity}, Price=${record.price}`);
        console.log('='.repeat(50));

        // Skip records with document date year 2025
        if (record.documentDate && record.documentDate.includes('2025')) {
            console.log(`SKIPPED: Row ${rowNum} has document date with year 2025 (${record.documentDate})`);
            results.push({
                row: rowNum,
                material: record.material,
                error: 'Skipped - Document date year is 2025'
            });
            continue;
        }

        try {
            // Map CSV record to POParameters
            const params: POParameters = {
                supplier: record.supplier || '',
                documentDate: record.documentDate || '',
                purchaseOrg: record.purchaseOrg || 'ACS',
                purchaseGroup: record.purchaseGroup || 'ACS',
                companyCode: record.companyCode || 'ACS',
                accountAssignment: record.accountAssignment || 'K',
                material: record.material || 'P-A2026-3',
                quantity: record.quantity || '1',
                unit: record.unit || 'EA',
                price: record.price || '1000',
                plant: record.plant || 'ACS',
                glAccount: record.glAccount || '610010',
                costCenter: record.costCenter || 'ACSC110'
            };

            // Create PO
            const poNumber = await BulkPurchaseOrderCreation(page, params);

            // Log success in format that backend can parse
            console.log(`PO Created: ${poNumber} for row ${rowNum}`);

            results.push({
                row: rowNum,
                material: record.material,
                poNumber: poNumber
            });

            // Save PO number to results CSV
            const resultsPath = path.join(__dirname, '../../utils/bulk_po_results.csv');
            const timestamp = new Date().toISOString();
            const csvLine = `${poNumber},${record.material},${record.quantity},${record.price},${timestamp}\n`;

            if (!fs.existsSync(resultsPath)) {
                fs.writeFileSync(resultsPath, 'PO_Number,Material,Quantity,Price,Timestamp\n');
            }
            fs.appendFileSync(resultsPath, csvLine);

            // Also save to poDetails.csv for supplier invoice amount calculation
            const poDetailsPath = path.join(__dirname, '../../utils/poDetails.csv');
            const poDetailsLine = `${poNumber},${record.material},${record.quantity},${record.price},${timestamp}\n`;
            fs.appendFileSync(poDetailsPath, poDetailsLine);
            console.log(`PO Details saved to poDetails.csv for supplier invoice calculation`);

        } catch (error: any) {
            console.error(`Failed to create PO for row ${rowNum}:`, error.message);

            results.push({
                row: rowNum,
                material: record.material,
                error: error.message
            });

            // Continue with next record instead of stopping
            console.log('Continuing with next record...');

            // Navigate back to home to start fresh for next PO
            try {
                await page.getByRole('button', { name: 'Home', exact: true }).click();
                await page.waitForTimeout(2000);
            } catch {
                // If we can't navigate home, try to reload
                await page.reload();
                await page.waitForTimeout(3000);
            }
        }

        // Small delay between POs
        if (i < records.length - 1) {
            await page.waitForTimeout(1000);
        }
    }

    // Final summary
    console.log('='.repeat(50));
    console.log('BULK PO CREATION SUMMARY');
    console.log('='.repeat(50));

    const successCount = results.filter(r => r.poNumber).length;
    const failCount = results.filter(r => r.error).length;

    console.log(`Total: ${records.length}`);
    console.log(`Success: ${successCount}`);
    console.log(`Failed: ${failCount}`);

    results.forEach(r => {
        if (r.poNumber) {
            console.log(`  ✓ Row ${r.row}: ${r.material} -> PO ${r.poNumber}`);
        } else {
            console.log(`  ✗ Row ${r.row}: ${r.material} -> ERROR: ${r.error}`);
        }
    });

    console.log('='.repeat(50));

    // Cleanup: Delete the CSV file after processing
    try {
        if (csvPath && fs.existsSync(csvPath)) {
            fs.unlinkSync(csvPath);
            console.log(`Cleanup: Deleted CSV file: ${csvPath}`);
        }
    } catch (cleanupError) {
        console.error('Cleanup: Failed to delete CSV file:', cleanupError);
    }

    // Fail test if any PO creation failed
    if (failCount > 0) {
        throw new Error(`${failCount} out of ${records.length} PO creations failed`);
    }
});
