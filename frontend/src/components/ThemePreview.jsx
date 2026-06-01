import React from 'react';
import { useTheme } from '../contexts/ThemeContext';

const ThemePreview = () => {
  const { isDarkMode, toggleTheme } = useTheme();

  return (
    <div className="p-6 space-y-8">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-heading mb-2">
          Fintech Brand Theme Preview
        </h1>
        <p className="text-secondary mb-4">
          Modern, accessible design system with {isDarkMode ? 'dark' : 'light'} mode
        </p>
        <button
          onClick={toggleTheme}
          className="btn btn-primary"
        >
          Switch to {isDarkMode ? 'Light' : 'Dark'} Mode
        </button>
      </div>

      {/* Color Palette */}
      <div className="card">
        <h2 className="text-xl font-bold text-heading mb-4">Brand Colors</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="w-20 h-20 bg-brand-primary rounded-xl mx-auto mb-2 shadow-brand"></div>
            <p className="text-sm font-medium text-heading">Primary</p>
            <p className="text-xs text-muted">#6750A4</p>
          </div>
          <div className="text-center">
            <div className="w-20 h-20 bg-brand-success rounded-xl mx-auto mb-2 shadow-brand"></div>
            <p className="text-sm font-medium text-heading">Success</p>
            <p className="text-xs text-muted">#10B981</p>
          </div>
          <div className="text-center">
            <div className="w-20 h-20 bg-brand-accent rounded-xl mx-auto mb-2 shadow-brand"></div>
            <p className="text-sm font-medium text-heading">Accent</p>
            <p className="text-xs text-muted">#0ECB81</p>
          </div>
          <div className="text-center">
            <div className="w-20 h-20 bg-brand-dark rounded-xl mx-auto mb-2 shadow-brand"></div>
            <p className="text-sm font-medium text-heading">Dark</p>
            <p className="text-xs text-muted">#1E2029</p>
          </div>
        </div>
      </div>

      {/* Buttons */}
      <div className="card">
        <h2 className="text-xl font-bold text-heading mb-4">Button Styles</h2>
        <div className="flex flex-wrap gap-4">
          <button className="btn btn-primary">Primary Button</button>
          <button className="btn btn-secondary">Secondary Button</button>
          <button className="btn btn-success">Success Button</button>
          <button className="btn btn-ghost">Ghost Button</button>
          <button className="btn btn-primary btn-sm">Small Button</button>
          <button className="btn btn-primary btn-lg">Large Button</button>
        </div>
      </div>

      {/* Form Elements */}
      <div className="card">
        <h2 className="text-xl font-bold text-heading mb-4">Form Elements</h2>
        <div className="space-y-4 max-w-md">
          <div>
            <label className="block text-sm font-medium text-heading mb-2">
              Email Address
            </label>
            <input
              type="email"
              className="input"
              placeholder="Enter your email"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-heading mb-2">
              Password
            </label>
            <input
              type="password"
              className="input"
              placeholder="Enter your password"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-heading mb-2">
              Message
            </label>
            <textarea
              className="input"
              rows="3"
              placeholder="Enter your message"
            ></textarea>
          </div>
        </div>
      </div>

      {/* Cards */}
      <div className="card">
        <h2 className="text-xl font-bold text-heading mb-4">Card Variations</h2>
        <div className="grid md:grid-cols-3 gap-4">
          <div className="card">
            <h3 className="font-bold text-heading mb-2">Standard Card</h3>
            <p className="text-secondary mb-4">
              This is a standard card with default styling and subtle shadows.
            </p>
            <button className="btn btn-primary btn-sm">Learn More</button>
          </div>
          <div className="card card-interactive">
            <h3 className="font-bold text-heading mb-2">Interactive Card</h3>
            <p className="text-secondary mb-4">
              This card has hover effects and interactive states.
            </p>
            <button className="btn btn-secondary btn-sm">Explore</button>
          </div>
          <div className="card card-gradient">
            <h3 className="font-bold text-heading mb-2">Gradient Card</h3>
            <p className="text-secondary mb-4">
              This card features a subtle gradient background.
            </p>
            <button className="btn btn-success btn-sm">Get Started</button>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="card">
        <h2 className="text-xl font-bold text-heading mb-4">Navigation Items</h2>
        <div className="space-y-2 max-w-sm">
          <a href="#" className="nav-item">
            <span>Home</span>
          </a>
          <a href="#" className="nav-item active">
            <span>Dashboard</span>
          </a>
          <a href="#" className="nav-item">
            <span>Analytics</span>
          </a>
          <a href="#" className="nav-item">
            <span>Settings</span>
          </a>
        </div>
      </div>

      {/* Badges */}
      <div className="card">
        <h2 className="text-xl font-bold text-heading mb-4">Badges</h2>
        <div className="flex flex-wrap gap-3">
          <span className="badge badge-primary">Primary</span>
          <span className="badge badge-success">Success</span>
          <span className="badge badge-accent">Accent</span>
          <span className="badge badge-outline">Outline</span>
        </div>
      </div>

      {/* Gradients */}
      <div className="card">
        <h2 className="text-xl font-bold text-heading mb-4">Gradient Backgrounds</h2>
        <div className="grid md:grid-cols-3 gap-4">
          <div className="h-24 bg-gradient-primary rounded-xl flex items-center justify-center">
            <span className="text-white font-bold">Primary Gradient</span>
          </div>
          <div className="h-24 bg-gradient-accent rounded-xl flex items-center justify-center">
            <span className="text-brand-dark font-bold">Accent Gradient</span>
          </div>
          <div className="h-24 bg-gradient-dark rounded-xl flex items-center justify-center">
            <span className="text-white font-bold">Dark Gradient</span>
          </div>
        </div>
      </div>

      {/* Typography */}
      <div className="card">
        <h2 className="text-xl font-bold text-heading mb-4">Typography</h2>
        <div className="space-y-3">
          <h1 className="text-3xl font-bold text-heading">Heading 1</h1>
          <h2 className="text-2xl font-bold text-heading">Heading 2</h2>
          <h3 className="text-xl font-bold text-heading">Heading 3</h3>
          <p className="text-base text-secondary">
            This is regular body text with secondary color for optimal readability.
          </p>
          <p className="text-sm text-muted">
            This is smaller muted text used for captions and labels.
          </p>
          <p className="text-brand-primary font-medium">
            This is brand-colored text for links and accents.
          </p>
        </div>
      </div>

      {/* Data Display */}
      <div className="card">
        <h2 className="text-xl font-bold text-heading mb-4">Financial Data</h2>
        <div className="space-y-4">
          <div className="flex justify-between items-center p-4 bg-brand-primary/5 rounded-lg">
            <div>
              <p className="text-sm text-muted">Portfolio Value</p>
              <p className="text-2xl font-bold text-heading">$45,230.50</p>
            </div>
            <div className="text-brand-success">
              <p className="text-sm">+2.5%</p>
            </div>
          </div>
          <div className="flex justify-between items-center p-4 bg-red-500/5 rounded-lg">
            <div>
              <p className="text-sm text-muted">Daily Change</p>
              <p className="text-xl font-bold text-heading">-$125.30</p>
            </div>
            <div className="text-red-500">
              <p className="text-sm">-0.3%</p>
            </div>
          </div>
        </div>
      </div>

      {/* Feature Cards */}
      <div className="card">
        <h2 className="text-xl font-bold text-heading mb-4">Feature Showcase</h2>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="p-6 border border-brand-primary/20 rounded-xl hover:border-brand-primary/40 transition-all">
            <div className="w-12 h-12 bg-gradient-primary rounded-lg flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-heading mb-2">Lightning Fast</h3>
            <p className="text-secondary">
              Execute trades in milliseconds with our optimized trading engine.
            </p>
          </div>
          <div className="p-6 border border-brand-success/20 rounded-xl hover:border-brand-success/40 transition-all">
            <div className="w-12 h-12 bg-gradient-success rounded-lg flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-heading mb-2">Secure & Reliable</h3>
            <p className="text-secondary">
              Bank-grade security with 256-bit encryption and cold storage.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ThemePreview;
