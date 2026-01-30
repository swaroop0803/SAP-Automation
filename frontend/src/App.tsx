import { useState, useRef, useEffect, Fragment } from 'react';
import './App.css';

// Bulk job status interface
interface BulkJobResult {
  index: number;
  material: string;
  quantity: string;
  price: string;
  status: 'success' | 'failed' | 'pending' | 'cancelled';
  poNumber?: string;
  error?: string;
  completedAt?: string; // ISO timestamp when this item completed
}

interface BulkJobStatus {
  id: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  totalItems: number;
  completedItems: number;
  results: BulkJobResult[];
  successCount: number;
  failedCount: number;
  progress: number;
  durationMs?: number; // Total execution time in milliseconds
}

// History entry types
interface SingleHistoryEntry {
  type: 'single';
  command: string;
  status: string;
  date: string;
  time: string;
  poNumber: string;
  invoiceNumber: string;
  materialDocNumber: string;
  documentNumber: string;
  documentType: string;
  createdBy: string;
  error?: string;
}

interface BulkHistoryEntry {
  type: 'bulk';
  jobId: string;
  date: string;
  time: string;
  totalItems: number;
  successCount: number;
  failedCount: number;
  results: BulkJobResult[];
  createdBy: string;
  durationMs?: number; // Total execution time in milliseconds
}

type HistoryEntry = SingleHistoryEntry | BulkHistoryEntry;

// ═══════════════════════════════════════════════════════════════════════════
// DOCUMENT TYPE IDENTIFICATION - For pre-validation of document numbers
// ═══════════════════════════════════════════════════════════════════════════

interface DocumentTypeResult {
  type: string;           // e.g., "purchaseOrder", "materialDocument", "supplierInvoice"
  label: string;          // e.g., "Purchase Order", "Material Document"
  shortLabel: string;     // e.g., "PO", "Mat Doc", "Invoice"
  isValid: boolean;       // true if matched, false if unknown
}

// Document prefixes configuration (should match config/documentPrefixes.json)
const DOCUMENT_PREFIXES = {
  purchaseOrder: { codes: ['45'], label: 'Purchase Order', shortLabel: 'PO' },
  materialDocument: { codes: ['50'], label: 'Material Document', shortLabel: 'Mat Doc' },
  supplierInvoice: { codes: ['51'], label: 'Supplier Invoice', shortLabel: 'Invoice' }
};

/**
 * Identify document type by analyzing the ID prefix
 */
function identifyDocumentType(documentId: string): DocumentTypeResult {
  if (!documentId || documentId.trim() === '') {
    return { type: 'unknown', label: 'Unknown', shortLabel: 'Unknown', isValid: false };
  }

  const id = documentId.trim();

  for (const [type, config] of Object.entries(DOCUMENT_PREFIXES)) {
    for (const code of config.codes) {
      if (id.startsWith(code)) {
        return { type, label: config.label, shortLabel: config.shortLabel, isValid: true };
      }
    }
  }

  return { type: 'unknown', label: 'Unknown Document Type', shortLabel: 'Unknown', isValid: false };
}

/**
 * Extract document number from command
 */
function extractDocumentNumber(command: string): string | null {
  const match = command.match(/\b(\d{10})\b/);
  return match ? match[1] : null;
}

/**
 * Detect what operation the command is requesting
 */
function detectOperation(command: string): 'goods_receipt' | 'supplier_invoice' | 'payment' | 'purchase_order' | 'p2p' | 'unknown' {
  const lower = command.toLowerCase();

  // Check for P2P first (most specific)
  if (lower.includes('p2p') || lower.includes('p-p') || lower.includes('procure to pay') ||
      lower.includes('procedure to pay') || lower.includes('full flow') || lower.includes('end to end')) {
    return 'p2p';
  }

  // Supplier invoice
  if (lower.includes('invoice') || lower.includes('supplier receipt')) {
    return 'supplier_invoice';
  }

  // Goods receipt
  if (lower.includes('goods') || lower.includes('receipt') || lower.match(/\bgr\b/) || lower.includes('migo')) {
    return 'goods_receipt';
  }

  // Payment
  if (lower.includes('payment') || lower.includes('pay for') || lower.includes('f110')) {
    return 'payment';
  }

  // Purchase order
  if (lower.includes('purchase order') || lower.includes('po') || lower.includes('create po')) {
    return 'purchase_order';
  }

  return 'unknown';
}

/**
 * Validate document type for frontend - returns error message if invalid, null if valid
 */
