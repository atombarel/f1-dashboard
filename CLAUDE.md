# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development
- `npm run dev` - Start development server on http://localhost:5173
- `npm run build` - Build production bundle
- `npm run preview` - Preview production build locally
- `npm run lint` - Run ESLint on all JS/JSX files (Note: Some violations exist that need fixing)

### Testing
- `npx playwright test` - Playwright is configured but no test files are implemented yet

## Development Workflow

### Local Development Server
**IMPORTANT**: Always keep the development server running when making changes to the codebase:
```bash
npm run dev
```
The server runs on http://localhost:5173 and provides:
- Hot module replacement for instant code updates
- Real-time error feedback
- Automatic browser refresh on file changes

### Testing with Playwright
When testing UI changes or functionality:
1. Ensure the dev server is running on http://localhost:5173
2. Use Playwright MCP tools to interact with the live application
3. Navigate through different sessions (Practice, Qualifying, Race) to test session-specific features
4. Test both light and dark modes using the theme toggle
5. Verify responsive behavior and component interactions

**Common test scenarios:**
- Select 2024 → Bahrain Grand Prix → Race to test race-specific features
- Select 2024 → Bahrain Grand Prix → Practice 1 to test practice-specific features  
- Test Race Strategy Dashboard only appears for race sessions
- Verify Long Run Analysis only appears for practice sessions
- Test driver selection and chart interactions

## Architecture Overview

### Core Application Structure
The F1 dashboard is a React application that visualizes Formula 1 race data. The application uses:
- **Feature-based architecture**: Clean separation of features into modules
- **React Query (TanStack Query)**: All data fetching with 5-minute stale time and 10-minute cache
- **100% Inline Styles**: No CSS modules or Tailwind usage, all styling via style prop
- **Recharts library**: Interactive lap time visualization with performance optimizations
- **Centralized theme system**: THEME_COLORS constants for dark/light mode support

