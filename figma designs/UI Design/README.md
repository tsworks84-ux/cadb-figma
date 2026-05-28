# School ERP/LMS Admin Dashboard

A modern, professional School ERP/LMS administration system with a formal Ivy League-inspired design.

## Features

- **Student Performance Metrics**: Track attendance, test performance, and assignment submissions
- **Faculty & Staff Analytics**: Monitor employee workload, quality scores, and workforce metrics
- **Parent Relations & Support**: Manage service requests and stakeholder engagement
- **Responsive Design**: Works seamlessly on desktop, tablet, and mobile devices
- **Modern UI**: Clean, professional interface inspired by prestigious educational institutions

## Tech Stack

- **React 18** with TypeScript
- **Tailwind CSS v4** for styling
- **Vite** for build tooling
- **Lucide React** for icons
- **Radix UI** components for accessibility

## Getting Started

### Prerequisites

- Node.js 18+ or pnpm

### Installation

1. Clone the repository:
```bash
git clone https://github.com/tsworks84-ux/cadb-figma.git
cd cadb-figma
```

2. Install dependencies:
```bash
pnpm install
```

3. Start development server:
```bash
pnpm run dev
```

4. Open your browser to the URL shown in terminal (usually http://localhost:5173)

## Project Structure

```
src/
├── app/
│   ├── App.tsx                 # Main application component
│   └── components/
│       ├── AdminDashboard.tsx  # Main dashboard layout
│       ├── MetricCard.tsx      # Reusable metric card component
│       ├── MetricSection.tsx   # Section wrapper for metrics
│       └── ...                 # Other components
├── styles/
│   ├── index.css              # Main styles entry
│   ├── theme.css              # Theme tokens
│   └── tailwind.css           # Tailwind configuration
└── imports/                    # Static assets
```

## Navigation Structure

### My Dashboard
- Home
- Notice Board
- My Team
- My To-Do
- Leaves
- Holidays
- Claims
- Policies
- Training
- Directory
- Settings

### Management
- Employees
- Administration
- Academics
- MIS Reports

## Customization

The system is designed to be easily extensible:

1. **Add new metrics**: Edit `src/app/components/AdminDashboard.tsx` and add to the metric arrays
2. **Add new sections**: Create a new `MetricSection` with your custom metrics
3. **Modify colors**: Update the Tailwind theme in `src/styles/theme.css`

## Development with Claude Code

This project works great with Claude Code:

1. Install [Claude Code](https://claude.ai/code) desktop app or VS Code extension
2. Open this project folder
3. Ask Claude to help extend functionality, add features, or fix issues

## License

Private - All rights reserved