function validateDocumentTypeForCommand(command: string): string | null {
  const operation = detectOperation(command);
  const documentNumber = extractDocumentNumber(command);

  // Operations that don't need a document number
  if (operation === 'purchase_order' || operation === 'p2p' || operation === 'unknown') {
    return null;
  }

  // If no document number found, let backend handle it
  if (!documentNumber) {
    return null;
  }

  const docType = identifyDocumentType(documentNumber);

  // Define required document types for each operation
  const requirements: Record<string, { requiredType: string; requiredLabel: string; example: string }> = {
    goods_receipt: { requiredType: 'purchaseOrder', requiredLabel: 'Purchase Order', example: '4500001075' },
    supplier_invoice: { requiredType: 'purchaseOrder', requiredLabel: 'Purchase Order', example: '4500001075' },
    payment: { requiredType: 'supplierInvoice', requiredLabel: 'Supplier Invoice', example: '5105600001' }
  };

  const req = requirements[operation];
  if (!req) return null;

  // Check if document type matches requirement
  if (docType.type !== req.requiredType) {
    const operationLabels: Record<string, string> = {
      goods_receipt: 'Goods Receipt',
      supplier_invoice: 'Supplier Invoice',
      payment: 'Payment'
    };

    const opLabel = operationLabels[operation] || operation;

    if (docType.isValid) {
      // User provided a valid document, but wrong type
      return `✗ This is a ${docType.label}, not a ${req.requiredLabel}. Please check the document number and try again.`;
    } else {
      // Unknown document type
      return `✗ "${documentNumber}" is not a valid document number. ${opLabel} requires a ${req.requiredLabel}. Please check and try again.`;
    }
  }

  return null; // Valid!
}

// ═══════════════════════════════════════════════════════════════════════════
// DATE/TIME HELPERS - Indian Standard Time (IST)
// ═══════════════════════════════════════════════════════════════════════════
const INDIA_TIMEZONE = 'Asia/Kolkata';

function getIndiaDate(date?: Date): string {
  return (date || new Date()).toLocaleDateString('en-IN', { timeZone: INDIA_TIMEZONE });
}

function getIndiaTime(date?: Date): string {
  return (date || new Date()).toLocaleTimeString('en-IN', { timeZone: INDIA_TIMEZONE });
}

// Transform technical errors to customer-friendly format
function transformErrorToRCA(error: string | undefined, isSuccess?: boolean): string {
  if (!error) return isSuccess ? 'Created!' : 'No Errors';

  const errorLower = error.toLowerCase();

  // ═══════════════════════════════════════════════════════════════════════════
  // CHECK FOR ALREADY-FRIENDLY MESSAGES FROM BACKEND
  // These messages are already formatted nicely and should be returned as-is
  // ═══════════════════════════════════════════════════════════════════════════

  // Backend friendly error patterns - return as-is
  if (error.startsWith('The "') || // e.g., The "Saved" button is not visible
      error.startsWith("The '") || // e.g., The 'Saved' button is not visible (single quotes)
      error.startsWith('Could not ') || // e.g., Could not click the "Post" button
      error.startsWith('A ') || // e.g., A checkbox is not visible
      error.startsWith('An ') || // e.g., An element was not found
      error.startsWith('Failed to ') || // e.g., Failed to navigate
      error.startsWith('Login failed') ||
      error.startsWith('Network error') ||
      error.startsWith('Verification failed') ||
      error.includes('is not visible') ||
      error.includes('is not editable') ||
      error.includes('is not clickable') ||
      error.includes('was not found') ||
      error.includes('not a Purchase Order') ||
      error.includes('not a Supplier Invoice') ||
      error.includes('is not a valid document') ||
      error.includes('Please try again') || // Backend messages end with this
      error.includes('textbox') || // Backend mentions specific element types
      error.includes('checkbox') ||
      error.includes('button')) {
    return error;
  }

  // Pre-validation errors - already user-friendly, return as-is
  if (errorLower.includes('invalid document type') || errorLower.includes('unrecognized document') ||
      errorLower.includes('validation error')) {
    return error;
  }

  // Goods Receipt already exists for this PO
  if (errorLower.includes('goods_receipt_already_exists') || errorLower.includes('does not contain any selectable items')) {
    return 'This Purchase Order has already been used to create a Goods Receipt. Cannot create another Goods Receipt for the same PO.';
  }

  // Supplier Invoice already exists for this PO
  if (errorLower.includes('supplier_invoice_already_exists') || errorLower.includes('balance is zero')) {
    return 'The Supplier Invoice has already been created for this PO. Please retry with a different Purchase Order.';
  }

  // Item OK checkbox timeout (Goods Receipt specific)
  if (errorLower.includes('item_ok_checkbox_timeout') || errorLower.includes('item ok') && errorLower.includes('checkbox')) {
    return 'Could not find the "Item OK" checkbox. The page took too long to respond. Please try again.';
  }

  // Timeout errors (fallback for technical errors that slip through)
  if (errorLower.includes('timeout') || errorLower.includes('exceeded')) {
    if (errorLower.includes('supplier')) {
      return 'The Supplier field was not responsive because the SAP screen took longer than expected to load.';
    }
    if (errorLower.includes('baselinedt') || errorLower.includes('baseline')) {
      return 'Supplier Invoice creation failed because the invoice screen did not load successfully.';
    }
    if (errorLower.includes('supplierinvoice') || errorLower.includes('invoice')) {
      return 'Supplier Invoice creation failed because the invoice screen did not load successfully.';
    }
    if (errorLower.includes('purchaseorder') || errorLower.includes('purchase order')) {
      return 'Purchase Order creation failed because the SAP screen took longer than expected to load.';
    }
    if (errorLower.includes('goodsreceipt') || errorLower.includes('goods receipt') || errorLower.includes('materialdocument')) {
      return 'Goods Receipt creation failed because the Post button was not clickable due to the document not being fully loaded.';
    }
    if (errorLower.includes('payment')) {
      return 'Payment creation failed because the required reference document was not available.';
    }
    if (errorLower.includes('save') || errorLower.includes('post')) {
      return 'The operation failed because the Save/Post button was not clickable at the time of execution.';
    }
    if (errorLower.includes('button')) {
      return 'The button was not visible because the expected screen was not loaded.';
    }
    if (errorLower.includes('textbox') || errorLower.includes('input') || errorLower.includes('field')) {
      return 'The input field was not responsive because the screen was still loading and the element was not ready for interaction.';
    }
    return 'The test failed due to a timeout as the SAP screen took longer than expected to load.';
  }

  // Locator/element not found errors (fallback for technical errors)
  if (errorLower.includes('locator') || errorLower.includes('not found')) {
    if (errorLower.includes('button')) {
      return 'The button was not visible because the application was in a different UI state than expected.';
    }
    if (errorLower.includes('field') || errorLower.includes('textbox') || errorLower.includes('input')) {
      return 'The input field was not available because the expected screen was not loaded.';
    }
    return 'The expected UI element was not found because the application was in a different state than expected.';
  }

  // Click/interaction errors (fallback for technical errors)
  if (errorLower.includes('click')) {
    if (errorLower.includes('disabled')) {
      return 'The button was not clickable because it was disabled at the time of execution.';
    }
    if (errorLower.includes('overlapped') || errorLower.includes('intercept')) {
      return 'The button was not clickable because it was overlapped by another UI element.';
    }
    return 'The button was not clickable because the required mandatory fields were not filled.';
  }

  // Navigation/page errors - be specific to avoid catching Playwright technical errors
  if (errorLower.includes('target closed') ||
      errorLower.includes('page closed') ||
      errorLower.includes('browser closed') ||
      errorLower.includes('context closed') ||
      errorLower.includes('session closed') ||
      (errorLower.includes('navigation') && !errorLower.includes('timeout'))) {
    return 'The operation failed because the browser session was interrupted or the page was closed unexpectedly.';
  }

  // Network errors
  if (errorLower.includes('network') || errorLower.includes('connection') || errorLower.includes('fetch')) {
    return 'The operation failed due to a network connectivity issue with the SAP server.';
  }

  // PO number not generated
  if (errorLower.includes('po number') || errorLower.includes('not generated')) {
    return 'Purchase Order creation failed because the system did not return a PO number after save.';
  }

  // Cancelled by user
  if (errorLower.includes('cancelled') || errorLower.includes('canceled') || errorLower.includes('abort')) {
    return 'The operation was cancelled by the user.';
  }

  // Generic SAP-related errors
  if (errorLower.includes('sap')) {
    return 'The SAP operation failed due to an unexpected application state.';
  }

  // If no pattern matches, return a generic but friendly message
  return `The operation failed due to an unexpected error. Technical details: ${error.substring(0, 100)}${error.length > 100 ? '...' : ''}`;
}

