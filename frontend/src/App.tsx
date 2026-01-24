import { useState } from 'react';
import './App.css';

function App() {
  const [view, setView] = useState('dashboard');
  const [command, setCommand] = useState('');
  const [executing, setExecuting] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [currentSteps, setCurrentSteps] = useState<string[]>([]);

  const executeCommand = async () => {
    if (!command) return;

    setExecuting(true);
    setCurrentSteps([]);

    try {
      // Call the backend API
      const response = await fetch('http://localhost:3001/api/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ command }),
      });

      const result = await response.json();

      // Display steps as they come
      if (result.steps) {
        for (const step of result.steps) {
          setCurrentSteps(prev => [...prev, step.description]);
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      // Add to results
      setResults(prev => [...prev, {
        command,
        status: result.success ? 'Success' : 'Failed',
        time: new Date().toLocaleTimeString(),
        poNumber: result.poNumber || 'N/A',
        error: result.errors ? result.errors[0] : undefined
      }]);

    } catch (error) {
      console.error('Execution error:', error);
      setCurrentSteps(prev => [...prev, `✗ Error: ${error instanceof Error ? error.message : 'Connection failed'}`]);

      setResults(prev => [...prev, {
        command,
        status: 'Failed',
        time: new Date().toLocaleTimeString(),
        poNumber: 'N/A',
        error: 'Backend connection failed'
      }]);
    }

    setExecuting(false);
    setCommand('');
  };

  const handleFileUpload = (e: any) => {
    const file = e.target.files[0];
    if (file) {
      alert(`File "${file.name}" uploaded! Ready to execute ${file.name.includes('.xlsx') ? 'Excel' : 'CSV/JSON'} tests.`);
    }
  };

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
                      <strong>{r.command}</strong> - {r.status} - PO: {r.poNumber} - {r.time}
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

            <button onClick={executeCommand} disabled={executing || !command} className="execute-btn">
              {executing ? '⏳ Executing...' : '▶️ Execute Test'}
            </button>

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
                  <div key={i} className="step">
                    ✓ {step}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {view === 'bulk' && (
          <div>
            <h1>Bulk Upload</h1>
            <p>Upload Excel, CSV, or JSON file with multiple test scenarios</p>

            <input type="file" onChange={handleFileUpload} accept=".xlsx,.xls,.csv,.json" />

            <div className="bulk-info">
              <h3>Supported Formats:</h3>
              <ul>
                <li>📊 <strong>Excel</strong> (.xlsx, .xls)</li>
                <li>📄 <strong>CSV</strong> (.csv)</li>
                <li>📋 <strong>JSON</strong> (.json)</li>
              </ul>

              <a href="/sample-bulk-test-data.json" download>
                <button>⬇️ Download Sample Template</button>
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
                    <th>PO Number</th>
                    <th>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r, i) => (
                    <tr key={i}>
                      <td>{i + 1}</td>
                      <td>{r.command}</td>
                      <td><span className={r.status === 'Success' ? 'badge-success' : 'badge-fail'}>{r.status}</span></td>
                      <td>{r.poNumber}</td>
                      <td>{r.time}</td>
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
