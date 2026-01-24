import express from 'express';
import cors from 'cors';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

interface ParsedCommand {
  action: string;
  testFile: string;
  envVars: Record<string, string>;
  description: string;
}

// Helper function to check if command matches any pattern
function matchesAny(command: string, patterns: string[]): boolean {
  return patterns.some(pattern => command.includes(pattern));
}

// Helper function to normalize command (remove conversational prefixes)
function normalizeCommand(command: string): string {
  let normalized = command.toLowerCase();

  // Remove common conversational prefixes
  const prefixes = [
    'can you ', 'could you ', 'would you ', 'will you ', 'shall we ',
    'please ', 'pls ', 'plz ', 'kindly ',
    'i want to ', 'i need to ', 'i would like to ', 'i\'d like to ',
    'let\'s ', 'lets ', 'let us ', 'we need to ', 'we want to ',
    'help me ', 'help me to ', 'help us ',
    'i want ', 'i need ', 'we need ', 'we want '
  ];

  for (const prefix of prefixes) {
    if (normalized.startsWith(prefix)) {
      normalized = normalized.substring(prefix.length);
    }
  }

  // Remove trailing words and punctuation
  normalized = normalized.replace(/\?+$/, '').trim();
  normalized = normalized.replace(/ please$/, '').trim();
  normalized = normalized.replace(/ now$/, '').trim();
  normalized = normalized.replace(/ for me$/, '').trim();

  return normalized;
}

// Helper function to check fuzzy match
function fuzzyMatch(command: string, target: string): boolean {
  if (command.includes(target)) return true;

  const words = command.split(/\s+/);
  for (const word of words) {
    if (word.length >= 3 && target.length >= 3) {
      if (word.substring(0, 3) === target.substring(0, 3) && Math.abs(word.length - target.length) <= 2) {
        return true;
      }
      let matches = 0;
      const minLen = Math.min(word.length, target.length);
      for (let i = 0; i < minLen; i++) {
        if (word[i] === target[i]) matches++;
      }
      if (matches >= minLen - 2 && matches >= 3) return true;
    }
  }
  return false;
}

