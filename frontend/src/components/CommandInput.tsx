import { useState } from 'react';
import {
  Box,
  TextField,
  Button,
  Card,
  CardContent,
  Typography,
  Chip,
  Stack,
  Alert,
  CircularProgress,
} from '@mui/material';
import {
  Send as SendIcon,
  Lightbulb as LightbulbIcon,
} from '@mui/icons-material';

interface CommandInputProps {
  onExecute: (command: string) => void;
  isExecuting: boolean;
}

const exampleCommands = [
  'Create a purchase order for supplier ACS with material P-A2026-3',
  'Post goods receipt for PO 4500123456',
  'Create supplier invoice for PO 4500123456 with amount 1000',
  'Complete full procurement flow for material P-A2026-3',
];

export default function CommandInput({ onExecute, isExecuting }: CommandInputProps) {
  const [command, setCommand] = useState('');
  const [showExamples, setShowExamples] = useState(true);

  const handleSubmit = () => {
    if (command.trim() && !isExecuting) {
      onExecute(command.trim());
      setCommand('');
      setShowExamples(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      handleSubmit();
    }
  };

  const handleExampleClick = (example: string) => {
    setCommand(example);
    setShowExamples(false);
  };

  return (
    <Card>
      <CardContent>
        <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <SendIcon color="primary" />
          Execute SAP Test
        </Typography>

        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Describe what you want to test in natural language. The AI will interpret your command
          and execute the corresponding SAP automation test.
        </Typography>

        <TextField
          fullWidth
          multiline
          rows={4}
          placeholder="E.g., Create a purchase order for supplier ACS with material P-A2026-3, quantity 1, and price 1000"
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          onKeyPress={handleKeyPress}
          disabled={isExecuting}
          sx={{ mb: 2 }}
        />

        <Stack direction="row" spacing={2} alignItems="center">
          <Button
            variant="contained"
            size="large"
            startIcon={isExecuting ? <CircularProgress size={20} color="inherit" /> : <SendIcon />}
            onClick={handleSubmit}
            disabled={!command.trim() || isExecuting}
          >
            {isExecuting ? 'Executing...' : 'Execute Test'}
          </Button>

          <Typography variant="caption" color="text.secondary">
            Ctrl + Enter to execute
          </Typography>
        </Stack>

        {showExamples && (
          <Box sx={{ mt: 3 }}>
            <Typography
              variant="subtitle2"
              sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}
            >
              <LightbulbIcon fontSize="small" color="warning" />
              Example Commands
            </Typography>

            <Stack spacing={1}>
              {exampleCommands.map((example, index) => (
                <Chip
                  key={index}
                  label={example}
                  onClick={() => handleExampleClick(example)}
                  sx={{
                    justifyContent: 'flex-start',
                    height: 'auto',
                    py: 1,
                    px: 1.5,
                    '& .MuiChip-label': {
                      whiteSpace: 'normal',
                      textAlign: 'left',
                    },
                    cursor: 'pointer',
                    '&:hover': {
                      bgcolor: 'primary.light',
                      color: 'white',
                    },
                  }}
                />
              ))}
            </Stack>
          </Box>
        )}

        <Alert severity="info" sx={{ mt: 2 }}>
          <Typography variant="body2">
            The AI will parse your command and map it to the appropriate SAP automation workflow.
            You can mention: supplier codes, material numbers, quantities, prices, dates, and more.
          </Typography>
        </Alert>
      </CardContent>
    </Card>
  );
}
