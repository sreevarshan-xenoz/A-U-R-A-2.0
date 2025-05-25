import { useEffect, useRef, useState } from 'react';
import Prism from 'prismjs';
import 'prismjs/themes/prism-tomorrow.css';

// Import only the core component
import 'prismjs/components/prism-core';

// Map of language aliases to Prism language names
const languageMap = {
  'js': 'javascript',
  'ts': 'typescript',
  'py': 'python',
  'rb': 'ruby',
  'sh': 'bash',
  'shell': 'bash',
  'yml': 'yaml',
  'md': 'markdown',
  'html': 'markup',
  'css': 'css',
  'sql': 'sql',
  'c++': 'cpp',
  'c#': 'csharp',
  'go': 'go',
  'rs': 'rust',
  'kt': 'kotlin',
  'scala': 'scala',
  'swift': 'swift',
  'java': 'java',
  'c': 'c',
  'php': 'php',
  'json': 'json',
  'yaml': 'yaml',
  'markdown': 'markdown',
  'xml': 'markup',
  'svg': 'markup',
};

// Dynamically load language components as needed
const loadLanguage = (language) => {
  try {
    // Only load the language if it's not already loaded
    if (!Prism.languages[language]) {
      // Use dynamic import to load the language component
      import(`prismjs/components/prism-${language}`).catch(err => {
        console.warn(`Failed to load language: ${language}`, err);
      });
    }
  } catch (error) {
    console.warn(`Error loading language: ${language}`, error);
  }
};

export default function CodeBlock({ language, code }) {
  const codeRef = useRef(null);
  const [copied, setCopied] = useState(false);
  
  // Normalize language name
  const normalizedLanguage = languageMap[language?.toLowerCase()] || language?.toLowerCase() || 'plaintext';
  
  useEffect(() => {
    // Load the language component if needed
    if (normalizedLanguage !== 'plaintext') {
      loadLanguage(normalizedLanguage);
    }
    
    // Use setTimeout to ensure the language is loaded before highlighting
    const timer = setTimeout(() => {
      if (codeRef.current) {
        Prism.highlightElement(codeRef.current);
      }
    }, 0);
    
    return () => clearTimeout(timer);
  }, [code, normalizedLanguage]);
  
  const handleCopy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  
  return (
    <div className="code-block">
      {language && <div className="code-language">{language}</div>}
      <button 
        className={`code-copy-button ${copied ? 'copied' : ''}`}
        onClick={handleCopy}
        aria-label="Copy code"
      >
        {copied ? 'Copied!' : 'Copy'}
      </button>
      <pre className="code-container">
        <code ref={codeRef} className={`language-${normalizedLanguage}`}>
          {code}
        </code>
      </pre>
    </div>
  );
} 