// Natural language command parser
function parseCommand(command: string): ParsedCommand {
  const originalCommand = command;
  const lowerCommand = normalizeCommand(command);
  const hasNumber = /\d{10}/.test(command);

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. PROCEDURE TO PAY (End-to-End) - Check first as it's the full flow
  // ═══════════════════════════════════════════════════════════════════════════
  const p2pPatterns = [
    // Direct
    'p2p', 'p-p', 'p 2 p', 'p to p',
    'procure to pay', 'procure-to-pay', 'procuretopay', 'procedure to pay',
    'purchase to pay', 'purchase-to-pay', 'purchasetopay',
    'purchase to payment', 'purchase-to-payment',
    // Flow variations
    'full flow', 'complete flow', 'entire flow', 'whole flow',
    'full process', 'complete process', 'entire process', 'whole process',
    'end to end', 'end-to-end', 'e2e', 'endtoend',
    // Command style
    'run all', 'execute all', 'start all', 'do all',
    'run full', 'execute full', 'run complete', 'execute complete',
    'run entire', 'execute entire', 'start full', 'start complete',
    // SAP specific
    'full sap', 'complete sap', 'entire sap', 'whole sap',
    'procurement flow', 'procurement process',
    'sap flow', 'sap automation', 'sap process',
    'run sap', 'execute sap', 'start sap',
    'full p2p', 'complete p2p', 'entire p2p',
    'full procedure', 'complete procedure', 'entire procedure',
    'run the full', 'execute the full', 'run the complete',
    'run the entire', 'start the full', 'start the complete'
  ];

  if (matchesAny(lowerCommand, p2pPatterns)) {
    return {
      action: 'procure_to_pay',
      testFile: 'tests/procureToPay.spec.ts',
      envVars: {},
      description: 'Running complete Procure-to-Pay flow'
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. PURCHASE ORDER CREATION (No PO number needed)
  // ═══════════════════════════════════════════════════════════════════════════
  const poPatterns = [
    // Simple / Direct
    'purchase order', 'purchaseorder', 'a purchase order',
    'create po', 'create a po', 'create new po', 'create a new po',
    'generate po', 'generate a po', 'generate purchase order',
    'start po', 'start a po', 'start purchase order',
    'new po', 'new purchase order', 'make po', 'make a po',
    // With parameters
    'po with company', 'po for company', 'po with vendor', 'po for vendor',
    'purchase order with', 'purchase order for',
    'po with default', 'po default values',
    // Command style
    'run po', 'run purchase order', 'execute po', 'execute purchase order',
    'start po process', 'start po creation', 'start po flow',
    'run po creation', 'run po process', 'run po flow',
    'execute po creation', 'execute po process', 'execute po flow',
    'po creation', 'po process', 'po flow',
    // Conversational
    'want a po', 'want a purchase order', 'need a po', 'need a purchase order',
    'want po', 'need po', 'get po', 'get a po',
    // Misspellings
    'purshase order', 'purchse order', 'puchase order', 'purchas order',
    'purchese order', 'purhcase order', 'pruchase order',
    'purchasing order', 'purchasng order',
    'creat po', 'crate po', 'craete po'
  ];

  const isPOCreation = matchesAny(lowerCommand, poPatterns) ||
    (lowerCommand.includes('po') && !hasNumber &&
     (lowerCommand.includes('creat') || lowerCommand.includes('new') ||
      lowerCommand.includes('make') || lowerCommand.includes('generat') ||
      lowerCommand.includes('start') || lowerCommand.includes('run') ||
      lowerCommand.includes('execut')));

  if (isPOCreation && !hasNumber) {
    return {
      action: 'purchase_order',
      testFile: 'tests/flows/PurchaseOrderFlow.spec.ts',
      envVars: {},
      description: 'Creating Purchase Order'
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. SUPPLIER INVOICE (Needs PO Number) - Check BEFORE Goods Receipt
  // ═══════════════════════════════════════════════════════════════════════════
  const invoicePatterns = [
    // Simple / Direct
    'invoice', 'invocie', 'invioce', 'invoce', 'invice', 'inoice', 'incoice',
    'supplier invoice', 'vendor invoice', 'supplier inv', 'vendor inv',
    'create invoice', 'create an invoice', 'create supplier invoice',
    'generate invoice', 'generate an invoice', 'generate supplier invoice',
    'post invoice', 'post an invoice', 'post supplier invoice',
    'new invoice', 'make invoice', 'make an invoice',
    // With PO reference
    'invoice for po', 'invoice for purchase order', 'invoice for this po',
    'invoice with po', 'invoice with this po', 'invoice with purchase order',
    'invoice against po', 'invoice against this po', 'invoice against purchase order',
    'invoice linked to', 'invoice using po', 'invoice using this po',
    'invoice for', 'invoice with', 'invoice using', 'invoice against',
    'an invoice for', 'an invoice with', 'an invoice linked',
    // Command style
    'run invoice', 'run invoice creation', 'run supplier invoice',
    'execute invoice', 'execute invoice creation', 'execute supplier invoice',
    'start invoice', 'start invoice creation', 'start supplier invoice',
    'invoice creation', 'invoice process', 'invoice flow',
    // Conversational
    'want invoice', 'want an invoice', 'need invoice', 'need an invoice',
    'create an invoice for', 'create invoice for',
    // Misspellings
    'suppliar invoice', 'suplier invoice', 'suppiler invoice', 'supp invoice',
    'supplyer invoice', 'suppllier invoice',
    'creat invoice', 'crate invoice', 'craete invoice',
    'invoic for', 'invice for', 'invocie for'
  ];

  const isInvoice = matchesAny(lowerCommand, invoicePatterns) ||
    (lowerCommand.includes('invoice') && hasNumber) ||
    (lowerCommand.includes('supplier') && hasNumber && !lowerCommand.includes('goods')) ||
    fuzzyMatch(lowerCommand, 'invoice');

  if (isInvoice) {
    const poNumber = extractPONumber(originalCommand);
    if (!poNumber) {
      return {
        action: 'invoice_missing_po',
        testFile: '',
        envVars: {},
        description: 'ERROR: PO Number is required. Example: "Create invoice for PO 4500001075"'
      };
    }
    return {
      action: 'supplier_invoice',
      testFile: 'tests/flows/SupplierInvoiceFlow.spec.ts',
      envVars: { PO_NUMBER: poNumber },
      description: `Creating Supplier Invoice for PO ${poNumber}`
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. GOODS RECEIPT (Needs PO Number)
  // ═══════════════════════════════════════════════════════════════════════════
  const grPatterns = [
    // Simple / Direct
    'goods receipt', 'goods reciept', 'goods recept', 'goods recipt',
    'good receipt', 'good reciept', 'good recept',
    'goods', 'create goods', 'post goods',
    'create gr', 'post gr', 'generate gr', 'new gr', 'make gr',
    'create goods receipt', 'post goods receipt', 'generate goods receipt',
    // With PO reference
    'goods for po', 'goods for purchase order', 'goods for this po',
    'goods with po', 'goods with this po', 'goods receipt for po',
    'gr for po', 'gr for purchase order', 'gr for this po',
    'gr with po', 'gr with this po', 'gr against po',
    'goods receipt using', 'goods receipt against',
    'goods for', 'goods with', 'goods using', 'goods against',
    'gr for', 'gr with', 'gr using', 'gr against',
    // Command style
    'run goods', 'run gr', 'run goods receipt',
    'execute goods', 'execute gr', 'execute goods receipt',
    'start goods', 'start gr', 'start goods receipt',
    'goods receipt flow', 'goods receipt process', 'goods receipt creation',
    'gr flow', 'gr process', 'gr creation',
    // SAP specific
    'goods movement', 'goods movment', 'goods mvmt',
    'material receipt', 'material reciept', 'material document',
    'migo', 'grn', 'goods note',
    // Conversational
    'receive goods', 'recieve goods', 'receiving goods', 'received goods',
    'want goods', 'want gr', 'need goods', 'need gr',
    'post goods for', 'create goods for',
    // Misspellings
    'good reciept', 'goods reciet', 'goods recipet', 'godds receipt',
    'creat goods', 'crate goods', 'creat gr', 'crate gr'
  ];

  const isGoodsReceipt = matchesAny(lowerCommand, grPatterns) ||
    (lowerCommand.includes('goods') && hasNumber) ||
    (lowerCommand.match(/\bgr\b/) && hasNumber) ||
    (lowerCommand.includes('receipt') && hasNumber && !lowerCommand.includes('supplier') && !lowerCommand.includes('invoice')) ||
    fuzzyMatch(lowerCommand, 'goods');

  if (isGoodsReceipt) {
    const poNumber = extractPONumber(originalCommand);
    if (!poNumber) {
      return {
        action: 'goods_receipt_missing_po',
        testFile: '',
        envVars: {},
        description: 'ERROR: PO Number is required. Example: "Post GR for PO 4500001075"'
      };
    }
    return {
      action: 'goods_receipt',
      testFile: 'tests/flows/GoodsReceiptFlow.spec.ts',
      envVars: { PO_NUMBER: poNumber },
      description: `Posting Goods Receipt for PO ${poNumber}`
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 5. PAYMENT (Needs Invoice Number)
  // ═══════════════════════════════════════════════════════════════════════════
  const paymentPatterns = [
    // Simple / Direct
    'payment', 'payemnt', 'paymnt', 'paymet', 'paymnet', 'payement',
    'create payment', 'create a payment', 'create new payment',
    'make payment', 'make a payment', 'make the payment',
    'process payment', 'process a payment', 'process the payment',
    'schedule payment', 'schedule a payment', 'schedule the payment',
    'execute payment', 'execute a payment', 'execute the payment',
    'run payment', 'run a payment', 'run the payment',
    'start payment', 'start a payment', 'start the payment',
    // With Invoice reference
    'payment for invoice', 'payment for this invoice', 'payment for inv',
    'payment with invoice', 'payment with this invoice',
    'payment against invoice', 'payment against this invoice',
    'payment using invoice', 'payment using this invoice',
    'pay for invoice', 'pay for this invoice', 'pay this invoice',
    'pay invoice', 'pay the invoice', 'pay inv',
    'payment for', 'payment with', 'payment using', 'payment against',
    // Command style
    'run payment process', 'run payment flow',
    'execute payment process', 'execute payment flow',
    'start payment process', 'start payment flow',
    'payment creation', 'payment process', 'payment flow', 'payment run',
    // SAP specific
    'automatic payment', 'auto payment', 'f110', 'f-110',
    'vendor payment', 'supplier payment',
    // Conversational
    'want payment', 'want a payment', 'need payment', 'need a payment',
    'pay for', 'pay with', 'pay using', 'paying',
    'make payment for', 'process payment for',
    // Misspellings
    'payemnt for', 'paymnet for', 'paymet for', 'payement for',
    'creat payment', 'crate payment', 'craete payment'
  ];

  const isPayment = matchesAny(lowerCommand, paymentPatterns) ||
    (lowerCommand.includes('pay') && hasNumber) ||
    fuzzyMatch(lowerCommand, 'payment');

  if (isPayment) {
    const invoiceNumber = extractInvoiceNumber(originalCommand);
    if (!invoiceNumber) {
      return {
        action: 'payment_missing_invoice',
        testFile: '',
        envVars: {},
        description: 'ERROR: Invoice Number is required. Example: "Process payment for invoice 5105600001"'
      };
    }
    return {
      action: 'payment',
      testFile: 'tests/flows/PaymentFlow.spec.ts',
      envVars: { INVOICE_NUMBER: invoiceNumber },
      description: `Processing Payment for Invoice ${invoiceNumber}`
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DEFAULT - Unknown command with helpful suggestions
  // ═══════════════════════════════════════════════════════════════════════════
  return {
    action: 'unknown',
    testFile: '',
    envVars: {},
    description: `Unknown command. Try:\n• "Create PO" or "Create purchase order"\n• "Create goods for PO 4500001075" or "Post GR for PO 4500001075"\n• "Create invoice for PO 4500001075"\n• "Process payment for invoice 5105600001"\n• "Run P2P" or "Procedure to pay"`
  };
}

// Extract PO Number from command (flexible natural language)
function extractPONumber(command: string): string | null {
  // Match PO number patterns - more flexible for natural language
  const patterns = [
    /po\s*#?\s*(\d{10})/i,                    // PO 4500001075 or PO# 4500001075
    /po\s*number\s*:?\s*(\d{10})/i,           // PO number: 4500001075
    /po\s+(\d+)/i,                             // PO followed by any number
    /with\s+(?:this\s+)?(\d{10})/i,           // with this 4500000130 or with 4500000130
    /for\s+(?:this\s+)?(\d{10})/i,            // for this 4500000130 or for 4500000130
    /number\s*:?\s*(\d{10})/i,                // number: 4500000130
    /(4500\d{6})/,                             // 4500000130 (SAP PO format - standalone)
    /\b(\d{10})\b/,                            // Any 10-digit number as fallback
  ];

  for (const pattern of patterns) {
    const match = command.match(pattern);
    if (match) {
      return match[1];
    }
  }
  return null;
}

// Extract Invoice Number from command (flexible natural language)
function extractInvoiceNumber(command: string): string | null {
  const patterns = [
    /invoice\s*#?\s*(\d{10})/i,               // invoice 5105600001
    /invoice\s*number\s*:?\s*(\d{10})/i,      // invoice number: 5105600001
    /invoice\s+(\d+)/i,                        // invoice followed by any number
    /with\s+(?:this\s+)?(\d{10})/i,           // with this 5105600001 or with 5105600001
    /for\s+(?:this\s+)?(\d{10})/i,            // for this 5105600001 or for 5105600001
    /number\s*:?\s*(\d{10})/i,                // number: 5105600001
    /(5105\d{6})/,                             // 5105600001 (SAP Invoice format - standalone)
    /\b(\d{10})\b/,                            // Any 10-digit number as fallback
  ];

  for (const pattern of patterns) {
    const match = command.match(pattern);
    if (match) {
      return match[1];
    }
  }
  return null;
}

// Execute Playwright test
async function executeTest(command: string) {
  const startTime = Date.now();
  const steps: any[] = [];

  try {
    const parsed = parseCommand(command);

    // Check for errors in parsing
    if (parsed.action === 'unknown' || parsed.action.includes('missing')) {
      return {
        success: false,
        message: parsed.description,
        duration: 0,
        steps: [{
          id: 'error',
          description: parsed.description,
          status: 'failed',
          timestamp: new Date()
        }],
        errors: [parsed.description]
      };
    }

    // Add initial steps
    steps.push({
      id: 'step-1',
      description: `Parsing command: "${command}"`,
      status: 'completed',
      timestamp: new Date()
    });

    steps.push({
      id: 'step-2',
      description: parsed.description,
      status: 'running',
      timestamp: new Date()
    });

    // Execute the actual Playwright test
    const projectRoot = path.resolve(__dirname, '../..');
    const testCommand = `npx playwright test ${parsed.testFile}`;

    console.log('Executing:', testCommand);
    console.log('In directory:', projectRoot);
    console.log('Environment variables:', parsed.envVars);

    const { stdout, stderr } = await execAsync(testCommand, {
      cwd: projectRoot,
      timeout: 600000, // 10 minutes max for full flow
      shell: 'cmd.exe',
      env: { ...process.env, ...parsed.envVars }
    });

    steps[1].status = 'completed';

    steps.push({
      id: 'step-3',
      description: 'Playwright test execution completed',
      status: 'completed',
      timestamp: new Date()
    });

    // Parse test output to extract PO number and Invoice number
    const poMatch = stdout.match(/PO Number[:\s]+(\d+)/i) ||
                    stdout.match(/Purchase Order Created[:\s]+(\d+)/i) ||
                    stdout.match(/(4500\d{6})/);

    const invoiceMatch = stdout.match(/Invoice.*Number[:\s]+(\d+)/i) ||
                         stdout.match(/Invoice Created[:\s]+(\d+)/i) ||
                         stdout.match(/(5105\d{6})/);

    const poNumber = poMatch ? poMatch[1] : null;
    const invoiceNumber = invoiceMatch ? invoiceMatch[1] : null;

    let resultMessage = 'Test completed successfully!';
    if (poNumber) resultMessage += ` PO: ${poNumber}`;
    if (invoiceNumber) resultMessage += ` Invoice: ${invoiceNumber}`;

    steps.push({
      id: 'step-4',
      description: `✓ ${resultMessage}`,
      status: 'completed',
      timestamp: new Date()
    });

    const duration = Date.now() - startTime;

    return {
      success: true,
      message: resultMessage,
      duration,
      steps,
      poNumber,
      invoiceNumber,
      output: stdout
    };

  } catch (error: any) {
    console.error('Test execution error:', error);

    const duration = Date.now() - startTime;
    const errorMessage = error.stderr || error.message || 'Test execution failed';

    steps.push({
      id: 'error',
      description: `✗ Test failed: ${errorMessage.substring(0, 500)}`,
      status: 'failed',
      timestamp: new Date()
    });

    return {
      success: false,
      message: 'Test execution failed',
      duration,
      steps,
      errors: [errorMessage]
    };
  }
}

// API endpoint to execute tests
app.post('/api/execute', async (req, res) => {
  try {
    const { command } = req.body;

    if (!command) {
      return res.status(400).json({ error: 'Command is required' });
    }

    console.log('Received command:', command);

    const result = await executeTest(command);

    res.json(result);

  } catch (error: any) {
    console.error('API error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      errors: [error.message]
    });
  }
});

// API endpoint to get available commands
app.get('/api/commands', (req, res) => {
  res.json({
    commands: [
      {
        name: 'Create Purchase Order',
        examples: [
          'Create a purchase order',
          'Create PO',
          'Generate a purchase order',
          'Start a purchase order',
          'Can you create a purchase order?',
          'Please create a purchase order',
          'Run purchase order creation'
        ],
        requiresInput: false
      },
      {
        name: 'Create Goods Receipt',
        examples: [
          'Create goods receipt for this PO',
          'Create goods for PO 4500001234',
          'Post goods receipt using PO number',
          'Create GR for purchase order 4500001234',
          'Can you create goods receipt for this PO?',
          'Run goods receipt flow'
        ],
        requiresInput: true,
        inputType: 'PO_NUMBER'
      },
      {
        name: 'Create Supplier Invoice',
        examples: [
          'Create invoice with this PO number',
          'Create supplier invoice for PO 4500001234',
          'Generate invoice using PO number 4500001234',
          'Create invoice for purchase order 4500001234',
          'Can you create an invoice for this PO?',
          'Run invoice creation for PO 4500001234'
        ],
        requiresInput: true,
        inputType: 'PO_NUMBER'
      },
      {
        name: 'Create Payment',
        examples: [
          'Create payment for this invoice',
          'Make payment for invoice 5100007890',
          'Process payment using invoice number',
          'Can you make payment for this invoice?',
          'Run payment process',
          'Execute automatic payment'
        ],
        requiresInput: true,
        inputType: 'INVOICE_NUMBER'
      },
      {
        name: 'Procedure to Pay (End-to-End)',
        examples: [
          'Create procedure to pay',
          'Run procedure to pay',
          'Execute procedure to pay flow',
          'Run P2P process',
          'Can you run the full procedure to pay?',
          'Execute end-to-end SAP flow',
          'Start purchase to payment process'
        ],
        requiresInput: false
      }
    ]
  });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Backend is running' });
});

// Check PO status - what flows have been completed for this PO
app.get('/api/po-status/:poNumber', (req, res) => {
  const { poNumber } = req.params;
  const projectRoot = path.resolve(__dirname, '../..');

  const poFilePath = path.join(projectRoot, 'utils/purchaseorderno.csv');
  const invoiceFilePath = path.join(projectRoot, 'utils/invoiceno.csv');

  let poCreated = false;
  let poCreatedAt = null;
  let invoiceCreated = false;
  let invoiceNumber = null;
  let invoiceCreatedAt = null;

  // Check PO CSV
  if (fs.existsSync(poFilePath)) {
    const poData = fs.readFileSync(poFilePath, 'utf-8');
    const lines = poData.split('\n');
    for (const line of lines) {
      if (line.startsWith(poNumber)) {
        poCreated = true;
        const parts = line.split(',');
        poCreatedAt = parts[1]?.trim();
        break;
      }
    }
  }

  // Check Invoice CSV
  if (fs.existsSync(invoiceFilePath)) {
    const invoiceData = fs.readFileSync(invoiceFilePath, 'utf-8');
    const lines = invoiceData.split('\n');
    for (const line of lines) {
      if (line.includes(poNumber)) {
        invoiceCreated = true;
        const parts = line.split(',');
        invoiceNumber = parts[0]?.trim();
        invoiceCreatedAt = parts[2]?.trim();
        break;
      }
    }
  }

  res.json({
    poNumber,
    exists: poCreated,
    status: {
      poCreated,
      poCreatedAt,
      goodsReceiptCompleted: invoiceCreated, // If invoice exists, GR was done
      invoiceCreated,
      invoiceNumber,
      invoiceCreatedAt,
    },
    nextStep: !poCreated
      ? 'PO not found - Create PO first'
      : !invoiceCreated
        ? 'Ready for Goods Receipt and Invoice'
        : 'Ready for Payment',
    message: poCreated
      ? `PO ${poNumber} found! Created at ${poCreatedAt}`
      : `PO ${poNumber} not found in records`
  });
});

// Get all PO numbers
app.get('/api/po-list', (req, res) => {
  const projectRoot = path.resolve(__dirname, '../..');
  const poFilePath = path.join(projectRoot, 'utils/purchaseorderno.csv');

  if (!fs.existsSync(poFilePath)) {
    return res.json({ poNumbers: [], message: 'No PO records found' });
  }

  const poData = fs.readFileSync(poFilePath, 'utf-8');
  const lines = poData.split('\n').filter(line => line.trim() && !line.startsWith('PO_Number'));

  const poNumbers = lines.map(line => {
    const parts = line.split(',');
    return {
      poNumber: parts[0]?.trim(),
      createdAt: parts[1]?.trim()
    };
  }).filter(po => po.poNumber);

  res.json({
    poNumbers,
    total: poNumbers.length,
    message: `Found ${poNumbers.length} PO records`
  });
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`🚀 Backend server running on http://localhost:${PORT}`);
  console.log(`📝 API endpoints:`);
  console.log(`   POST /api/execute - Execute test commands`);
  console.log(`   GET  /api/commands - Get available commands`);
  console.log(`   GET  /api/health - Health check`);
});
