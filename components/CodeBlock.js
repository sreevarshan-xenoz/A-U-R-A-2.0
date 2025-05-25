import { useEffect, useRef, useState } from 'react';
import Prism from 'prismjs';
import 'prismjs/themes/prism-tomorrow.css';

// Import only the core language components that are available in Prism.js
import 'prismjs/components/prism-core';
import 'prismjs/components/prism-markup';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-java';
import 'prismjs/components/prism-c';
import 'prismjs/components/prism-cpp';
import 'prismjs/components/prism-csharp';
import 'prismjs/components/prism-php';
import 'prismjs/components/prism-ruby';
import 'prismjs/components/prism-go';
import 'prismjs/components/prism-rust';
import 'prismjs/components/prism-swift';
import 'prismjs/components/prism-kotlin';
import 'prismjs/components/prism-scala';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-yaml';
import 'prismjs/components/prism-markdown';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-sql';

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
  'html': 'markup', // HTML is part of the markup component
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
  'xml': 'markup', // XML is also part of the markup component
  'svg': 'markup', // SVG is also part of the markup component
};

export default function CodeBlock({ language, code }) {
  const codeRef = useRef(null);
  const [copied, setCopied] = useState(false);
  
  // Normalize language name
  const normalizedLanguage = languageMap[language?.toLowerCase()] || language?.toLowerCase() || 'plaintext';
  
  useEffect(() => {
    if (codeRef.current) {
      Prism.highlightElement(codeRef.current);
    }
  }, [code, language]);
  
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