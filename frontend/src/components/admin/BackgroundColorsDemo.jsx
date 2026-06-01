import React from 'react';

/**
 * Demo component showing how to use admin-configurable background colors
 * This component demonstrates all the different background utilities available
 */
const BackgroundColorsDemo = () => {
  return (
    <div className="professional-container min-h-screen p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold mb-8" style={{ color: 'var(--text-primary)' }}>
          Admin-Configurable Background Colors Demo
        </h1>
        
        {/* Professional Container Example */}
        <div className="professional-card p-6">
          <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
            Professional Card Component
          </h2>
          <p className="mb-4" style={{ color: 'var(--text-primary)' }}>
            This card uses the admin-configured secondary background color and automatically 
            switches between light and dark mode configurations.
          </p>
          
          {/* Input Example */}
          <div className="space-y-4">
            <input
              className="professional-input w-full p-3 rounded-lg"
              placeholder="This input uses admin-configured colors"
            />
            
            <select className="professional-input w-full p-3 rounded-lg">
              <option>Admin-styled select dropdown</option>
              <option>Option 2</option>
            </select>
          </div>
        </div>

        {/* Direct Utility Classes */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="admin-bg-primary p-4 rounded-lg border" style={{ borderColor: 'var(--bg-accent)' }}>
            <h3 className="font-medium mb-2" style={{ color: 'var(--text-primary)' }}>Primary Background</h3>
            <p className="text-sm" style={{ color: 'var(--text-primary)' }}>Main container color</p>
          </div>
          
          <div className="admin-bg-secondary p-4 rounded-lg border" style={{ borderColor: 'var(--bg-accent)' }}>
            <h3 className="font-medium mb-2" style={{ color: 'var(--text-primary)' }}>Secondary Background</h3>
            <p className="text-sm" style={{ color: 'var(--text-primary)' }}>Card and panel color</p>
          </div>
          
          <div className="admin-bg-tertiary p-4 rounded-lg border" style={{ borderColor: 'var(--bg-accent)' }}>
            <h3 className="font-medium mb-2" style={{ color: 'var(--text-primary)' }}>Tertiary Background</h3>
            <p className="text-sm" style={{ color: 'var(--text-primary)' }}>Accent and hover color</p>
          </div>
          
          <div className="admin-bg-accent p-4 rounded-lg border" style={{ borderColor: 'var(--bg-accent)' }}>
            <h3 className="font-medium mb-2" style={{ color: 'var(--text-primary)' }}>Accent Background</h3>
            <p className="text-sm" style={{ color: 'var(--text-primary)' }}>Border and divider color</p>
          </div>
        </div>

        {/* Modal Example */}
        <div className="professional-modal p-6 rounded-lg max-w-md mx-auto">
          <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
            Professional Modal
          </h3>
          <p className="mb-4" style={{ color: 'var(--text-primary)' }}>
            This modal uses the admin-configured background colors for a consistent look.
          </p>
          <div className="flex space-x-3">
            <button 
              className="px-4 py-2 rounded-lg"
              style={{ 
                backgroundColor: 'var(--brand-primary)', 
                color: 'white' 
              }}
            >
              Primary Action
            </button>
            <button 
              className="px-4 py-2 rounded-lg border"
              style={{ 
                backgroundColor: 'var(--bg-tertiary)',
                borderColor: 'var(--bg-accent)',
                color: 'var(--text-primary)'
              }}
            >
              Secondary
            </button>
          </div>
        </div>

        {/* Code Examples */}
        <div className="professional-card p-6">
          <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
            Usage Examples
          </h3>
          
          <div className="space-y-4">
            <div>
              <h4 className="font-medium mb-2" style={{ color: 'var(--text-primary)' }}>CSS Variables:</h4>
              <pre className="admin-bg-tertiary p-3 rounded text-sm overflow-x-auto" style={{ color: 'var(--text-primary)' }}>
                {`background-color: var(--bg-primary);
background-color: var(--bg-secondary);
background-color: var(--bg-tertiary);
background-color: var(--bg-accent);`}
              </pre>
            </div>
            
            <div>
              <h4 className="font-medium mb-2" style={{ color: 'var(--text-primary)' }}>Utility Classes:</h4>
              <pre className="admin-bg-tertiary p-3 rounded text-sm overflow-x-auto" style={{ color: 'var(--text-primary)' }}>
                {`<div className="admin-bg-primary">
<div className="admin-bg-secondary">
<div className="professional-container">
<div className="professional-card">
<input className="professional-input">`}
              </pre>
            </div>
          </div>
        </div>

        {/* Admin Info */}
        <div className="professional-card p-6 border-l-4" style={{ borderLeftColor: 'var(--brand-primary)' }}>
          <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
            🔧 For Administrators
          </h3>
          <p style={{ color: 'var(--text-primary)' }}>
            To customize these background colors, go to <strong>Admin Settings → UI Design → Theme → Background Colors</strong>. 
            Changes will apply immediately across the entire application for both light and dark modes.
          </p>
        </div>
      </div>
    </div>
  );
};

export default BackgroundColorsDemo;
