import {
  Box,
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Collapse,
  Paper,
} from '@mui/material';
import {
  KeyboardArrowDown as KeyboardArrowDownIcon,
  KeyboardArrowUp as KeyboardArrowUpIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  HourglassEmpty as HourglassEmptyIcon,
} from '@mui/icons-material';
import { useState } from 'react';
import type { TestCommand } from '../types';

interface CommandHistoryProps {
  commands: TestCommand[];
}

function HistoryRow({ command }: { command: TestCommand }) {
  const [open, setOpen] = useState(false);

  const getStatusIcon = (status: TestCommand['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircleIcon color="success" fontSize="small" />;
      case 'failed':
        return <ErrorIcon color="error" fontSize="small" />;
      case 'running':
        return <HourglassEmptyIcon color="primary" fontSize="small" />;
      case 'pending':
        return <HourglassEmptyIcon color="disabled" fontSize="small" />;
    }
  };

  const getStatusColor = (status: TestCommand['status']) => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'failed':
        return 'error';
      case 'running':
        return 'primary';
      case 'pending':
        return 'default';
    }
  };

  return (
    <>
      <TableRow sx={{ '& > *': { borderBottom: 'unset' } }}>
        <TableCell>
          <IconButton size="small" onClick={() => setOpen(!open)}>
            {open ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
          </IconButton>
        </TableCell>
        <TableCell>
          {new Date(command.timestamp).toLocaleString()}
        </TableCell>
        <TableCell>
          <Box sx={{ maxWidth: 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {command.command}
          </Box>
        </TableCell>
        <TableCell>
          <Chip
            icon={getStatusIcon(command.status)}
            label={command.status}
            color={getStatusColor(command.status)}
            size="small"
            sx={{ textTransform: 'capitalize' }}
          />
        </TableCell>
        <TableCell>
          {command.result?.duration
            ? `${(command.result.duration / 1000).toFixed(1)}s`
            : '-'}
        </TableCell>
      </TableRow>
      <TableRow>
        <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={5}>
          <Collapse in={open} timeout="auto" unmountOnExit>
            <Box sx={{ margin: 2 }}>
              <Typography variant="h6" gutterBottom component="div">
                Details
              </Typography>
              <Paper sx={{ p: 2, bgcolor: 'grey.50', mb: 2 }}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Full Command:
                </Typography>
                <Typography variant="body2">{command.command}</Typography>
              </Paper>

              {command.result && (
                <Box>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Result:
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    {command.result.message}
                  </Typography>

                  {command.result.errors && command.result.errors.length > 0 && (
                    <Box sx={{ mt: 2 }}>
                      <Typography variant="subtitle2" color="error" gutterBottom>
                        Error Details:
                      </Typography>
                      <Paper
                        sx={{
                          p: 2,
                          bgcolor: '#fff5f5',
                          border: '1px solid #ffcdd2',
                          maxHeight: 300,
                          overflow: 'auto'
                        }}
                      >
                        {command.result.errors.map((error, idx) => (
                          <Typography
                            key={idx}
                            variant="body2"
                            color="error"
                            sx={{
                              fontFamily: 'monospace',
                              whiteSpace: 'pre-wrap',
                              wordBreak: 'break-word',
                              fontSize: '0.85rem'
                            }}
                          >
                            {error}
                          </Typography>
                        ))}
                      </Paper>
                    </Box>
                  )}

                  {command.result.steps && command.result.steps.length > 0 && (
                    <Box sx={{ mt: 2 }}>
                      <Typography variant="subtitle2" gutterBottom>
                        Steps Executed: {command.result.steps.length}
                      </Typography>
                    </Box>
                  )}
                </Box>
              )}
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
}

export default function CommandHistory({ commands }: CommandHistoryProps) {
  if (commands.length === 0) {
    return (
      <Card>
        <CardContent>
          <Typography variant="h5" gutterBottom>
            Command History
          </Typography>
          <Typography variant="body2" color="text.secondary">
            No commands executed yet. Start by executing a test from the Execute Test page.
          </Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent>
        <Typography variant="h5" gutterBottom>
          Command History
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          View all previously executed commands and their results
        </Typography>

        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell width={50} />
                <TableCell>Timestamp</TableCell>
                <TableCell>Command</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Duration</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {commands.map((command) => (
                <HistoryRow key={command.id} command={command} />
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </CardContent>
    </Card>
  );
}
