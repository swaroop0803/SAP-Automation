import express from 'express';
import cors from 'cors';
import { exec, spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import Groq from 'groq-sdk';
import dotenv from 'dotenv';
import multer from 'multer';
import * as XLSX from 'xlsx';

// Load environment variables
dotenv.config();

// Track running test process for cancellation
let currentTestProcess: ChildProcess | null = null;
let isTestCancelled = false;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Groq AI client
const groq = process.env.GROQ_API_KEY
  ? new Groq({ apiKey: process.env.GROQ_API_KEY })
  : null;

const USE_AI_PARSING = process.env.USE_AI_PARSING === 'true' && groq !== null;

const app = express();
app.use(cors());
app.use(express.json());

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // xlsx
      'application/vnd.ms-excel', // xls
      'text/csv',
      'application/json'
    ];
    if (allowedTypes.includes(file.mimetype) ||
        file.originalname.endsWith('.csv') ||
        file.originalname.endsWith('.json') ||
        file.originalname.endsWith('.xlsx') ||
        file.originalname.endsWith('.xls')) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only Excel, CSV, and JSON files are allowed.'));
    }
  }
});

// Bulk upload tracking
interface BulkJobStatus {
  id: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  totalItems: number;
  completedItems: number;
  results: Array<{
    index: number;
    material: string;
    quantity: string;
    price: string;
    status: 'success' | 'failed' | 'pending' | 'cancelled';
    poNumber?: string;
    error?: string;
  }>;
  startTime: Date;
  endTime?: Date;
}

const bulkJobs: Map<string, BulkJobStatus> = new Map();
let currentBulkJobId: string | null = null;

// ═══════════════════════════════════════════════════════════════════════════
// AI-POWERED COMMAND PARSING WITH CLAUDE
// ═══════════════════════════════════════════════════════════════════════════

interface AIParseResult {
  action: 'purchase_order' | 'goods_receipt' | 'supplier_invoice' | 'payment' | 'procure_to_pay' | 'unknown';
  poNumber?: string;
  invoiceNumber?: string;
  confidence: number;
  reasoning: string;
}

async function parseCommandWithAI(command: string): Promise<AIParseResult> {
  if (!groq) {
    throw new Error('AI client not initialized');
  }

  const systemPrompt = `You are an SAP automation assistant that parses natural language commands into structured actions.

Available actions:
1. purchase_order - Create a new Purchase Order (no input required)
2. goods_receipt - Post Goods Receipt for a PO (requires PO number starting with 45, 10 digits)
3. supplier_invoice - Create Supplier Invoice for a PO (requires PO number starting with 45, 10 digits)
4. payment - Process Payment for an invoice (requires Invoice number starting with 51, 10 digits)
5. procure_to_pay - Run complete end-to-end flow (no input required)

Respond in JSON format only:
{
  "action": "action_name",
  "poNumber": "1234567890" or null,
  "invoiceNumber": "1234567890" or null,
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation"
}`;

  const response = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    max_tokens: 256,
    messages: [
      {
        role: 'system',
        content: systemPrompt
      },
      {
        role: 'user',
        content: `Parse this command: "${command}"`
      }
    ],
    temperature: 0.1
  });

  // Extract text content from response
  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('No text response from AI');
  }

  // Parse JSON response
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Could not parse AI response');
  }

  const result = JSON.parse(jsonMatch[0]) as AIParseResult;
  return result;
}

