# F1 Dashboard 🏎️

A comprehensive Formula 1 data visualization dashboard built with React, featuring real-time race analysis, lap time comparisons, tire strategies, and detailed session results powered by the OpenF1 API.

![F1 Dashboard](https://img.shields.io/badge/F1-Dashboard-red?style=for-the-badge&logo=formula1)
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
- **Dark/Light Mode**: Seamless theme switching with system preference detection
- **Responsive Design**: Mobile-first design that works on all devices
- **Interactive Charts**: Powered by Recharts with custom tooltips and legends
- **Feature-Based Architecture**: Clean, maintainable component structure

## 🛠️ Technology Stack

### Core Framework
- **React 19.1.0**: Modern React with concurrent features
- **Vite 6.3.5**: Lightning-fast build tool and dev server
- **TanStack Query 5.84.1**: Powerful data fetching and caching

### UI & Styling
- **Tailwind CSS 4.1.8**: Utility-first CSS framework
- **Radix UI**: Accessible component primitives
- **Recharts 2.15.4**: React charting library
- **Lucide React**: Beautiful icon library
- **Framer Motion**: Smooth animations

### Data & API
- **Axios 1.9.0**: HTTP client for API requests
- **OpenF1 API**: Comprehensive F1 data source
- **React Query**: Server state management with caching

### Development Tools
- **ESLint**: Code linting and formatting
- **Playwright**: End-to-end testing
- **PostCSS & Autoprefixer**: CSS processing

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
- Centralized API service with data filtering
- Outlier lap time removal using IQR method
- Comprehensive endpoint coverage for all F1 data

#### Feature Modules
- **Dashboard**: Session and driver selection
- **Laps**: Lap time visualization and statistics
- **Race**: Race-specific analysis components
- **Results**: Session classification and circuit info
- **Analysis**: Practice session long run analysis

#### Shared Components
- **DarkModeToggle**: Theme switching with system detection
- **EventMultiSelect**: Multi-selection dropdown
- **Formatters**: Utility functions for data formatting

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
- **Inline Styles**: Conditional dark mode support
- **No CSS Modules**: Pure inline styling approach
- **Responsive Design**: Mobile-first with breakpoint considerations
- **Team Colors**: Dynamic color application based on driver teams

## 🔧 Configuration

### Environment Setup
- **Vite Config**: React plugin with path alias `@` for `./src`
- **ESLint**: React hooks and refresh plugins
- **Server Config**: Allows Docker container connections (`host.docker.internal`)

### Development Notes
- **React Query**: Heavy usage for data fetching - avoid direct axios calls
- **Session Detection**: Uses DOM queries for timing-sensitive operations
- **Chart Performance**: May degrade with 70+ lap sessions
- **Error Handling**: Graceful fallbacks for missing data

## 🧪 Testing

### Playwright Testing
```bash
npx playwright test    # Run end-to-end tests
```

### Testing Scenarios
- Session navigation (Practice → Qualifying → Race)
- Driver selection and data visualization
- Dark/light mode switching
- Responsive behavior testing
- Race-specific feature visibility

### Test Data Recommendations
- **2024 Bahrain Grand Prix**: Well-populated data for all session types
- **Practice Sessions**: Test Long Run Analysis features
- **Race Sessions**: Test Race Strategy Dashboard and Events Timeline

## 🚀 Performance Optimizations

### Data Management
- **React Query Caching**: 5-minute stale time, 10-minute cache
- **Data Filtering**: Client-side outlier removal reduces chart noise
- **Lazy Loading**: Components load data only when needed

### Rendering Optimizations
- **Feature Detection**: Session-specific components only render when appropriate
- **Efficient Re-renders**: Strategic state management
- **Chart Optimization**: Limited data points for smooth rendering

## 🔍 Known Limitations

### API Constraints
- **Position Data**: OpenF1 doesn't provide complete lap-by-lap position data
- **Sprint Race Exclusion**: Race features exclude sprint races to avoid duplication
- **Data Availability**: Some sessions may have limited stint or race control data

### Technical Limitations
- **Long Run Analysis**: Requires 4+ lap stints, limited in some practice sessions
- **Chart Performance**: May slow with very long sessions (70+ laps)
- **Session Detection**: Timing-sensitive DOM queries for feature visibility

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Follow the existing code style and architecture
4. Add tests for new features
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

### Development Guidelines
- Follow feature-based architecture
- Use React Query for all API calls
- Maintain inline styling consistency
- Add appropriate error handling
- Test across different session types

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