### Data Flow
1. **API Layer** (`src/services/f1Api.js`):
   - Fetches data from OpenF1 API (https://api.openf1.org/v1)
   - Handles meetings, sessions, drivers, laps, and stints data
   - Race-specific endpoints: race control messages, pit stops, positions, intervals, session results
   - Filters outlier lap times using IQR method (Q1-1.5*IQR to Q3+1.5*IQR)
   - Utility functions moved to `src/shared/utils/formatters.js`

2. **State Management**:
   - Local component state for UI selections (year, meeting, session, drivers, dark mode)
   - React Query for server state with 5-minute stale time and 10-minute cache
   - Custom hooks for data fetching in feature modules
   - URL state synchronization for shareable links using URLSearchParams

3. **Component Architecture** (Feature-Based):
   ```
   src/
   ├── features/           # Feature modules
   │   ├── dashboard/      # Year/Meeting/Session selectors
   │   │   ├── components/ # YearSelector, MeetingSelector, SessionSelector
   │   │   └── hooks/      # useMeetings, useSessions, useDrivers
   │   ├── drivers/        # Driver selection components
   │   │   └── components/ # DriverSelector
   │   ├── laps/           # Lap time visualization
   │   │   ├── components/ # LapTimeChart, SessionStats
   │   │   └── hooks/      # useLaps, useStints
   │   ├── analysis/       # Long run analysis for practice sessions
   │   │   └── components/ # LongRunAnalysis
   │   ├── race/           # Race-specific features
   │   │   ├── components/ # RaceEventsTimeline, PitStopAnalysis, RaceStrategyAnalysis, RaceStrategyDashboard
   │   │   └── hooks/      # useRaceControl, usePitStops, usePositions
   │   ├── results/        # Session results and standings
   │   │   ├── components/ # SessionResults
   │   │   └── hooks/      # useSessionResults, useStartingGrid
   │   └── shared/         # Reusable components and utilities
   │       ├── components/ # DarkModeToggle, EventMultiSelect
   │       └── utils/      # formatters (formatLapTime, getTeamColor, getTireColor)
   ├── constants/          # Configuration and constants
   │   ├── colors.js       # Theme colors, tire colors, team colors
   │   └── config.js       # API config, chart config, event types
   └── styles/             # Global styles
       └── index.css       # Base styles and animations
   ```

### Key Features

#### Main Dashboard
- Year selector (2023-2025)
- Race weekend selector (filters out testing sessions)
- Session selector (Practice 1-3, Qualifying, Race)
- Multi-driver selection with team colors
- Lap time chart with Recharts
- Session statistics (total laps, drivers, fastest lap)

#### Session Results (Half-Width Layout)
Comprehensive session results display with circuit information:
- **Results Table**: Half-width scrollable table showing:
  - Position, driver (with team colors), lap times/gaps
  - Proper F1 classification order: Finishers → Lapped drivers → DNF drivers
  - Qualifying breakdown (Q1/Q2/Q3 times) for qualifying sessions
  - Race gaps and starting grid information for race sessions
  - Scrollable container with sticky header for space efficiency
- **Circuit Information Card**: Half-width card displaying:
  - Meeting name and official race title
  - Circuit name and location (city, country)
  - Session date and time in UTC
  - Data sourced from OpenF1 meetings endpoint

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

#### Race Strategy Dashboard (Race Sessions Only)
Visual tire strategy timeline showing race finishing order and pit strategies:
- Driver finishing positions with team colors
- Visual tire strategy timeline showing compound changes throughout the race
- Pit stop counts and lap markers
- DNF indicators for drivers who didn't finish
- Checkered flag indicators for race finishers
- Tire compound legend with color coding

#### Race Events Timeline (Race Sessions Only)
Displays chronological race control messages:
- Safety car deployments and virtual safety car periods
- Flag conditions (yellow, red, checkered)
- Driver penalties and time penalties
- DRS enabled/disabled notifications
- Car incidents and retirements
- Track limits violations and lap time deletions
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

#### Styling Approach (100% Inline Styles)
- **All components use inline styles exclusively** via the style prop
- **No Tailwind classes used** despite configuration present
- **Theme constants** from THEME_COLORS for consistency
- **Conditional dark mode** logic in every component
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
- Results classification: Proper F1 sorting with finishers, lapped drivers, and DNF drivers
- Circuit data integration: Meetings data provides circuit names, locations, and official titles

### API Endpoints Used
- `/meetings?year={year}` - Get race weekends and circuit information for a year
- `/sessions?meeting_key={key}` - Get all sessions for a meeting
- `/drivers?session_key={key}` - Get drivers who participated in session
- `/laps?session_key={key}` - Get all lap times for a session
- `/stints?session_key={key}` - Get tire stint data for strategy analysis
- `/race_control?session_key={key}` - Get race control messages (flags, safety cars, penalties)
- `/pit?session_key={key}` - Get pit stop data with durations and lap numbers
- `/position?session_key={key}` - Get position data throughout the race
- `/intervals?session_key={key}` - Get time gaps between drivers
- `/session_result?session_key={key}` - Get final session results and classifications
- `/starting_grid?session_key={key}` - Get starting grid positions for races

### Development Notes
- Vite configured with React plugin and path alias `@` for `./src` (not used in imports)
- ESLint configured but has violations that need fixing (hook order, unused variables)
- Server allows connections from Docker containers (`host.docker.internal`)
- All data fetching uses React Query - no direct axios calls
- Session detection uses conditional rendering based on session type
- Chart performance optimized with `dot={false}` and `isAnimationActive={false}`
- Results classification uses proper F1 sorting logic with type checking
- Circuit information requires meetings data to be passed as props to SessionResults
- Race-specific components include session filtering to only appear for race sessions (not sprint races)
- **No test files implemented** despite Playwright configuration
- **All styling must use inline styles** - maintain consistency with existing pattern

### Known Limitations & Issues

#### Feature Limitations
- Long Run Analysis only shows in practice sessions (requires 4+ lap stints)
- Some practice sessions have limited stint data
- Chart performance may degrade with very long sessions (70+ laps)
- Race Events Timeline and Pit Stop Analysis only appear for race sessions
- Sprint races are excluded from race session features to avoid duplicate data
- **Position tracking**: OpenF1 API does not provide complete lap-by-lap position data

#### Code Quality Issues
- **ESLint violations present**:
  - Hook order violation in `QualifyingChart.jsx`
  - Unused variables in race strategy components
  - Unnecessary dependencies in `LongRunAnalysis.jsx`
- **No test files implemented** despite Playwright configuration
- **No error boundaries** for comprehensive error handling
- **Verbose inline styling** makes components harder to maintain

#### API Dependencies
- Race control messages depend on data availability from OpenF1 API
- Circuit information depends on meetings data availability
- Results classification relies on duration and gap_to_leader fields from OpenF1 API

## Important Development Guidelines

### Code Style Rules
- **ALWAYS use inline styles** - No CSS modules, no Tailwind classes
- **Use theme constants** from THEME_COLORS for all colors
- **Follow existing patterns** - Check similar components before implementing
- **Use React Query** for all data fetching - no direct axios calls
- **Fix ESLint violations** before committing code

### Common Pitfalls to Avoid
- Don't use Tailwind classes (despite configuration present)
- Don't create CSS files or use CSS modules
- Don't use direct axios calls - always use React Query hooks
- Don't forget to handle dark mode in inline styles
- Don't violate React hooks rules (order matters!)

### Before Making Changes
1. Run `npm run lint` and note existing violations
2. Test manually across different session types
3. Verify dark/light mode works correctly
4. Ensure inline styles follow existing patterns
5. Check that React Query is used for all API calls