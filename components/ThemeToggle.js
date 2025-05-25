import { useState, useEffect } from 'react';

const ThemeToggle = () => {
  const [theme, setTheme] = useState('default');
  const [showThemeMenu, setShowThemeMenu] = useState(false);

  const themes = [
    { id: 'default', name: 'Default', primary: '#00ffff', secondary: '#ff00ff' },
    { id: 'ocean', name: 'Ocean', primary: '#00bfff', secondary: '#1e90ff' },
    { id: 'sunset', name: 'Sunset', primary: '#ff7f50', secondary: '#ff4500' },
    { id: 'forest', name: 'Forest', primary: '#32cd32', secondary: '#228b22' },
    { id: 'lavender', name: 'Lavender', primary: '#9370db', secondary: '#8a2be2' },
    { id: 'midnight', name: 'Midnight', primary: '#4b0082', secondary: '#9400d3' }
  ];

  useEffect(() => {
    // Load saved theme from localStorage
    const savedTheme = localStorage.getItem('aura-theme');
    if (savedTheme) {
      applyTheme(savedTheme);
    }
  }, []);

  const applyTheme = (themeId) => {
    const selectedTheme = themes.find(t => t.id === themeId) || themes[0];
    
    // Update CSS variables
    document.documentElement.style.setProperty('--primary-color', selectedTheme.primary);
    document.documentElement.style.setProperty('--secondary-color', selectedTheme.secondary);
    
    // Save to localStorage
    localStorage.setItem('aura-theme', themeId);
    setTheme(themeId);
  };

  const toggleThemeMenu = () => {
    setShowThemeMenu(!showThemeMenu);
  };

  const handleThemeSelect = (themeId) => {
    applyTheme(themeId);
    setShowThemeMenu(false);
  };

  return (
    <div className="theme-toggle-container">
      <button 
        className="theme-toggle-button" 
        onClick={toggleThemeMenu}
        title="Change theme"
      >
        🎨
      </button>
      
      {showThemeMenu && (
        <div className="theme-menu">
          <div className="theme-menu-header">
            <h3>Select Theme</h3>
            <button 
              className="close-theme-menu" 
              onClick={toggleThemeMenu}
              title="Close theme menu"
            >
              ✕
            </button>
          </div>
          <div className="theme-options">
            {themes.map((themeOption) => (
              <div 
                key={themeOption.id}
                className={`theme-option ${theme === themeOption.id ? 'active' : ''}`}
                onClick={() => handleThemeSelect(themeOption.id)}
              >
                <div className="theme-preview">
                  <div 
                    className="theme-color primary" 
                    style={{ backgroundColor: themeOption.primary }}
                  ></div>
                  <div 
                    className="theme-color secondary" 
                    style={{ backgroundColor: themeOption.secondary }}
                  ></div>
                </div>
                <span className="theme-name">{themeOption.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ThemeToggle; 