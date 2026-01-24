# SAP Test Automation Frontend

A modern React web application that provides a natural language interface for SAP test automation using Playwright.

## Features

- **Natural Language Input**: Describe your SAP test scenarios in plain English
- **Real-time Execution Viewer**: Watch your tests execute step-by-step with live progress updates
- **Command History**: Track all executed commands and their results
- **Analytics Dashboard**: View success rates, performance metrics, and recent activity
- **AI-Powered Parsing**: Converts natural language into structured test commands (mock implementation)

## Getting Started

### Prerequisites

- Node.js 18+ and npm

### Installation

```bash
# Install dependencies
npm install
```

### Running the Application

```bash
# Start development server
npm run dev
```

The application will be available at `http://localhost:5173`

### Building for Production

```bash
# Build the application
npm run build

# Preview production build
npm run preview
```

## Usage

### Execute Test View

1. Navigate to "Execute Test" from the sidebar
2. Type your command in natural language, for example:
   - "Create a purchase order for supplier ACS with material P-A2026-3"
   - "Post goods receipt for PO 4500123456"
   - "Complete full procurement flow for material P-A2026-3"
3. Click "Execute Test" or press Ctrl+Enter
4. Watch the real-time progress as steps are executed

### Dashboard View

- View overall statistics (total tests, success rate, etc.)
- Monitor performance metrics
- See recent test activity

### History View

- Browse all previously executed commands
- Expand any command to see detailed results
- Review success/failure status and execution duration

## Architecture

### Components

- **Layout**: Main application layout with responsive navigation
- **Dashboard**: Statistics and metrics visualization
- **CommandInput**: Natural language input interface with example commands
- **ExecutionViewer**: Real-time test execution display with step progress
- **CommandHistory**: Historical command list with expandable details

### Services

- **API Service**: Handles test execution and command parsing
  - Currently uses mock data for demonstration
  - Will integrate with backend API once implemented

### State Management

- React hooks (useState) for local state management
- Centralized state in App component
- Real-time updates via callback functions

## Technology Stack

- **React 18** with TypeScript
- **Vite** for fast development and building
- **Material-UI (MUI)** for component library and theming
- **Emotion** for CSS-in-JS styling

## Next Steps

### Backend Integration

This frontend is ready to integrate with a Node.js backend that will:

1. **Parse Commands**: Use Claude API or OpenAI to parse natural language into test parameters
2. **Execute Tests**: Run Playwright automation scripts based on parsed commands
3. **WebSocket Updates**: Provide real-time progress updates during test execution
4. **Result Storage**: Persist test results and history

### Recommended Backend Structure

```
backend/
├── src/
│   ├── server.ts          # Express server
│   ├── ai/
│   │   └── parser.ts      # AI command parsing
│   ├── test-runner/
│   │   └── executor.ts    # Playwright test execution
│   ├── routes/
│   │   └── api.ts         # API endpoints
│   └── websocket/
│       └── handler.ts     # Real-time updates
```

### API Endpoints Needed

- `POST /api/execute` - Execute a test command
- `GET /api/commands` - Get command history
- `GET /api/commands/:id` - Get specific command result
- `WebSocket /ws` - Real-time execution updates

## Example Commands

The application recognizes these types of commands:

- **Purchase Order**: "Create a purchase order for supplier [CODE] with material [MAT-ID]"
- **Goods Receipt**: "Post goods receipt for PO [NUMBER]"
- **Supplier Invoice**: "Create supplier invoice for PO [NUMBER] with amount [AMOUNT]"
- **Full Flow**: "Complete full procurement flow for material [MAT-ID]"

## Development

### Project Structure

```
frontend/
├── src/
│   ├── components/       # React components
│   ├── services/         # API integration
│   ├── theme/           # MUI theme configuration
│   ├── types/           # TypeScript types
│   ├── App.tsx          # Main application
│   └── main.tsx         # Entry point
├── public/              # Static assets
└── package.json
```

### Extending the Application

To add new test types:

1. Update `types/index.ts` with new action types
2. Add parsing logic in `services/api.ts`
3. Add example commands in `CommandInput.tsx`
4. Update step definitions in API service

## License

MIT
