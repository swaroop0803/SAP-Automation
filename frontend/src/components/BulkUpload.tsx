import { useState, useRef } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Alert,
  IconButton,
  Paper,
} from '@mui/material';
import {
  CloudUpload as CloudUploadIcon,
  Delete as DeleteIcon,
  PlayArrow as PlayArrowIcon,
  Download as DownloadIcon,
} from '@mui/icons-material';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';

interface BulkTestData {
  id: string;
  command: string;
  parameters: Record<string, any>;
  status?: 'pending' | 'running' | 'completed' | 'failed';
}

interface BulkUploadProps {
  onExecuteBulk: (tests: BulkTestData[]) => void;
  isExecuting: boolean;
}

export default function BulkUpload({ onExecuteBulk, isExecuting }: BulkUploadProps) {
  const [uploadedTests, setUploadedTests] = useState<BulkTestData[]>([]);
  const [error, setError] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError('');

    try {
      const fileExtension = file.name.split('.').pop()?.toLowerCase();

      if (fileExtension === 'json') {
        await handleJsonUpload(file);
      } else if (fileExtension === 'csv') {
        await handleCsvUpload(file);
      } else if (fileExtension === 'xlsx' || fileExtension === 'xls') {
        await handleExcelUpload(file);
      } else {
        setError('Unsupported file format. Please upload .json, .csv, .xlsx, or .xls files.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse file');
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleJsonUpload = async (file: File) => {
    const text = await file.text();
    const data = JSON.parse(text);

    const tests: BulkTestData[] = Array.isArray(data) ? data : [data];
    const formattedTests = tests.map((test, index) => ({
      id: `bulk-${Date.now()}-${index}`,
      command: test.command || formatCommandFromParams(test),
      parameters: test.parameters || test,
      status: 'pending' as const,
    }));

    setUploadedTests(formattedTests);
  };

  const handleCsvUpload = (file: File) => {
    Papa.parse(file, {
      header: true,
      complete: (results) => {
        const tests = results.data.map((row: any, index: number) => ({
          id: `bulk-${Date.now()}-${index}`,
          command: row.command || formatCommandFromParams(row),
          parameters: row,
          status: 'pending' as const,
        }));
        setUploadedTests(tests);
      },
      error: (error) => {
        setError(`CSV parsing error: ${error.message}`);
      },
    });
  };

  const handleExcelUpload = async (file: File) => {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer);
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(firstSheet);

    const tests = data.map((row: any, index: number) => ({
      id: `bulk-${Date.now()}-${index}`,
      command: row.command || formatCommandFromParams(row),
      parameters: row,
      status: 'pending' as const,
    }));

    setUploadedTests(tests);
  };

  const formatCommandFromParams = (params: any): string => {
    if (params.action === 'create_po' || params.material) {
      return `Create a purchase order for supplier ${params.supplier || 'ACS'} with material ${
        params.material || 'P-A2026-3'
      }`;
    } else if (params.action === 'goods_receipt' || params.poNumber) {
      return `Post goods receipt for PO ${params.poNumber}`;
    } else if (params.action === 'invoice') {
      return `Create supplier invoice for PO ${params.poNumber} with amount ${params.amount}`;
    }
    return JSON.stringify(params);
  };

  const handleExecuteAll = () => {
    if (uploadedTests.length > 0) {
      onExecuteBulk(uploadedTests);
    }
  };

  const handleRemoveTest = (id: string) => {
    setUploadedTests((prev) => prev.filter((test) => test.id !== id));
  };

  const handleDownloadTemplate = () => {
    const template = [
      {
        action: 'create_po',
        supplier: 'ACS',
        material: 'P-A2026-3',
        quantity: 1,
        price: 1000,
        plant: 'acs',
        glAccount: '610010',
      },
      {
        action: 'goods_receipt',
        poNumber: '4500123456',
      },
      {
        action: 'invoice',
        poNumber: '4500123456',
        amount: 1000,
      },
    ];

    const worksheet = XLSX.utils.json_to_sheet(template);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Test Data');
    XLSX.writeFile(workbook, 'sap_test_template.xlsx');
  };

  return (
    <Card>
      <CardContent>
        <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CloudUploadIcon color="primary" />
          Bulk Test Execution
        </Typography>

        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Upload a file containing multiple test scenarios to execute them in batch. Supports Excel
          (.xlsx, .xls), CSV (.csv), and JSON (.json) formats.
        </Typography>

        <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,.csv,.xlsx,.xls"
            style={{ display: 'none' }}
            onChange={handleFileUpload}
          />
          <Button
            variant="contained"
            startIcon={<CloudUploadIcon />}
            onClick={() => fileInputRef.current?.click()}
            disabled={isExecuting}
          >
            Upload File
          </Button>

          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={handleDownloadTemplate}
          >
            Download Template
          </Button>

          {uploadedTests.length > 0 && (
            <Button
              variant="contained"
              color="success"
              startIcon={<PlayArrowIcon />}
              onClick={handleExecuteAll}
              disabled={isExecuting}
            >
              Execute All ({uploadedTests.length})
            </Button>
          )}
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {uploadedTests.length > 0 && (
          <>
            <Alert severity="info" sx={{ mb: 2 }}>
              {uploadedTests.length} test(s) loaded. Review and click "Execute All" to run them.
            </Alert>

            <TableContainer component={Paper} sx={{ maxHeight: 400 }}>
              <Table stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell width={50}>#</TableCell>
                    <TableCell>Command</TableCell>
                    <TableCell>Parameters</TableCell>
                    <TableCell width={100}>Status</TableCell>
                    <TableCell width={80}>Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {uploadedTests.map((test, index) => (
                    <TableRow key={test.id}>
                      <TableCell>{index + 1}</TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ maxWidth: 300 }}>
                          {test.command}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                          {JSON.stringify(test.parameters).substring(0, 50)}...
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={test.status || 'pending'}
                          size="small"
                          color={
                            test.status === 'completed'
                              ? 'success'
                              : test.status === 'failed'
                              ? 'error'
                              : test.status === 'running'
                              ? 'primary'
                              : 'default'
                          }
                          sx={{ textTransform: 'capitalize' }}
                        />
                      </TableCell>
                      <TableCell>
                        <IconButton
                          size="small"
                          onClick={() => handleRemoveTest(test.id)}
                          disabled={isExecuting}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </>
        )}

        {uploadedTests.length === 0 && (
          <Paper
            sx={{
              p: 4,
              textAlign: 'center',
              border: '2px dashed',
              borderColor: 'divider',
              bgcolor: 'grey.50',
            }}
          >
            <CloudUploadIcon sx={{ fontSize: 60, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              No file uploaded
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Click "Upload File" to select a file or "Download Template" to get a sample file
            </Typography>
          </Paper>
        )}
      </CardContent>
    </Card>
  );
}