function App() {
  // Login state
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loggedInUser, setLoggedInUser] = useState('');
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  const [view, setView] = useState('dashboard');
  const [command, setCommand] = useState('');
  const [executing, setExecuting] = useState(false);
  const [results, setResults] = useState<HistoryEntry[]>([]);
  const [currentSteps, setCurrentSteps] = useState<string[]>([]);
  const [canCancel, setCanCancel] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const cancelTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Bulk upload state
  const [bulkJobId, setBulkJobId] = useState<string | null>(null);
  const [bulkJobStatus, setBulkJobStatus] = useState<BulkJobStatus | null>(null);
  const [bulkUploading, setBulkUploading] = useState(false);
  const bulkPollRef = useRef<NodeJS.Timeout | null>(null);

  // Login handler
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (loginUsername === 'Voltus' && loginPassword === 'Apple#123') {
      setIsLoggedIn(true);
      setLoggedInUser(loginUsername);
      setLoginError('');
    } else {
      setLoginError('Invalid username or password');
    }
  };

  // Logout handler
  const handleLogout = () => {
    setIsLoggedIn(false);
    setLoggedInUser('');
    setLoginUsername('');
    setLoginPassword('');
  };

  const executeCommand = async () => {
    if (!command) return;

    // ═══════════════════════════════════════════════════════════════════════════
    // FRONTEND PRE-VALIDATION: Check document type BEFORE calling backend
    // ═══════════════════════════════════════════════════════════════════════════
    const validationError = validateDocumentTypeForCommand(command);
    if (validationError) {
      // Show validation error immediately without calling backend
      setCurrentSteps([validationError]);
      setResults(prev => [...prev, {
        type: 'single' as const,
        command,
        status: 'Failed',
        date: getIndiaDate(),
        time: getIndiaTime(),
        poNumber: 'N/A',
        invoiceNumber: 'N/A',
        materialDocNumber: 'N/A',
        documentNumber: 'N/A',
        documentType: 'N/A',
        createdBy: loggedInUser,
        error: validationError
      }]);
      return;
    }

    // Create new AbortController for this execution
    abortControllerRef.current = new AbortController();

    setExecuting(true);
    setCurrentSteps([]);
    setCanCancel(true);

    // Cancel button is only clickable for 5 seconds
    cancelTimerRef.current = setTimeout(() => {
      setCanCancel(false);
    }, 5000);

    try {
      // Call the backend API
      const response = await fetch('http://localhost:3001/api/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ command }),
        signal: abortControllerRef.current.signal,
      });

      const result = await response.json();

      // Display steps as they come
      if (result.steps) {
        for (const step of result.steps) {
          setCurrentSteps(prev => [...prev, step.description]);
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      // Add to results - show appropriate document number based on command type
      const commandLower = command.toLowerCase();
      const isPaymentCommand = commandLower.includes('payment') || commandLower.includes('pay for') || commandLower.includes('f110');
      // "create a supplier" or "supplier invoice" or just commands with "supplier" (but not payment-related)
      const isInvoiceCommand = commandLower.includes('invoice') ||
                                commandLower.includes('supplier receipt') ||
                                (commandLower.includes('supplier') && !isPaymentCommand);
      const isGoodsReceiptCommand = commandLower.includes('goods') ||
                                     (commandLower.includes('receipt') && !isInvoiceCommand) ||
                                     (commandLower.match(/\bgr\b/) !== null) ||
                                     commandLower.includes('migo');
      const isPurchaseOrderCommand = commandLower.includes('purchase order') ||
                                      commandLower.includes('create po') ||
                                      (commandLower.match(/\bpo\b/) !== null);

      // Determine document type and number to display based on operation
      // Only show document numbers for successful operations
      let documentType = 'N/A';
      let documentNumber = 'N/A';

      if (result.success) {
        if (isPaymentCommand) {
          // Payment doesn't generate a document number to display
          documentType = 'N/A';
          documentNumber = 'N/A';
        } else if (isGoodsReceiptCommand && result.materialDocNumber) {
          documentType = 'Mat Doc';
          documentNumber = result.materialDocNumber;
        } else if (isInvoiceCommand && result.invoiceNumber) {
          documentType = 'Invoice';
          documentNumber = result.invoiceNumber;
        } else if (isPurchaseOrderCommand && result.poNumber) {
          documentType = 'PO';
          documentNumber = result.poNumber;
        } else if (result.poNumber) {
          // Fallback for P2P or other commands that create a PO
          documentType = 'PO';
          documentNumber = result.poNumber;
        }
      }
      // For failed tests, documentType and documentNumber stay as 'N/A'

      setResults(prev => [...prev, {
        type: 'single' as const,
        command,
        status: result.success ? 'Success' : 'Failed',
        date: getIndiaDate(),
        time: getIndiaTime(),
        poNumber: result.poNumber || 'N/A',
        invoiceNumber: result.invoiceNumber || 'N/A',
        materialDocNumber: result.materialDocNumber || 'N/A',
        documentNumber,
        documentType,
        createdBy: loggedInUser,
        error: result.success ? undefined : (result.message || (result.errors ? result.errors[0] : undefined))
      }]);

    } catch (error) {
      // Check if it was cancelled
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('Execution cancelled by user');
        setCurrentSteps(prev => [...prev, '⛔ Execution cancelled by user']);
        setResults(prev => [...prev, {
          type: 'single' as const,
          command,
          status: 'Cancelled',
          date: getIndiaDate(),
          time: getIndiaTime(),
          poNumber: 'N/A',
          invoiceNumber: 'N/A',
          materialDocNumber: 'N/A',
          documentNumber: 'N/A',
          documentType: 'N/A',
          createdBy: loggedInUser,
          error: 'Cancelled by user'
        }]);
      } else {
        console.error('Execution error:', error);
        setCurrentSteps(prev => [...prev, `✗ Error: ${error instanceof Error ? error.message : 'Connection failed'}`]);

        setResults(prev => [...prev, {
          type: 'single' as const,
          command,
          status: 'Failed',
          date: getIndiaDate(),
          time: getIndiaTime(),
          poNumber: 'N/A',
          invoiceNumber: 'N/A',
          materialDocNumber: 'N/A',
          documentNumber: 'N/A',
          documentType: 'N/A',
          createdBy: loggedInUser,
          error: 'Backend connection failed'
        }]);
      }
    }

    // Cleanup
    if (cancelTimerRef.current) {
      clearTimeout(cancelTimerRef.current);
    }
    setCanCancel(false);
    setExecuting(false);
    setCommand('');
  };

  const cancelExecution = async () => {
    // Abort the frontend fetch request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    if (cancelTimerRef.current) {
      clearTimeout(cancelTimerRef.current);
    }
    setCanCancel(false);

    // Also tell backend to cancel the running test
    try {
      await fetch('http://localhost:3001/api/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      console.log('Backend cancel request sent');
    } catch (error) {
      console.error('Failed to send cancel request to backend:', error);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (cancelTimerRef.current) {
        clearTimeout(cancelTimerRef.current);
      }
    };
  }, []);

  // Poll bulk job status
  const pollBulkJobStatus = async (jobId: string) => {
    try {
      const response = await fetch(`http://localhost:3001/api/bulk-status/${jobId}`);
      const status = await response.json();
      setBulkJobStatus(status);

      // Continue polling if job is still running - poll every 1 second for real-time updates
      if (status.status === 'running') {
        bulkPollRef.current = setTimeout(() => pollBulkJobStatus(jobId), 1000);
      } else {
        setBulkUploading(false);
        // Add bulk job to history when completed
        setResults(prev => {
          // Check if this job is already in history
          const exists = prev.some(r => r.type === 'bulk' && r.jobId === jobId);
          if (exists) return prev;

          return [...prev, {
            type: 'bulk' as const,
            jobId: jobId,
            date: getIndiaDate(),
            time: getIndiaTime(),
            totalItems: status.totalItems,
            successCount: status.successCount,
            failedCount: status.failedCount,
            results: status.results,
            createdBy: loggedInUser,
            durationMs: status.durationMs
          }];
        });
      }
    } catch (error) {
      console.error('Error polling bulk job status:', error);
      setBulkUploading(false);
    }
  };

  // Handle file upload for bulk PO creation
  const handleFileUpload = async (e: any) => {
    const file = e.target.files[0];
    if (!file) return;

    setBulkUploading(true);
    setBulkJobStatus(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('http://localhost:3001/api/bulk-upload', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (result.success && result.jobId) {
        setBulkJobId(result.jobId);
        // Start polling for status
        pollBulkJobStatus(result.jobId);
      } else {
        alert(`Upload failed: ${result.error || 'Unknown error'}`);
        setBulkUploading(false);
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert('Failed to upload file. Make sure the backend is running.');
      setBulkUploading(false);
    }

    // Reset file input
    e.target.value = '';
  };

  // Cancel bulk job
  const cancelBulkJob = async () => {
    try {
      await fetch('http://localhost:3001/api/bulk-cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      console.error('Error cancelling bulk job:', error);
    }
  };

  // Cleanup bulk polling on unmount
  useEffect(() => {
    return () => {
      if (bulkPollRef.current) {
        clearTimeout(bulkPollRef.current);
      }
    };
  }, []);

  // Show login page if not logged in
  if (!isLoggedIn) {
    return (
      <div className="login-container">
        <div className="login-box">
          <h1>SAP Automation</h1>
          <h2>Login</h2>
          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label htmlFor="username">Username</label>
              <input
                type="text"
                id="username"
                value={loginUsername}
                onChange={(e) => setLoginUsername(e.target.value)}
                placeholder="Enter username"
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input
                type="password"
                id="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="Enter password"
                required
              />
            </div>
            {loginError && <div className="login-error">{loginError}</div>}
            <button type="submit" className="login-btn">Login</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <div className="sidebar">
        <h2>SAP Automation</h2>
        <div className="user-info">
          <span>👤 {loggedInUser}</span>
          <button onClick={handleLogout} className="logout-btn">Logout</button>
        </div>
        <button onClick={() => setView('dashboard')} className={view === 'dashboard' ? 'active' : ''}>
          📊 Dashboard
        </button>
        <button onClick={() => setView('execute')} className={view === 'execute' ? 'active' : ''}>
          ▶️ Execute Test
        </button>
        <button onClick={() => setView('bulk')} className={view === 'bulk' ? 'active' : ''}>
          📁 Bulk Upload
        </button>
        <button onClick={() => setView('history')} className={view === 'history' ? 'active' : ''}>
          📜 History
        </button>
      </div>

      <div className="main">
        {view === 'dashboard' && (
          <div>
            <h1>Dashboard</h1>
            <div className="stats">
              <div className="stat-card">
                <h3>{results.reduce((acc, r) => acc + (r.type === 'bulk' ? r.totalItems : 1), 0)}</h3>
                <p>Total Tests</p>
              </div>
              <div className="stat-card green">
                <h3>{results.reduce((acc, r) => {
                  if (r.type === 'bulk') return acc + r.successCount;
                  return acc + (r.status === 'Success' ? 1 : 0);
                }, 0)}</h3>
                <p>Successful</p>
              </div>
              <div className="stat-card red">
                <h3>{results.reduce((acc, r) => {
                  if (r.type === 'bulk') return acc + r.failedCount;
                  return acc + (r.status === 'Failed' ? 1 : 0);
                }, 0)}</h3>
                <p>Failed</p>
              </div>
              <div className="stat-card blue">
                <h3>{(() => {
                  const total = results.reduce((acc, r) => acc + (r.type === 'bulk' ? r.totalItems : 1), 0);
                  const success = results.reduce((acc, r) => {
                    if (r.type === 'bulk') return acc + r.successCount;
                    return acc + (r.status === 'Success' ? 1 : 0);
                  }, 0);
                  return total > 0 ? Math.round((success / total) * 100) + '%' : '0%';
                })()}</h3>
                <p>Success Rate</p>
              </div>
            </div>
            {/* Quick Actions */}
            <div className="quick-actions">
              <h3>Quick Actions</h3>
              <div className="quick-action-buttons">
                <button onClick={() => setView('execute')} className="quick-action-btn execute">
                  ▶️ Execute Test
                </button>
                <button onClick={() => setView('bulk')} className="quick-action-btn bulk">
                  📁 Bulk Upload
                </button>
                <button onClick={() => setView('history')} className="quick-action-btn history">
                  📜 View Full History
                </button>
              </div>
            </div>

            {/* Recent History Table */}
            <div className="recent-history">
              <h3>Recent History</h3>
              {results.length === 0 ? (
                <p className="no-history">No tests executed yet. Use the quick actions above to run your first test!</p>
              ) : (
                <table className="dashboard-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Command</th>
                      <th>Status</th>
                      <th>Document #</th>
                      <th>Date</th>
                      <th>Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      // Get last 5 entries (reversed to show newest first)
                      const recentResults = results.slice(-5).reverse();
                      let displayNum = 0;

                      return recentResults.map((r, i) => {
                        if (r.type === 'bulk') {
                          displayNum++;
                          const bulkNum = displayNum;
                          // Show only first 3 items from bulk + summary
                          const itemsToShow = r.results.slice(0, 3);
                          const hasMore = r.results.length > 3;

                          return (
                            <Fragment key={`dash-bulk-${r.jobId}`}>
                              {itemsToShow.map((item, itemIdx) => {
                                const itemDate = item.completedAt ? getIndiaDate(new Date(item.completedAt)) : r.date;
                                const itemTime = item.completedAt ? getIndiaTime(new Date(item.completedAt)) : r.time;
                                const isFirst = itemIdx === 0;
                                const isLast = itemIdx === itemsToShow.length - 1 && !hasMore;

                                return (
                                  <tr
                                    key={`dash-bulk-${r.jobId}-${itemIdx}`}
                                    className={`bulk-row ${isFirst ? 'bulk-row-first' : ''} ${isLast ? 'bulk-row-last' : ''} ${item.status === 'failed' ? 'row-failed' : item.status === 'success' ? 'row-success' : ''}`}
                                  >
                                    <td className="bulk-row-number">{isFirst ? bulkNum : ''}</td>
                                    <td>Bulk PO: {item.material}</td>
                                    <td>
                                      <span className={item.status === 'success' ? 'badge-success' : item.status === 'failed' ? 'badge-fail' : 'badge-cancelled'}>
                                        {item.status === 'success' ? 'Success' : item.status === 'failed' ? 'Failed' : item.status}
                                      </span>
                                    </td>
                                    <td>{item.poNumber ? `PO: ${item.poNumber}` : '—'}</td>
                                    <td>{itemDate}</td>
                                    <td>{itemTime}</td>
                                  </tr>
                                );
                              })}
                              {hasMore && (
                                <tr className="bulk-row bulk-row-last bulk-more-row">
                                  <td className="bulk-row-number"></td>
                                  <td colSpan={5} className="more-items">
                                    ... and {r.results.length - 3} more items ({r.successCount} success, {r.failedCount} failed)
                                    <button onClick={() => setView('history')} className="view-all-link">View All</button>
                                  </td>
                                </tr>
                              )}
                            </Fragment>
                          );
                        } else {
                          displayNum++;
                          return (
                            <tr key={`dash-single-${i}`} className={`single-row ${r.status === 'Failed' ? 'row-failed' : ''}`}>
                              <td>{displayNum}</td>
                              <td>{r.command.length > 40 ? r.command.substring(0, 40) + '...' : r.command}</td>
                              <td><span className={r.status === 'Success' ? 'badge-success' : r.status === 'Cancelled' ? 'badge-cancelled' : 'badge-fail'}>{r.status}</span></td>
                              <td>{r.documentType !== 'N/A' ? `${r.documentType}: ${r.documentNumber}` : r.documentNumber}</td>
                              <td>{r.date}</td>
                              <td>{r.time}</td>
                            </tr>
                          );
                        }
                      });
                    })()}
                  </tbody>
                </table>
              )}
              {results.length > 5 && (
                <div className="view-all-container">
                  <button onClick={() => setView('history')} className="view-all-btn">
                    View All History ({results.reduce((acc, r) => acc + (r.type === 'bulk' ? r.totalItems : 1), 0)} total entries)
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {view === 'execute' && (
          <div>
            <h1>Execute Test</h1>
            <p>Type your command in natural language:</p>

            <textarea
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              placeholder="Example: Create a purchase order for supplier ACS with material P-A2026-3, quantity 1, price 1000"
              rows={4}
              disabled={executing}
            />

            <div className="execute-buttons">
              <button onClick={executeCommand} disabled={executing || !command} className="execute-btn">
                {executing ? (
                  <span className="processing-indicator-inline">
                    <span className="hourglass-icon">⏳</span>
                    <span className="processing-text">Processing...</span>
                  </span>
                ) : '▶️ Execute Test'}
              </button>
              {executing && (
                <button
                  onClick={cancelExecution}
                  disabled={!canCancel}
                  className={`cancel-btn ${canCancel ? '' : 'disabled'}`}
                >
                  {canCancel ? '⛔ Cancel' : '⛔ Cancel'}
                </button>
              )}
            </div>

            <div className="examples">
              <p><strong>Example Commands:</strong></p>
              <button onClick={() => setCommand('Create a purchase order for supplier ACS with material P-A2026-3')}>
                Create PO for ACS
              </button>
              <button onClick={() => setCommand('Post goods receipt for PO 4500123456')}>
                Post Goods Receipt
              </button>
              <button onClick={() => setCommand('Complete full procurement flow for material P-A2026-3')}>
                Full Procurement Flow
              </button>
            </div>

            {currentSteps.length > 0 && (
              <div className="execution-viewer">
                <h3>Execution Progress:</h3>
                {currentSteps.map((step, i) => {
                  const isError = step.startsWith('✗') || step.startsWith('⚠️') || step.includes('VALIDATION ERROR') || step.includes('Invalid Document Type') || step.includes('Unrecognized Document');
                  const isCancelled = step.startsWith('⛔');
                  return (
                    <div key={i} className={`step ${isError ? 'step-error' : ''}`}>
                      {isError || isCancelled ? step : `✓ ${step}`}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {view === 'bulk' && (
          <div>
            <h1>Bulk Purchase Order Upload</h1>
            <p>Upload Excel, CSV, or JSON file with multiple Purchase Order items</p>

            <div className="bulk-upload-section">
              <input
                type="file"
                onChange={handleFileUpload}
                accept=".xlsx,.xls,.csv,.json"
                disabled={bulkUploading}
              />
              {bulkUploading && (
                <button onClick={cancelBulkJob} className="cancel-btn">
                  Cancel
                </button>
              )}
            </div>

            {/* Progress Display */}
            {bulkJobStatus && (
              <div className="bulk-progress">
                <h3>
                  {bulkJobStatus.status === 'running' ? 'Processing...' :
                   bulkJobStatus.status === 'completed' ? 'Completed' :
                   bulkJobStatus.status === 'cancelled' ? 'Cancelled' : 'Failed'}
                </h3>
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{ width: `${bulkJobStatus.progress}%` }}
                  />
                </div>
                {bulkJobStatus.status === 'running' && (
                  <div className="processing-indicator">
                    <span className="hourglass-icon">⏳</span>
                    <span className="processing-text">Processing...</span>
                  </div>
                )}
                <p>{bulkJobStatus.completedItems} / {bulkJobStatus.totalItems} items processed</p>
                <div className="bulk-stats">
                  <span className="stat-success">Success: {bulkJobStatus.successCount}</span>
                  <span className="stat-failed">Failed: {bulkJobStatus.failedCount}</span>
                </div>

                {/* Results Table */}
                {bulkJobStatus.results && bulkJobStatus.results.length > 0 && (
                  <div className="bulk-results">
                    <h4>Results:</h4>
                    <table>
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Material</th>
                          <th>Qty</th>
                          <th>Price</th>
                          <th>Status</th>
                          <th>PO Number</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bulkJobStatus.results.map((r, i) => (
                          <tr key={i} className={`row-${r.status}`}>
                            <td>{i + 1}</td>
                            <td>{r.material}</td>
                            <td>{r.quantity}</td>
                            <td>{r.price}</td>
                            <td>
                              <span className={
                                r.status === 'success' ? 'badge-success' :
                                r.status === 'failed' ? 'badge-fail' :
                                r.status === 'pending' && bulkJobStatus.status === 'running' ? 'badge-pending processing' :
                                r.status === 'pending' ? 'badge-pending' :
                                'badge-cancelled'
                              }>
                                {r.status === 'pending' && bulkJobStatus.status === 'running'
                                  ? '⏳ waiting...'
                                  : r.status === 'pending'
                                    ? '...'
                                    : r.status}
                              </span>
                            </td>
                            <td>{r.poNumber || r.error || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            <div className="bulk-info">
              <h3>File Format Requirements:</h3>
              <p><strong>Required columns:</strong> Material, Quantity, Price</p>
              <p><strong>All columns (in order):</strong></p>
              <ul>
                <li>Document Date (DD.MM.YYYY) - defaults to today</li>
                <li>Purchase Org - default: ACS</li>
                <li>Purchase Group - default: ACS</li>
                <li>Company Code - default: ACS</li>
                <li>Account Assignment - default: K</li>
                <li>Material - e.g., P-A2026-3</li>
                <li>PO Quantity - e.g., 1</li>
                <li>Unit of Measure - default: EA</li>
                <li>Net Price - e.g., 1000</li>
                <li>Plant - default: ACS</li>
                <li>GL Account - default: 610010</li>
                <li>Cost Center - default: ACSC110</li>
              </ul>

              <h4>Supported Formats:</h4>
              <ul>
                <li>📊 <strong>Excel</strong> (.xlsx, .xls) - First sheet will be read</li>
                <li>📄 <strong>CSV</strong> (.csv) - Header row required</li>
                <li>📋 <strong>JSON</strong> (.json) - Array of objects</li>
              </ul>

              <h4>Example CSV:</h4>
              <pre>
{`DocumentDate,PurchaseOrg,PurchaseGroup,CompanyCode,AccountAssignment,Material,Quantity,Unit,Price,Plant,GLAccount,CostCenter
24.01.2025,ACS,ACS,ACS,K,P-A2026-3,11,EA,99,ACS,610010,ACSC110
23.01.2025,ACS,ACS,ACS,K,P-A2026-2,34,EA,8763,ACS,610010,ACSC110`}
              </pre>

              <h4>Example JSON:</h4>
              <pre>
{`[
  {
    "documentDate": "24.01.2025",
    "material": "P-A2026-3",
    "quantity": "11",
    "price": "99",
    "costCenter": "ACSC110"
  }
]`}
              </pre>

              <a href="/sample-bulk-po.csv" download>
                <button className="download-btn">Download Sample CSV Template</button>
              </a>
            </div>
          </div>
        )}

        {view === 'history' && (
          <div>
            <h1>Test History</h1>
            {results.length === 0 ? (
              <p>No test history yet.</p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Command</th>
                    <th>Status</th>
                    <th>Document #</th>
                    <th>Date</th>
                    <th>Time</th>
                    <th>Created By</th>
                    <th>Error Details</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    let rowNum = 0;
                    return results.map((r, i) => {
                      if (r.type === 'bulk') {
                        // All bulk items share ONE row number, shown only on first row
                        rowNum++;
                        const bulkRowNum = rowNum;

                        return (
                          <Fragment key={`bulk-${r.jobId}`}>
                            {/* Spacer row before bulk group */}
                            {i > 0 && <tr className="spacer-row"><td colSpan={8}></td></tr>}
                            {r.results.map((item, itemIdx) => {
                              const itemDate = item.completedAt ? getIndiaDate(new Date(item.completedAt)) : r.date;
                              const itemTime = item.completedAt ? getIndiaTime(new Date(item.completedAt)) : r.time;
                              const isFirst = itemIdx === 0;
                              const isLast = itemIdx === r.results.length - 1;

                              return (
                                <tr
                                  key={`bulk-${r.jobId}-item-${itemIdx}`}
                                  className={`bulk-row ${isFirst ? 'bulk-row-first' : ''} ${isLast ? 'bulk-row-last' : ''} ${item.status === 'failed' ? 'row-failed' : item.status === 'success' ? 'row-success' : ''}`}
                                >
                                  <td className="bulk-row-number">{isFirst ? bulkRowNum : ''}</td>
                                  <td>Bulk PO: {item.material}, Qty: {item.quantity}, Price: {item.price}</td>
                                  <td>
                                    <span className={item.status === 'success' ? 'badge-success' : item.status === 'failed' ? 'badge-fail' : 'badge-cancelled'}>
                                      {item.status === 'success' ? 'Success' : item.status === 'failed' ? 'Failed' : item.status}
                                    </span>
                                  </td>
                                  <td>{item.poNumber ? `PO: ${item.poNumber}` : '—'}</td>
                                  <td>{itemDate}</td>
                                  <td>{itemTime}</td>
                                  <td>{r.createdBy}</td>
                                  <td className={`error-cell ${item.status === 'success' ? 'success-cell' : ''}`}>{transformErrorToRCA(item.error, item.status === 'success')}</td>
                                </tr>
                              );
                            })}
                            {/* Spacer row after bulk group */}
                            <tr className="spacer-row"><td colSpan={8}></td></tr>
                          </Fragment>
                        );
                      } else {
                        // Single entry
                        rowNum++;
                        return (
                          <Fragment key={i}>
                            {/* Spacer row before single entry (if not first) */}
                            {i > 0 && <tr className="spacer-row"><td colSpan={8}></td></tr>}
                            <tr className={`single-row ${r.status === 'Failed' ? 'row-failed' : ''}`}>
                              <td>{rowNum}</td>
                              <td>{r.command}</td>
                              <td><span className={r.status === 'Success' ? 'badge-success' : r.status === 'Cancelled' ? 'badge-cancelled' : 'badge-fail'}>{r.status}</span></td>
                              <td>{r.documentType !== 'N/A' ? `${r.documentType}: ${r.documentNumber}` : r.documentNumber}</td>
                              <td>{r.date}</td>
                              <td>{r.time}</td>
                              <td>{r.createdBy}</td>
                              <td className={`error-cell ${r.status === 'Success' ? 'success-cell' : ''}`}>{transformErrorToRCA(r.error, r.status === 'Success')}</td>
                            </tr>
                          </Fragment>
                        );
                      }
                    });
                  })()}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
