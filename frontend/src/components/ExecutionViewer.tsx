import {
  Box,
  Card,
  CardContent,
  Typography,
  LinearProgress,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Paper,
  Chip,
  Alert,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  HourglassEmpty as HourglassEmptyIcon,
  PlayCircle as PlayCircleIcon,
} from '@mui/icons-material';
import { TestStep } from '../types';

interface ExecutionViewerProps {
  isExecuting: boolean;
  currentCommand?: string;
  steps: TestStep[];
  error?: string;
  duration?: number;
}

export default function ExecutionViewer({
  isExecuting,
  currentCommand,
  steps,
  error,
  duration,
}: ExecutionViewerProps) {
  const getStepIcon = (status: TestStep['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircleIcon color="success" />;
      case 'running':
        return <PlayCircleIcon color="primary" />;
      case 'failed':
        return <ErrorIcon color="error" />;
      case 'pending':
        return <HourglassEmptyIcon color="disabled" />;
    }
  };

  const getStatusColor = (status: TestStep['status']) => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'running':
        return 'primary';
      case 'failed':
        return 'error';
      case 'pending':
        return 'default';
    }
  };

  if (!isExecuting && steps.length === 0) {
    return null;
  }

  return (
    <Card sx={{ mt: 3 }}>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h5">
            {isExecuting ? 'Test Executing...' : 'Test Results'}
          </Typography>
          {duration && (
            <Chip
              label={`${(duration / 1000).toFixed(1)}s`}
              color="primary"
              variant="outlined"
            />
          )}
        </Box>

        {currentCommand && (
          <Paper sx={{ p: 2, mb: 2, bgcolor: 'grey.50' }}>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Command:
            </Typography>
            <Typography variant="body1">{currentCommand}</Typography>
          </Paper>
        )}

        {isExecuting && (
          <Box sx={{ mb: 3 }}>
            <LinearProgress />
          </Box>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Stepper orientation="vertical" activeStep={-1}>
          {steps.map((step, index) => (
            <Step key={step.id} active={step.status === 'running'} completed={step.status === 'completed'}>
              <StepLabel
                icon={getStepIcon(step.status)}
                error={step.status === 'failed'}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="body1">{step.description}</Typography>
                  <Chip
                    label={step.status}
                    size="small"
                    color={getStatusColor(step.status)}
                    sx={{ textTransform: 'capitalize' }}
                  />
                </Box>
              </StepLabel>
              <StepContent>
                <Typography variant="caption" color="text.secondary">
                  {new Date(step.timestamp).toLocaleTimeString()}
                </Typography>
                {step.screenshot && (
                  <Box sx={{ mt: 1 }}>
                    <img
                      src={step.screenshot}
                      alt={`Step ${index + 1}`}
                      style={{
                        maxWidth: '100%',
                        maxHeight: '300px',
                        borderRadius: '4px',
                        border: '1px solid #e0e0e0',
                      }}
                    />
                  </Box>
                )}
              </StepContent>
            </Step>
          ))}
        </Stepper>

        {!isExecuting && steps.length > 0 && !error && (
          <Alert severity="success" sx={{ mt: 2 }}>
            Test completed successfully! All steps executed without errors.
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
