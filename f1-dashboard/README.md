# F1 Data Dashboard 🏎️

A modern, interactive Formula 1 data visualization dashboard built with React and powered by the OpenF1 API.

![F1 Dashboard](https://img.shields.io/badge/F1-Dashboard-red?style=for-the-badge&logo=formula1)
![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)

## 🚀 Features

### 📊 Real-time Data Visualization
- **Car Telemetry**: Speed, throttle, brake, and RPM data visualization
- **Lap Times Analysis**: Detailed lap-by-lap performance with sector times
- **Position Tracking**: Real-time driver position changes throughout sessions
- **Interactive Charts**: Powered by Recharts with custom tooltips and legends

### 🎮 Interactive Controls
- **Year Selection**: Choose from available F1 seasons (2023-2024)
- **Race Selection**: Browse all Grand Prix events
- **Session Selection**: Practice, Qualifying, Sprint, and Race sessions
- **Driver Selection**: Individual driver analysis or all drivers view

### 🎨 Modern UI/UX
- **Glass Morphism Design**: Beautiful translucent components
- **F1-themed Color Scheme**: Official F1 red gradient and team colors
- **Responsive Layout**: Works perfectly on desktop, tablet, and mobile
- **Dark Theme**: Easy on the eyes for extended analysis sessions

## 🛠️ Technology Stack

- **Frontend**: React 18 with Vite
- **Styling**: Tailwind CSS with custom F1 theme
- **Charts**: Recharts for data visualization
- **HTTP Client**: Axios for API communication
- **Icons**: Lucide React
- **Data Source**: OpenF1 API

## 🚦 Getting Started

### Prerequisites
- Node.js 16+ 
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

## 📖 Usage Guide

### 1. Select Data Source
1. **Choose a Year**: Select 2023 or 2024
2. **Pick a Race**: Choose from available Grand Prix events
3. **Select Session**: Pick Practice, Qualifying, Sprint, or Race
4. **Choose Driver**: Select a specific driver or view all drivers

### 2. Explore Data
- **Telemetry Tab**: View real-time car data including speed, throttle, brake, and RPM
- **Lap Times Tab**: Analyze lap performance with sector breakdowns and statistics
- **Positions Tab**: Track driver positions and race progression

### 3. Interactive Features
- **Toggle Metrics**: Show/hide different telemetry parameters
- **Hover for Details**: Rich tooltips with comprehensive data
- **Responsive Charts**: Zoom and pan on supported chart types

## 📊 Data Sources

This dashboard uses the [OpenF1 API](https://openf1.org/), which provides:

- **Car Data**: Telemetry at ~3.7Hz including speed, throttle, brake, RPM, gear, DRS
- **Lap Data**: Detailed lap times with sector splits and speed traps
- **Position Data**: Real-time driver positions throughout sessions
- **Driver Information**: Names, teams, and driver numbers
- **Session Data**: Meeting and session metadata

## 🎯 Key Features Breakdown

### Telemetry Visualization
- Real-time car data charting
- Toggleable metrics (speed, throttle, brake, RPM)
- Custom tooltips with gear and DRS information
- Team color coding

### Lap Time Analysis
- Best lap highlighting
- Average lap time calculations
- Sector time breakdowns
- Pit out lap identification
- Speed trap data

### Position Tracking
- Live position changes over time
- Current standings grid
- Team color-coded visualization
- Position change trajectories

## 🎨 Design Features

- **Glass Morphism**: Translucent backgrounds with backdrop blur
- **F1 Color Scheme**: Official Formula 1 red gradient
- **Team Colors**: Accurate team color representation
- **Responsive Grid**: Adaptive layouts for all screen sizes
- **Loading States**: Elegant loading animations
- **Error Handling**: Graceful error states with helpful messages

## 🔧 Configuration

### Team Colors
Team colors are defined in the API service and can be customized:

```javascript
const teamColors = {
  'Red Bull Racing': '#0600EF',
  'Mercedes': '#00D2BE',
  'Ferrari': '#DC143C',
  'McLaren': '#FF8700',
  // ... more teams
};
```

### Chart Customization
Charts can be customized in each component:
- Colors and themes
- Data point limits for performance
- Tooltip content and formatting
- Axis configurations

## 📱 Responsive Design

The dashboard is fully responsive with breakpoints for:
- **Mobile**: 320px+
- **Tablet**: 768px+
- **Desktop**: 1024px+
- **Large Desktop**: 1440px+

## 🚀 Performance Optimizations

- **Data Limiting**: Restricts data points for smooth rendering
- **Lazy Loading**: Components load data only when needed
- **Memoization**: React.memo and useCallback for performance
- **Efficient Re-renders**: Strategic state management

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **OpenF1 API**: For providing free, comprehensive F1 data
- **Formula 1**: For the incredible sport that makes this possible
- **React Community**: For amazing tools and libraries
- **Tailwind CSS**: For the utility-first CSS framework

## 📞 Support

If you encounter any issues or have questions:
1. Check the [Issues](../../issues) page
2. Create a new issue with detailed information
3. Join our community discussions

---

**Built with ❤️ for Formula 1 fans and data enthusiasts**
