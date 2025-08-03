# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development
- `npm run dev` - Start development server on http://localhost:5173
- `npm run build` - Build production bundle
- `npm run preview` - Preview production build locally
- `npm run lint` - Run ESLint on all JS/JSX files

### Testing
- `npx playwright test` - Run Playwright tests (if test files exist)

## Architecture Overview

### Core Application Structure
The F1 dashboard is a single-page React application that visualizes Formula 1 race data. The main entry point is `src/App.jsx` which:
- Uses React Query (TanStack Query) for data fetching and caching
- Implements dark mode with inline styles (no CSS modules or Tailwind classes)
- Displays lap time charts using Recharts library
- Shows driver details with performance metrics and tire strategies
- Includes Long Run Analysis for practice sessions (4+ lap stints only)

### Data Flow
1. **API Layer** (`src/services/f1Api.js`):
   - Fetches data from OpenF1 API (https://api.openf1.org/v1)
   - Handles meetings, sessions, drivers, laps, and stints data
   - Race-specific endpoints: race control messages, pit stops, positions, intervals
   - Filters outlier lap times using IQR method (Q1-1.5*IQR to Q3+1.5*IQR)
   - Provides helper functions: `formatLapTime()`, `getTeamColor()`, `getTireColor()`

2. **State Management**:
   - Local component state for UI selections (year, meeting, session, drivers, dark mode)
   - React Query for server state with 5-minute stale time and 10-minute cache
   - No global state management library

3. **Component Architecture**:
   - Main dashboard in `src/App.jsx` (monolithic component, ~800 lines)
   - Additional unused components in `src/components/` (from previous iterations)
   - ShadCN UI components in `src/components/ui/` (installed but not actively used)

### Key Features

#### Main Dashboard
- Year selector (2023-2025)
- Race weekend selector (filters out testing sessions)
- Session selector (Practice 1-3, Qualifying, Race)
- Multi-driver selection with team colors
- Lap time chart with Recharts
- Session statistics (total laps, drivers, fastest lap)

#### Driver Details Card
Shows for selected drivers:
- Performance metrics (total laps, fastest/average/slowest lap times)
- Consistency analysis (standard deviation)
- Pit stop count from stint data
- Tire strategy visualization with compound colors
- Best sector times (S1, S2, S3) when available

#### Long Run Analysis (Practice Sessions Only)
Automatically appears in practice sessions, showing only stints with 4+ laps:
- Per-driver stint breakdowns with average/best/worst times
- Tire compound indicators with improved contrast
- Lap counts (excluding out laps)
- Best stint comparison across drivers
- Driver comparison grid showing best long run averages

#### Race Events Timeline (Race Sessions Only)
Displays chronological race control messages:
- Safety car deployments and virtual safety car periods
- Flag conditions (yellow, red, checkered)
- Driver penalties and time penalties
- DRS enabled/disabled notifications
- Car incidents and retirements
- Grouped by lap number with icon indicators

#### Pit Stop Analysis (Race Sessions Only)
Comprehensive pit stop statistics:
- Fastest pit stop highlight with driver and time
- Per-driver pit stop breakdown showing all stops
- Average pit stop time per driver
- Individual stop times by lap number
- Total stop count per driver
- Team color coding for easy identification

#### Dark Mode
- Toggle switch in header (sun/moon icons)
- All components styled for both light and dark themes
- Smooth transitions between modes
- Improved contrast for chart elements and tooltips

### Technical Implementation Details

#### Styling Approach
- Pure inline styles with conditional dark mode support
- No CSS modules or external stylesheets
- Color scheme:
  - F1 Red: #e10600
  - Dark mode background: #0a0a0a, #1a1a1a, #2a2a2a
  - Light mode: white, #f5f5f5, #f8f8f8

#### Tire Compound Colors
- SOFT: #dc2626 (red)
- MEDIUM: #f59e0b (amber/orange) 
- HARD: #6b7280 (gray)
- INTERMEDIATE: #10b981 (green)
- WET: #3b82f6 (blue)

#### Data Processing
- Lap time filtering: Removes pit stops and safety car laps using IQR method
- Long run detection: Filters to show only stints with 4+ consecutive laps
- Stint analysis: Skips out laps when calculating averages
- Driver identification: Uses driver_number as primary key

### API Endpoints Used
- `/meetings?year={year}` - Get race weekends for a year
- `/sessions?meeting_key={key}` - Get all sessions for a meeting
- `/drivers?session_key={key}` - Get drivers who participated in session
- `/laps?session_key={key}` - Get all lap times for a session
- `/stints?session_key={key}` - Get tire stint data for strategy analysis
- `/race_control?session_key={key}` - Get race control messages (flags, safety cars, penalties)
- `/pit?session_key={key}` - Get pit stop data with durations and lap numbers
- `/position?session_key={key}` - Get position data throughout the race
- `/intervals?session_key={key}` - Get time gaps between drivers

### Development Notes
- Vite configured with React plugin and path alias `@` for `./src`
- ESLint configured with React hooks and refresh plugins
- Server allows connections from Docker containers (`host.docker.internal`)
- Heavy use of React Query for data fetching - avoid direct axios calls
- Session detection for Long Run Analysis uses DOM query of select element (workaround for timing issues)
- Chart tooltips require custom styling for dark mode support

### Known Limitations
- Long Run Analysis only shows in practice sessions
- Requires 4+ lap stints to be considered a "long run"
- Some practice sessions have limited stint data
- Chart performance may degrade with very long sessions (70+ laps)
- Race Events Timeline and Pit Stop Analysis only appear for race sessions
- Race control messages depend on data availability from OpenF1 API
- Sprint races are excluded from race session features to avoid duplicate data