interface ParsedCommand {
  action: string;
  testFile: string;
  envVars: Record<string, string>;
  description: string;
  aiParsed?: boolean;
  aiConfidence?: number;
  aiReasoning?: string;
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

// AI-enhanced command parser (uses AI if available, falls back to pattern matching)
async function parseCommandWithAIFallback(command: string): Promise<ParsedCommand> {
  if (USE_AI_PARSING) {
    try {
      console.log('🤖 Using AI to parse command...');
      const aiResult = await parseCommandWithAI(command);
      console.log('🤖 AI Result:', aiResult);

      if (aiResult.confidence >= 0.7 && aiResult.action !== 'unknown') {
        // Map AI result to ParsedCommand
        const actionMap: Record<string, { testFile: string; description: string }> = {
          purchase_order: {
            testFile: 'tests/flows/PurchaseOrderFlow.spec.ts',
            description: 'Creating Purchase Order (AI-parsed)'
          },
          goods_receipt: {
            testFile: 'tests/flows/GoodsReceiptFlow.spec.ts',
            description: `Posting Goods Receipt for PO ${aiResult.poNumber} (AI-parsed)`
          },
          supplier_invoice: {
            testFile: 'tests/flows/SupplierInvoiceFlow.spec.ts',
            description: `Creating Supplier Invoice for PO ${aiResult.poNumber} (AI-parsed)`
          },
          payment: {
            testFile: 'tests/flows/PaymentFlow.spec.ts',
            description: `Processing Payment for Invoice ${aiResult.invoiceNumber} (AI-parsed)`
          },
          procure_to_pay: {
            testFile: 'tests/procureToPay.spec.ts',
            description: 'Running complete Procure-to-Pay flow (AI-parsed)'
          }
        };

        const mapped = actionMap[aiResult.action];
        if (mapped) {
          const envVars: Record<string, string> = {};
          if (aiResult.poNumber) envVars.PO_NUMBER = aiResult.poNumber;
          if (aiResult.invoiceNumber) envVars.INVOICE_NUMBER = aiResult.invoiceNumber;

          // Validate required inputs
          if ((aiResult.action === 'goods_receipt' || aiResult.action === 'supplier_invoice') && !aiResult.poNumber) {
            return {
              action: `${aiResult.action}_missing_po`,
              testFile: '',
              envVars: {},
              description: `ERROR: PO Number is required. Example: "Create goods for PO 4500001075"`,
              aiParsed: true,
              aiConfidence: aiResult.confidence,
              aiReasoning: aiResult.reasoning
            };
          }

          if (aiResult.action === 'payment' && !aiResult.invoiceNumber) {
            return {
              action: 'payment_missing_invoice',
              testFile: '',
              envVars: {},
              description: `ERROR: Invoice Number is required. Example: "Process payment for invoice 5105600001"`,
              aiParsed: true,
              aiConfidence: aiResult.confidence,
              aiReasoning: aiResult.reasoning
            };
          }

          return {
            action: aiResult.action,
            testFile: mapped.testFile,
            envVars,
            description: mapped.description,
            aiParsed: true,
            aiConfidence: aiResult.confidence,
            aiReasoning: aiResult.reasoning
          };
        }
      }
      console.log('🤖 AI confidence too low or unknown action, falling back to pattern matching');
    } catch (error) {
      console.error('🤖 AI parsing failed, falling back to pattern matching:', error);
    }
  }

  // Fallback to pattern matching
  return parseCommandPatternBased(command);
}

// Pattern-based command parser (fallback)
function parseCommandPatternBased(command: string): ParsedCommand {
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
    // "Supplier receipt" = Supplier Invoice (common confusion)
    'supplier receipt', 'supplier reciept', 'supplier recept',
    'create supplier receipt', 'create a supplier receipt',
    'supplier receipt for', 'supplier receipt using', 'supplier receipt with',
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
    // Check if user accidentally provided an invoice number instead of PO number
    if (poNumber.startsWith('5105') || poNumber.startsWith('5100')) {
      return {
        action: 'invoice_wrong_number',
        testFile: '',
        envVars: {},
        description: `ERROR: You provided an Invoice Number (${poNumber}). To create a supplier invoice, you need a PO Number (starts with 4500). Example: "Create invoice for PO 4500001075"`
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
    const parsed = await parseCommandWithAIFallback(command);

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
    const aiInfo = parsed.aiParsed
      ? ` (AI: ${Math.round((parsed.aiConfidence || 0) * 100)}% confidence)`
      : ' (Pattern matching)';

    steps.push({
      id: 'step-1',
      description: `Parsing command: "${command}"${aiInfo}`,
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

    // Reset cancellation flag
    isTestCancelled = false;

    // Use exec with callback to get process reference for cancellation
    const { stdout, stderr } = await new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
      currentTestProcess = exec(testCommand, {
        cwd: projectRoot,
        timeout: 600000, // 10 minutes max for full flow
        shell: 'cmd.exe',
        env: { ...process.env, ...parsed.envVars }
      }, (error, stdout, stderr) => {
        currentTestProcess = null;
        if (isTestCancelled) {
          reject(new Error('Test cancelled by user'));
        } else if (error) {
          reject({ ...error, stdout, stderr });
        } else {
          resolve({ stdout, stderr });
        }
      });
    });

    steps[1].status = 'completed';

    steps.push({
      id: 'step-3',
      description: 'Playwright test execution completed',
      status: 'completed',
      timestamp: new Date()
    });

    // Parse test output to extract PO number, Invoice number, and Material Document number
    const poMatch = stdout.match(/PO Number[:\s]+(\d+)/i) ||
                    stdout.match(/Purchase Order Created[:\s]+(\d+)/i) ||
                    stdout.match(/(4500\d{6})/);

    const invoiceMatch = stdout.match(/Invoice.*Number[:\s]+(\d+)/i) ||
                         stdout.match(/Invoice Created[:\s]+(\d+)/i) ||
                         stdout.match(/(5105\d{6})/);

    const materialDocMatch = stdout.match(/Material Document Number[:\s]+(\d+)/i) ||
                              stdout.match(/Material document (\d+) posted/i) ||
                              stdout.match(/(5000\d{6})/);

    const poNumber = poMatch ? poMatch[1] : null;
    const invoiceNumber = invoiceMatch ? invoiceMatch[1] : null;
    const materialDocNumber = materialDocMatch ? materialDocMatch[1] : null;

    let resultMessage = 'Test completed successfully!';
    if (poNumber) resultMessage += ` PO: ${poNumber}`;
    if (invoiceNumber) resultMessage += ` Invoice: ${invoiceNumber}`;
    if (materialDocNumber) resultMessage += ` Material Doc: ${materialDocNumber}`;

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
      materialDocNumber,
      output: stdout,
      ai: parsed.aiParsed ? {
        used: true,
        confidence: parsed.aiConfidence,
        reasoning: parsed.aiReasoning
      } : { used: false }
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

// API endpoint to cancel running test
app.post('/api/cancel', (req, res) => {
  console.log('Cancel request received');

  if (currentTestProcess) {
    try {
      isTestCancelled = true;

      // Kill the process tree on Windows
      if (process.platform === 'win32') {
        exec(`taskkill /pid ${currentTestProcess.pid} /T /F`, (error) => {
          if (error) {
            console.error('Error killing process:', error);
          }
        });
      } else {
        currentTestProcess.kill('SIGTERM');
      }

      console.log('Test process cancelled');
      res.json({ success: true, message: 'Test cancelled successfully' });
    } catch (error: any) {
      console.error('Error cancelling test:', error);
      res.status(500).json({ success: false, message: 'Failed to cancel test', error: error.message });
    }
  } else {
    res.json({ success: false, message: 'No test is currently running' });
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

// ═══════════════════════════════════════════════════════════════════════════
// BULK UPLOAD API - For creating multiple Purchase Orders
// ═══════════════════════════════════════════════════════════════════════════

// Parse uploaded file (Excel, CSV, or JSON)
// Fields: Document Date, Purchase Org, Purchase Group, Company Code, Account Assignment,
//         Material, PO Quantity, Unit, Net Price, Plant, GL Account, Cost Center
function parseBulkFile(buffer: Buffer, filename: string): Array<{
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
}> {
  const ext = filename.toLowerCase().split('.').pop();

  if (ext === 'json') {
    const jsonData = JSON.parse(buffer.toString());
    // Support both array format and {data: [...]} format
    const items = Array.isArray(jsonData) ? jsonData : jsonData.data || jsonData.items || [];
    return items.map((item: any) => ({
      documentDate: item.documentDate || item['Document date'] || item.document_date || '',
      purchaseOrg: item.purchaseOrg || item.PurchaseOrg || item['Purchase Org'] || 'ACS',
      purchaseGroup: item.purchaseGroup || item.PurchaseGroup || item['Purchase Group'] || 'ACS',
      companyCode: item.companyCode || item.CompanyCode || item['Company code'] || 'ACS',
      accountAssignment: item.accountAssignment || item.AccountAssignment || item['Account Assignment'] || 'K',
      material: String(item.material || item.Material || 'P-A2026-3'),
      quantity: String(item.quantity || item.Quantity || item['PO Quantity'] || '1'),
      unit: item.unit || item.Unit || item['unit of measure'] || 'EA',
      price: String(item.price || item.Price || item['Net price'] || '1000'),
      plant: item.plant || item.Plant || 'ACS',
      glAccount: item.glAccount || item.GLAccount || item['GL Account'] || '610010',
      costCenter: item.costCenter || item.CostCenter || item['Cost center'] || 'ACSC110'
    }));
  }

  if (ext === 'csv') {
    const csvData = buffer.toString();
    const lines = csvData.split('\n').filter(line => line.trim());
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/\s+/g, ''));

    return lines.slice(1).map(line => {
      const values = line.split(',').map(v => v.trim());
      const item: any = {};

      headers.forEach((header, index) => {
        item[header] = values[index] || '';
      });

      return {
        documentDate: item.documentdate || item.date || '',
        purchaseOrg: item.purchaseorg || item.purchorg || 'ACS',
        purchaseGroup: item.purchasegroup || item.purchgroup || 'ACS',
        companyCode: item.companycode || item.company || 'ACS',
        accountAssignment: item.accountassignment || item.acctassign || 'K',
        material: item.material || item.mat || 'P-A2026-3',
        quantity: item.quantity || item.poquantity || item.qty || '1',
        unit: item.unit || item.unitofmeasure || item.uom || 'EA',
        price: item.price || item.netprice || '1000',
        plant: item.plant || 'ACS',
        glAccount: item.glaccount || item.gl || '610010',
        costCenter: item.costcenter || item.cc || 'ACSC110'
      };
    });
  }

  if (ext === 'xlsx' || ext === 'xls') {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(sheet);

    return jsonData.map((item: any) => ({
      documentDate: String(item['Document date'] || item.DocumentDate || item.documentDate || ''),
      purchaseOrg: String(item['Purchase Org'] || item.PurchaseOrg || item.purchaseOrg || 'ACS'),
      purchaseGroup: String(item['Purchase Group'] || item.PurchaseGroup || item.purchaseGroup || 'ACS'),
      companyCode: String(item['Company code'] || item.CompanyCode || item.companyCode || 'ACS'),
      accountAssignment: String(item['Account Assignment'] || item.AccountAssignment || item.accountAssignment || 'K'),
      material: String(item.Material || item.material || 'P-A2026-3'),
      quantity: String(item['PO Quantity'] || item.Quantity || item.quantity || '1'),
      unit: String(item['unit of measure'] || item.Unit || item.unit || 'EA'),
      price: String(item['Net price'] || item.Price || item.price || '1000'),
      plant: String(item.Plant || item.plant || 'ACS'),
      glAccount: String(item['GL Account'] || item.GLAccount || item.glAccount || '610010'),
      costCenter: String(item['Cost center'] || item.CostCenter || item.costCenter || 'ACSC110')
    }));
  }

  throw new Error(`Unsupported file format: ${ext}`);
}

// Bulk upload endpoint - Saves CSV file and runs single test that reads it
app.post('/api/bulk-upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    console.log('Bulk upload received:', req.file.originalname);

    // Parse the file to validate and get item count
    const items = parseBulkFile(req.file.buffer, req.file.originalname);

    if (items.length === 0) {
      return res.status(400).json({ error: 'No valid items found in file' });
    }

    console.log(`Parsed ${items.length} items from file`);

    // Save uploaded file to uploads directory
    const projectRoot = path.resolve(__dirname, '../..');
    const uploadsDir = path.join(projectRoot, 'uploads');

    // Create uploads directory if it doesn't exist
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    // Cleanup: Delete ALL old CSV files in uploads directory before saving new one
    try {
      const existingFiles = fs.readdirSync(uploadsDir);
      for (const file of existingFiles) {
        if (file.startsWith('bulk_po_') && (file.endsWith('.csv') || file.endsWith('.xlsx') || file.endsWith('.xls') || file.endsWith('.json'))) {
          const filePath = path.join(uploadsDir, file);
          fs.unlinkSync(filePath);
          console.log(`Cleanup: Deleted old file: ${filePath}`);
        }
      }
    } catch (cleanupError) {
      console.error('Cleanup: Error deleting old files:', cleanupError);
    }

    // Save file with timestamp
    const timestamp = Date.now();
    const ext = req.file.originalname.split('.').pop();
    const savedFileName = `bulk_po_${timestamp}.${ext}`;
    const savedFilePath = path.join(uploadsDir, savedFileName);

    fs.writeFileSync(savedFilePath, req.file.buffer);
    console.log(`File saved to: ${savedFilePath}`);

    // Create job
    const jobId = `bulk-${timestamp}`;
    const job: BulkJobStatus = {
      id: jobId,
      status: 'running',
      totalItems: items.length,
      completedItems: 0,
      results: items.map((item, index) => ({
        index,
        material: item.material,
        quantity: item.quantity,
        price: item.price,
        status: 'pending' as const
      })),
      startTime: new Date()
    };

    bulkJobs.set(jobId, job);
    currentBulkJobId = jobId;
    isTestCancelled = false;

    // Return job ID immediately
    res.json({
      success: true,
      jobId,
      message: `Bulk upload started with ${items.length} items`,
      totalItems: items.length
    });

    // Execute single test that reads CSV and creates all POs
    // Using spawn for real-time output streaming
    (async () => {
      console.log('Running bulk PO test with CSV:', savedFilePath);

      // Use spawn for real-time output
      const testProcess = spawn('npx', ['playwright', 'test', 'tests/flows/BulkPOFlow.spec.ts'], {
        cwd: projectRoot,
        shell: true,
        env: {
          ...process.env,
          BULK_CSV_PATH: savedFilePath,
          BULK_JOB_ID: jobId
        }
      });

      currentTestProcess = testProcess;
      let currentProcessingRow = 0;

      // Real-time stdout parsing
      testProcess.stdout?.on('data', (data: Buffer) => {
        const output = data.toString();
        console.log('STDOUT:', output);

        // Check for "Processing row X/Y" to mark item as in-progress
        const processingMatch = output.match(/Processing row (\d+)\/(\d+)/);
        if (processingMatch) {
          const rowNum = parseInt(processingMatch[1]);
          currentProcessingRow = rowNum;
          // Mark previous pending items as in-progress indicator (optional)
          console.log(`Now processing row ${rowNum}`);
        }

        // Parse PO creation success - update immediately
        const poMatches = output.matchAll(/PO Created: (\d+) for row (\d+)/g);
        for (const match of poMatches) {
          const poNumber = match[1];
          const rowIndex = parseInt(match[2]) - 1;
          if (job.results[rowIndex] && job.results[rowIndex].status === 'pending') {
            job.results[rowIndex].status = 'success';
            job.results[rowIndex].poNumber = poNumber;
            job.completedItems++;
            console.log(`✓ Real-time update: Row ${rowIndex + 1} -> PO ${poNumber}`);
          }
        }

        // Parse skipped entries - update immediately
        const skipMatches = output.matchAll(/SKIPPED: Row (\d+) has document date with year 2025/g);
        for (const match of skipMatches) {
          const rowIndex = parseInt(match[1]) - 1;
          if (job.results[rowIndex] && job.results[rowIndex].status === 'pending') {
            job.results[rowIndex].status = 'failed';
            job.results[rowIndex].error = 'Skipped - Date year is 2025';
            job.completedItems++;
            console.log(`✗ Real-time update: Row ${rowIndex + 1} -> Skipped (2025 date)`);
          }
        }

        // Parse failed entries
        const failMatch = output.match(/Failed to create PO for row (\d+): (.+)/);
        if (failMatch) {
          const rowIndex = parseInt(failMatch[1]) - 1;
          const errorMsg = failMatch[2];
          if (job.results[rowIndex] && job.results[rowIndex].status === 'pending') {
            job.results[rowIndex].status = 'failed';
            job.results[rowIndex].error = errorMsg;
            job.completedItems++;
            console.log(`✗ Real-time update: Row ${rowIndex + 1} -> Failed: ${errorMsg}`);
          }
        }
      });

      testProcess.stderr?.on('data', (data: Buffer) => {
        console.log('STDERR:', data.toString());
      });

      testProcess.on('close', (code) => {
        currentTestProcess = null;

        if (isTestCancelled) {
          job.status = 'cancelled';
          job.results.forEach(r => {
            if (r.status === 'pending') r.status = 'cancelled';
          });
        } else {
          // Mark any remaining pending items as failed
          job.results.forEach(r => {
            if (r.status === 'pending') {
              r.status = 'failed';
              r.error = 'Did not complete';
              job.completedItems++;
            }
          });
          job.status = 'completed';
        }

        job.endTime = new Date();
        currentBulkJobId = null;
        console.log(`Bulk job ${jobId} completed. Success: ${job.results.filter(r => r.status === 'success').length}/${job.totalItems}`);

        // Cleanup: Delete the uploaded CSV file after processing
        try {
          if (fs.existsSync(savedFilePath)) {
            fs.unlinkSync(savedFilePath);
            console.log(`Backend cleanup: Deleted uploaded CSV file: ${savedFilePath}`);
          }
        } catch (cleanupError) {
          console.error('Backend cleanup: Failed to delete CSV file:', cleanupError);
        }
      });

      testProcess.on('error', (err) => {
        console.error('Process error:', err);
        job.status = 'failed';
        currentTestProcess = null;
        currentBulkJobId = null;
      });
    })();

  } catch (error: any) {
    console.error('Bulk upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get bulk job status
app.get('/api/bulk-status/:jobId', (req, res) => {
  const job = bulkJobs.get(req.params.jobId);

  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }

  const successCount = job.results.filter(r => r.status === 'success').length;
  const failedCount = job.results.filter(r => r.status === 'failed').length;

  res.json({
    ...job,
    successCount,
    failedCount,
    progress: Math.round((job.completedItems / job.totalItems) * 100)
  });
});

// Cancel bulk job
app.post('/api/bulk-cancel', (req, res) => {
  if (currentBulkJobId) {
    isTestCancelled = true;

    // Kill current test process if running
    if (currentTestProcess) {
      if (process.platform === 'win32') {
        exec(`taskkill /pid ${currentTestProcess.pid} /T /F`);
      } else {
        currentTestProcess.kill('SIGTERM');
      }
    }

    res.json({ success: true, message: 'Bulk job cancellation requested' });
  } else {
    res.json({ success: false, message: 'No bulk job is currently running' });
  }
});

// Get all bulk jobs
app.get('/api/bulk-jobs', (req, res) => {
  const jobs = Array.from(bulkJobs.values()).map(job => ({
    id: job.id,
    status: job.status,
    totalItems: job.totalItems,
    completedItems: job.completedItems,
    successCount: job.results.filter(r => r.status === 'success').length,
    failedCount: job.results.filter(r => r.status === 'failed').length,
    startTime: job.startTime,
    endTime: job.endTime
  }));

  res.json({ jobs });
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`🚀 Backend server running on http://localhost:${PORT}`);
  console.log(`📝 API endpoints:`);
  console.log(`   POST /api/execute - Execute test commands`);
  console.log(`   POST /api/cancel  - Cancel running test`);
  console.log(`   POST /api/bulk-upload - Upload bulk PO file`);
  console.log(`   GET  /api/bulk-status/:jobId - Get bulk job status`);
  console.log(`   POST /api/bulk-cancel - Cancel bulk job`);
  console.log(`   GET  /api/bulk-jobs - List all bulk jobs`);
  console.log(`   GET  /api/commands - Get available commands`);
  console.log(`   GET  /api/health - Health check`);
});
