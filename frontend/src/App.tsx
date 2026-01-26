import { useState, useRef, useEffect } from 'react';
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
}

function App() {
  const [view, setView] = useState('dashboard');
  const [command, setCommand] = useState('');
  const [executing, setExecuting] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [currentSteps, setCurrentSteps] = useState<string[]>([]);
  const [canCancel, setCanCancel] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const cancelTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Bulk upload state
  const [bulkJobId, setBulkJobId] = useState<string | null>(null);
  const [bulkJobStatus, setBulkJobStatus] = useState<BulkJobStatus | null>(null);
  const [bulkUploading, setBulkUploading] = useState(false);
  const bulkPollRef = useRef<NodeJS.Timeout | null>(null);

  const executeCommand = async () => {
    if (!command) return;

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
      const isInvoiceCommand = command.toLowerCase().includes('invoice');
      const isGoodsReceiptCommand = command.toLowerCase().includes('goods') ||
                                     command.toLowerCase().includes('receipt') ||
                                     command.toLowerCase().includes('gr ');

      // Determine document type and number to display
      let documentType = 'PO';
      let documentNumber = result.poNumber || 'N/A';

      if (isGoodsReceiptCommand && result.materialDocNumber) {
        documentType = 'Material Doc';
        documentNumber = result.materialDocNumber;
      } else if (isInvoiceCommand && result.invoiceNumber) {
        documentType = 'Invoice';
        documentNumber = result.invoiceNumber;
      }

      setResults(prev => [...prev, {
        command,
        status: result.success ? 'Success' : 'Failed',
        time: new Date().toLocaleTimeString(),
        poNumber: result.poNumber || 'N/A',
        invoiceNumber: result.invoiceNumber || 'N/A',
        materialDocNumber: result.materialDocNumber || 'N/A',
        documentNumber,
        documentType,
        error: result.errors ? result.errors[0] : undefined
      }]);

    } catch (error) {
      // Check if it was cancelled
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('Execution cancelled by user');
        setCurrentSteps(prev => [...prev, '⛔ Execution cancelled by user']);
        setResults(prev => [...prev, {
          command,
          status: 'Cancelled',
          time: new Date().toLocaleTimeString(),
          poNumber: 'N/A',
          invoiceNumber: 'N/A',
          materialDocNumber: 'N/A',
          documentNumber: 'N/A',
          documentType: 'N/A',
          error: 'Cancelled by user'
        }]);
      } else {
        console.error('Execution error:', error);
        setCurrentSteps(prev => [...prev, `✗ Error: ${error instanceof Error ? error.message : 'Connection failed'}`]);

        setResults(prev => [...prev, {
          command,
          status: 'Failed',
          time: new Date().toLocaleTimeString(),
          poNumber: 'N/A',
          invoiceNumber: 'N/A',
          materialDocNumber: 'N/A',
          documentNumber: 'N/A',
          documentType: 'N/A',
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

  return (
    <div className="app">
      <div className="sidebar">
        <h2>SAP Automation</h2>
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
                <h3>{results.length}</h3>
                <p>Total Tests</p>
              </div>
              <div className="stat-card green">
                <h3>{results.filter(r => r.status === 'Success').length}</h3>
                <p>Successful</p>
              </div>
              <div className="stat-card red">
                <h3>{results.filter(r => r.status === 'Failed').length}</h3>
                <p>Failed</p>
              </div>
              <div className="stat-card blue">
                <h3>{results.length > 0 ? Math.round((results.filter(r => r.status === 'Success').length / results.length) * 100) + '%' : '0%'}</h3>
                <p>Success Rate</p>
              </div>
            </div>
            <div className="recent">
              <h3>Recent Activity</h3>
              {results.length === 0 ? (
                <p>No tests executed yet. Go to "Execute Test" to run your first test!</p>
              ) : (
                <ul>
                  {results.slice(-5).reverse().map((r, i) => (
                    <li key={i}>
                      <strong>{r.command}</strong> - {r.status} - {r.documentType}: {r.documentNumber} - {r.time}
                    </li>
                  ))}
                </ul>
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
                {executing ? '⏳ Executing...' : '▶️ Execute Test'}
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
                {currentSteps.map((step, i) => (
                  <div key={i} className={`step ${step.startsWith('✗') ? 'step-error' : ''}`}>
                    {step.startsWith('✗') || step.startsWith('⛔') ? step : `✓ ${step}`}
                  </div>
                ))}
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
                    <th>Time</th>
                    <th>Error Details</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r, i) => (
                    <tr key={i} className={r.status === 'Failed' ? 'row-failed' : ''}>
                      <td>{i + 1}</td>
                      <td>{r.command}</td>
                      <td><span className={r.status === 'Success' ? 'badge-success' : r.status === 'Cancelled' ? 'badge-cancelled' : 'badge-fail'}>{r.status}</span></td>
                      <td>{r.documentType !== 'N/A' ? `${r.documentType}: ${r.documentNumber}` : r.documentNumber}</td>
                      <td>{r.time}</td>
                      <td className="error-cell">{r.error || '-'}</td>
                    </tr>
                  ))}
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
