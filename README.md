# F1 Dashboard 🏎️

A comprehensive Formula 1 data visualization dashboard built with React, featuring race analysis, lap time comparisons, tire strategies, and detailed session results powered by the OpenF1 API.

![F1 Dashboard](https://img.shields.io/badge/F1-Dashboard-red?style=for-the-badge&logo=formula1)
![CI/CD](https://github.com/atombarel/f1-dashboard/actions/workflows/ci.yml/badge.svg)
![Deployment](https://img.shields.io/badge/Deployed%20on-Cloudflare%20Pages-F38020?style=for-the-badge&logo=cloudflare)
![React](https://img.shields.io/badge/React-19.1.0-61DAFB?style=for-the-badge&logo=react)
![Vite](https://img.shields.io/badge/Vite-6.3.5-646CFF?style=for-the-badge&logo=vite)
![TanStack Query](https://img.shields.io/badge/TanStack_Query-5.84.1-FF4154?style=for-the-badge)

## 🚀 Features

### 📊 Session Analysis
- **Lap Time Visualization**: Interactive charts showing lap times with sector breakdowns
- **Driver Performance Metrics**: Total laps, fastest/average/slowest times, consistency analysis
- **Long Run Analysis**: Practice session stint analysis with 4+ lap runs
- **Session Statistics**: Comprehensive session overview with fastest lap highlights

### 🏁 Race-Specific Features
- **Race Strategy Dashboard**: Visual tire strategy timeline showing compound changes throughout the race
- **Race Events Timeline**: Chronological race control messages (safety cars, flags, penalties)
- **Pit Stop Analysis**: Comprehensive pit stop statistics with fastest stop highlights
- **Session Results**: Full session classification with proper F1 sorting

### 🎯 Advanced Analytics
- **Tire Strategy Analysis**: Color-coded tire compound visualization with pit stop markers
- **Driver Comparison**: Multi-driver selection with team color coding
- **Position Tracking**: Race finishing positions with DNF indicators
- **Circuit Information**: Meeting names, locations, and session details

### 🎨 Modern UI/UX
- **Dark/Light Mode**: Theme switching with system preference detection
- **Responsive Design**: Works on all devices
- **Interactive Charts**: Powered by Recharts with custom tooltips and legends
- **Inline Styling**: Consistent theme system using inline styles with conditional dark mode

## 🛠️ Technology Stack

### Core Framework
- **React 19.1.0**: Modern React with concurrent features
- **Vite 6.3.5**: Lightning-fast build tool and dev server
- **TanStack Query 5.84.1**: Powerful data fetching and caching

### UI & Styling
- **Inline Styles**: Custom inline styling system with theme support
- **Radix UI**: Component primitives (configured but minimally used)
- **Recharts 2.15.4**: React charting library for data visualization
- **Lucide React**: Icon library
- **Tailwind CSS**: Configured but not actively used in components

### Data & API
- **Axios 1.9.0**: HTTP client for API requests
- **OpenF1 API**: Comprehensive F1 data source
- **React Query**: Server state management with caching

### Development Tools
- **ESLint**: Code linting (configured, some violations present)
- **Playwright**: Testing framework (configured, no test files implemented)
- **PostCSS & Autoprefixer**: CSS processing (configured)

## 🚦 Getting Started

### Prerequisites
- Node.js 18+ 
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd f1-dashboard
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the development server**
   ```bash
   npm run dev
   ```

4. **Open your browser**
   Navigate to `http://localhost:5173`

### Available Scripts

```bash
npm run dev      # Start development server
npm run build    # Build for production
npm run preview  # Preview production build
npm run lint     # Run ESLint
npm run deploy   # Deploy to Cloudflare Pages
```

## 📖 Usage Guide

### 1. Session Selection
1. **Choose Year**: Select from 2023-2025
2. **Select Meeting**: Pick from race weekends (excludes testing)
3. **Pick Session**: Practice 1-3, Qualifying, or Race
4. **Choose Drivers**: Multi-select drivers for comparison

### 2. Feature Overview

#### Main Dashboard
- **Lap Time Chart**: Interactive visualization with team colors
- **Driver Details Card**: Performance metrics and tire strategy
- **Session Statistics**: Overview of session data

#### Practice Sessions
- **Long Run Analysis**: Automatically appears for practice sessions
- Shows stints with 4+ consecutive laps
- Tire compound indicators with lap counts
- Driver comparison grid with best long run averages

#### Race Sessions
- **Race Strategy Dashboard**: Visual tire strategy timeline
- **Race Events Timeline**: Chronological race control messages
- **Pit Stop Analysis**: Comprehensive pit stop statistics
- **Session Results**: Full classification with circuit information

### 3. Data Features
- **Real-time Updates**: Data cached for 5 minutes with 10-minute stale time
- **Outlier Filtering**: IQR method removes invalid lap times
- **Team Colors**: Accurate F1 team color representation
- **Tire Compounds**: Color-coded tire strategy visualization

## 🏗️ Architecture

### Project Structure
```
src/
├── features/           # Feature-based modules
│   ├── dashboard/      # Year/Meeting/Session selectors
│   ├── drivers/        # Driver selection components
│   ├── laps/          # Lap time visualization
│   ├── analysis/      # Long run analysis (practice)
│   ├── race/          # Race-specific features
│   ├── results/       # Session results and standings
│   └── shared/        # Reusable components
├── constants/         # Configuration and constants
├── services/          # API layer (f1Api.js)
└── styles/           # Global styles
```

### Key Components

#### Data Layer (`src/services/f1Api.js`)
- Centralized API service with comprehensive endpoint coverage
- Statistical outlier removal using IQR method (Q1-1.5*IQR to Q3+1.5*IQR)
- Error handling with try/catch blocks
- 15-second timeout configuration

#### Feature Modules (All Functional)
- **Dashboard**: Year, meeting, and session selectors
- **Laps**: Lap time chart with Recharts, session statistics
- **Race**: Strategy dashboard, events timeline, pit stop analysis
- **Results**: Full session results with Q1/Q2/Q3 for qualifying
- **Analysis**: Long run analysis for practice sessions (4+ lap stints)

#### Shared Components
- **DarkModeToggle**: Theme switching with system detection
- **EventMultiSelect**: Multi-selection dropdown (minimally used)
- **Formatters**: Utility functions for lap time, team colors, tire colors

## 📊 Data Sources & API

### OpenF1 API Endpoints
```javascript
// Core session data
GET /meetings?year={year}           // Race weekends and circuit info
GET /sessions?meeting_key={key}     // All sessions for a meeting
GET /drivers?session_key={key}      // Participating drivers
GET /laps?session_key={key}         // Lap times and sector data
GET /stints?session_key={key}       // Tire strategy data

// Race-specific data
GET /race_control?session_key={key} // Race control messages
GET /pit?session_key={key}          // Pit stop data
GET /position?session_key={key}     // Position tracking
GET /intervals?session_key={key}    // Time gaps
GET /session_result?session_key={key} // Final results
GET /starting_grid?session_key={key}  // Grid positions
```

### Data Processing
- **Lap Time Filtering**: Removes outliers using IQR method (Q1-1.5*IQR to Q3+1.5*IQR)
- **Long Run Detection**: Filters stints with 4+ consecutive laps
- **Results Classification**: Proper F1 sorting (Finishers → Lapped → DNF)
- **Team Color Mapping**: Accurate team color representation

## 🎨 Design System

### Color Scheme
```javascript
// Theme Colors
F1_RED: '#e10600'
DARK_BACKGROUNDS: ['#0a0a0a', '#1a1a1a', '#2a2a2a']
LIGHT_BACKGROUNDS: ['#ffffff', '#f5f5f5', '#f8f8f8']

// Tire Compound Colors
SOFT: '#dc2626'      // Red
MEDIUM: '#f59e0b'    // Amber/Orange
HARD: '#6b7280'      // Gray
INTERMEDIATE: '#10b981' // Green
WET: '#3b82f6'       // Blue
```

### Component Styling
- **100% Inline Styles**: All components use inline styles exclusively
- **Theme System**: Centralized theme colors with dark/light mode support
- **No Tailwind Usage**: Despite configuration, no Tailwind classes are used
- **Team Colors**: Dynamic color application using getTeamColor() function
- **Consistent Pattern**: All styles use style prop with conditional logic

## 🔧 Configuration

### Environment Setup
- **Vite Config**: React plugin with path alias `@` for `./src`
- **ESLint**: React hooks and refresh plugins
- **Server Config**: Allows Docker container connections (`host.docker.internal`)

### Development Notes
- **React Query**: All data fetching uses React Query hooks
- **Session Detection**: Conditional rendering based on session type
- **Chart Performance**: Performance optimizations with dot={false} and isAnimationActive={false}
- **Known Issues**: Some ESLint violations (hook order, unused variables)
- **URL State**: Implemented for shareable links via URLSearchParams

## 🧪 Testing

### Testing Configuration
Playwright is configured in the project but no test files are currently implemented.

```bash
npx playwright test    # Will run tests once implemented
```

### Recommended Test Scenarios
When implementing tests, consider:
- Session navigation (Practice → Qualifying → Race)
- Driver selection and data visualization
- Dark/light mode switching
- Responsive behavior
- Race-specific feature visibility

## 🚀 Performance Optimizations

### Data Management
- **React Query Caching**: 5-minute stale time, 10-minute cache
- **Data Filtering**: Client-side outlier removal reduces chart noise
- **Lazy Loading**: Components load data only when needed

### Rendering Optimizations
- **Feature Detection**: Session-specific components only render when appropriate
- **Efficient Re-renders**: Strategic state management
- **Chart Optimization**: Limited data points for smooth rendering

## 🔍 Known Limitations & Issues

### API Constraints
- **Position Data**: OpenF1 doesn't provide complete lap-by-lap position data
- **Sprint Race Exclusion**: Race features exclude sprint races to avoid duplication
- **Data Availability**: Some sessions may have limited stint or race control data

### Technical Limitations
- **Long Run Analysis**: Requires 4+ lap stints, may be limited in short practice sessions
- **Chart Performance**: May slow with very long sessions (70+ laps)
- **Inline Styles**: Verbose styling approach makes components harder to maintain

### Code Quality Issues
- **ESLint Violations**: Hook order issues in QualifyingChart.jsx
- **Unused Variables**: Present in some race strategy components
- **No Tests**: Testing framework configured but no tests implemented
- **No Error Boundaries**: Missing comprehensive error handling

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Follow the existing code style and architecture
4. Add tests for new features
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

### Development Guidelines
- Follow existing feature-based architecture
- Use React Query for all API calls (no direct axios)
- Maintain inline styling pattern (all styles via style prop)
- Use theme constants from THEME_COLORS
- Fix ESLint violations before committing
- Test manually across different session types (no automated tests yet)

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **[OpenF1 API](https://openf1.org/)**: Comprehensive F1 data source
- **Formula 1**: The incredible sport that makes this possible
- **React Community**: Amazing tools and ecosystem
- **TanStack Query**: Powerful data fetching solution
- **Tailwind CSS**: Utility-first CSS framework

## 📞 Support

If you encounter any issues or have questions:
1. Check the [Issues](../../issues) page
2. Review the CLAUDE.md file for development guidance
3. Create a new issue with detailed information
4. Include session data and browser information for bugs

---

**Built with ❤️ for Formula 1 fans and data enthusiasts**

*Experience the thrill of F1 data like never before - from practice long runs to race day strategies, dive deep into the world of Formula 1 analytics.*