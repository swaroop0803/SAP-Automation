import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Paper,
  LinearProgress,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Timeline as TimelineIcon,
  Speed as SpeedIcon,
} from '@mui/icons-material';
import { TestCommand } from '../types';

interface DashboardProps {
  commands: TestCommand[];
}

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
  subtitle?: string;
}

function StatCard({ title, value, icon, color, subtitle }: StatCardProps) {
  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              {title}
            </Typography>
            <Typography variant="h3" sx={{ color, fontWeight: 600 }}>
              {value}
            </Typography>
            {subtitle && (
              <Typography variant="caption" color="text.secondary">
                {subtitle}
              </Typography>
            )}
          </Box>
          <Box
            sx={{
              bgcolor: `${color}15`,
              borderRadius: 2,
              p: 1.5,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {icon}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}

export default function Dashboard({ commands }: DashboardProps) {
  const totalTests = commands.length;
  const completedTests = commands.filter((c) => c.status === 'completed').length;
  const failedTests = commands.filter((c) => c.status === 'failed').length;
  const successRate = totalTests > 0 ? ((completedTests / totalTests) * 100).toFixed(1) : 0;

  const avgDuration =
    commands.length > 0
      ? commands
          .filter((c) => c.result?.duration)
          .reduce((sum, c) => sum + (c.result?.duration || 0), 0) / commands.length / 1000
      : 0;

  const recentCommands = commands.slice(-5).reverse();

  return (
    <Box>
      <Typography variant="h4" gutterBottom sx={{ mb: 3 }}>
        Dashboard
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Total Tests"
            value={totalTests}
            icon={<TimelineIcon sx={{ fontSize: 40, color: '#1976d2' }} />}
            color="#1976d2"
          />
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Successful"
            value={completedTests}
            icon={<CheckCircleIcon sx={{ fontSize: 40, color: '#2e7d32' }} />}
            color="#2e7d32"
          />
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Failed"
            value={failedTests}
            icon={<ErrorIcon sx={{ fontSize: 40, color: '#d32f2f' }} />}
            color="#d32f2f"
          />
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Success Rate"
            value={`${successRate}%`}
            icon={<SpeedIcon sx={{ fontSize: 40, color: '#9c27b0' }} />}
            color="#9c27b0"
          />
        </Grid>
      </Grid>

      <Grid container spacing={3} sx={{ mt: 1 }}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Performance Metrics
              </Typography>

              <Box sx={{ mt: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    Average Duration
                  </Typography>
                  <Typography variant="body2" fontWeight={600}>
                    {avgDuration.toFixed(1)}s
                  </Typography>
                </Box>

                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    Success Rate
                  </Typography>
                  <Typography variant="body2" fontWeight={600}>
                    {successRate}%
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={Number(successRate)}
                  sx={{ height: 8, borderRadius: 4 }}
                />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Recent Activity
              </Typography>

              {recentCommands.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                  No recent activity. Execute a test to see it here.
                </Typography>
              ) : (
                <Box sx={{ mt: 2 }}>
                  {recentCommands.map((command) => (
                    <Paper
                      key={command.id}
                      sx={{
                        p: 2,
                        mb: 1.5,
                        bgcolor:
                          command.status === 'completed'
                            ? 'success.lighter'
                            : command.status === 'failed'
                            ? 'error.lighter'
                            : 'grey.50',
                        border: '1px solid',
                        borderColor:
                          command.status === 'completed'
                            ? 'success.light'
                            : command.status === 'failed'
                            ? 'error.light'
                            : 'grey.200',
                      }}
                    >
                      <Typography
                        variant="body2"
                        sx={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          mb: 0.5,
                        }}
                      >
                        {command.command}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {new Date(command.timestamp).toLocaleString()} •{' '}
                        {command.status === 'completed' ? '✓ Success' : '✗ Failed'}
                      </Typography>
                    </Paper>
                  ))}
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
