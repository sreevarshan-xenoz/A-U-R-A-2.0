import React, { useState, useEffect, useRef } from 'react';
import { submitMessage, newChat, regenerateMessage, cancelGeneration, clearHistory } from '../lib/api';
import { initSpeechRecognition, initSpeechSynthesis, speak, stopSpeaking } from '../lib/speech';

// Component to format message content with structured elements
const MessageContent = ({ content }) => {
  // Format inline code, bold, italic, etc.  
  const formatInlineElements = (text) => {
    // Replace inline code with styled spans
    let formatted = text.replace(/`([^`]+)`/g, (match, code) => {
      return `<span class="inline-code">${code}</span>`;
    });
    
    // Format bold text with ** or __
    formatted = formatted.replace(/\*\*([^*]+)\*\*|__([^_]+)__/g, (match, bold1, bold2) => {
      const boldText = bold1 || bold2;
      return `<strong>${boldText}</strong>`;
    });
    
    // Format italic text with * or _
    formatted = formatted.replace(/\*([^*]+)\*|_([^_]+)_/g, (match, italic1, italic2) => {
      const italicText = italic1 || italic2;
      return `<em>${italicText}</em>`;
    });
    
    return <span dangerouslySetInnerHTML={{ __html: formatted }} />;
  };
  
  // Function to detect and format code blocks
  const formatCodeBlocks = (text) => {
    // Split by code block markers ```
    const parts = text.split(/```(\w*)\n/);
    if (parts.length === 1) return formatText(text); // No code blocks found
    
    const formattedParts = [];
    let language = '';
    
    for (let i = 0; i < parts.length; i++) {
      if (i % 2 === 0) {
        // Regular text
        if (parts[i].trim()) {
          formattedParts.push(
            <span key={`text-${i}`} className="regular-text">
              {formatText(parts[i])}
            </span>
          );
        }
      } else {
        // Language identifier
        language = parts[i];
      }
      
      // Code block content (comes after language identifier)
      if (i % 2 === 0 && i > 0) {
        formattedParts.push(
          <div key={`code-${i}`} className={`code-block ${language}`}>
            <div className="code-header">
              <span className="code-language">{language || 'code'}</span>
            </div>
            <pre>
              <code>{parts[i].replace(/```$/m, '')}</code>
            </pre>
          </div>
        );
      }
    }
    
    return formattedParts;
  };
  
  // Function to format tables
  const formatTables = (text) => {
    const lines = text.split('\n');
    const formattedLines = [];
    let inTable = false;
    let tableRows = [];
    let tableHeaders = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Check for table row (contains | character)
      if (line.includes('|')) {
        // Check if this is a header separator row
        const isHeaderSeparator = line.replace(/\|/g, '').trim().replace(/\s/g, '').replace(/-/g, '').replace(/:/g, '') === '';
        
        if (isHeaderSeparator) {
          // Skip the separator row
          continue;
        }
        
        // Start a new table if not already in one
        if (!inTable) {
          inTable = true;
          tableRows = [];
          tableHeaders = [];
          
          // Check if the next line is a header separator
          const nextLine = i + 1 < lines.length ? lines[i + 1].trim() : '';
          const isHeader = nextLine.replace(/\|/g, '').trim().replace(/\s/g, '').replace(/-/g, '').replace(/:/g, '') === '';
          
          if (isHeader) {
            // This is a header row
            const cells = line.split('|').map(cell => cell.trim());
            // Remove empty cells at the start and end if they exist
            if (cells[0] === '') cells.shift();
            if (cells[cells.length - 1] === '') cells.pop();
            
            tableHeaders = cells.map((cell, index) => (
              <th key={`th-${index}`}>{formatInlineElements(cell)}</th>
            ));
          } else {
            // This is a regular row
            const cells = line.split('|').map(cell => cell.trim());
            // Remove empty cells at the start and end if they exist
            if (cells[0] === '') cells.shift();
            if (cells[cells.length - 1] === '') cells.pop();
            
            tableRows.push(
              <tr key={`tr-${i}`}>
                {cells.map((cell, index) => (
                  <td key={`td-${i}-${index}`}>{formatInlineElements(cell)}</td>
                ))}
              </tr>
            );
          }
        } else {
          // Add a row to the existing table
          const cells = line.split('|').map(cell => cell.trim());
          // Remove empty cells at the start and end if they exist
          if (cells[0] === '') cells.shift();
          if (cells[cells.length - 1] === '') cells.pop();
          
          tableRows.push(
            <tr key={`tr-${i}`}>
              {cells.map((cell, index) => (
                <td key={`td-${i}-${index}`}>{formatInlineElements(cell)}</td>
              ))}
            </tr>
          );
        }
        
        // If this is the last line or the next line is not a table row, end the table
        const nextLine = i + 1 < lines.length ? lines[i + 1].trim() : '';
        if (i === lines.length - 1 || !nextLine.includes('|')) {
          formattedLines.push(
            <div key={`table-${i}`} className="table-container">
              <table className="formatted-table">
                {tableHeaders.length > 0 && (
                  <thead>
                    <tr>{tableHeaders}</tr>
                  </thead>
                )}
                <tbody>{tableRows}</tbody>
              </table>
            </div>
          );
          inTable = false;
        }
      } else if (inTable) {
        // End the current table
        formattedLines.push(
          <div key={`table-${i}`} className="table-container">
            <table className="formatted-table">
              {tableHeaders.length > 0 && (
                <thead>
                  <tr>{tableHeaders}</tr>
                </thead>
              )}
              <tbody>{tableRows}</tbody>
            </table>
          </div>
        );
        inTable = false;
        
        // Process the current line as non-table content
        formattedLines.push(...formatLine(line, i));
      } else {
        // Process non-table content
        formattedLines.push(...formatLine(line, i));
      }
    }
    
    return formattedLines;
  };
  
  // Function to format a single line
  const formatLine = (line, index) => {
    const formattedLines = [];
    
    // Check for horizontal rule
    if (line.trim().match(/^([-*_])\1{2,}$/)) {
      formattedLines.push(<div key={`hr-${index}`} className="horizontal-rule" />);
      return formattedLines;
    }
    
    // Format headings
    const headingMatch = line.match(/^(#{1,6})\s(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const HeadingTag = `h${level}`;
      formattedLines.push(
        <HeadingTag key={`heading-${index}`} className={`heading-${level}`}>
          {formatInlineElements(headingMatch[2])}
        </HeadingTag>
      );
    } else if (line.trim() === '') {
      // Empty line
      formattedLines.push(<br key={`br-${index}`} />);
    } else {
      // Check for list items
      const numberedMatch = line.match(/^\s*(\d+)\.(\s.+)$/);
      const bulletMatch = line.match(/^\s*[-*•](\s.+)$/);
      
      if (numberedMatch) {
        // Numbered list item
        formattedLines.push(
          <div key={`list-item-${index}`} className="list-item numbered">
            <span className="list-marker">{numberedMatch[1]}.</span>
            <span className="list-content">{formatInlineElements(numberedMatch[2].trim())}</span>
          </div>
        );
      } else if (bulletMatch) {
        // Bullet list item
        formattedLines.push(
          <div key={`list-item-${index}`} className="list-item bulleted">
            <span className="list-marker">•</span>
            <span className="list-content">{formatInlineElements(bulletMatch[1].trim())}</span>
          </div>
        );
      } else {
        // Regular paragraph
        formattedLines.push(
          <p key={`p-${index}`}>
            {formatInlineElements(line)}
          </p>
        );
      }
    }
    
    return formattedLines;
  };
  
  // Function to format text with tables and other elements
  const formatText = (text) => {
    // Check if the text contains table markers
    if (text.includes('|')) {
      return formatTables(text);
    } else {
      // Process the text line by line
      const lines = text.split('\n');
      const formattedLines = [];
      
      for (let i = 0; i < lines.length; i++) {
        formattedLines.push(...formatLine(lines[i], i));
      }
      
      return formattedLines;
    }
  };
  
  // Main render function
  try {
    const formattedContent = formatCodeBlocks(content);
    return <div className="formatted-content">{formattedContent}</div>;
  } catch (error) {
    console.error('Error formatting message:', error);
    return <div className="formatted-content">{content}</div>;
  }
};

export default function Chat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [speechEnabled, setSpeechEnabled] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const [speechRate, setSpeechRate] = useState(1.5);
  const [connectionStatus, setConnectionStatus] = useState('connected'); // 'connected', 'connecting', 'disconnected'
  const [errorMessage, setErrorMessage] = useState('');
  const messagesEndRef = useRef(null);
  const recognitionRef = useRef(null);
  const retryTimeoutRef = useRef(null);

  useEffect(() => {
    scrollToBottom();
    
    // Initialize speech synthesis on client side only
    if (typeof window !== 'undefined') {
      initSpeechSynthesis();
      setSpeechEnabled('webkitSpeechRecognition' in window || 'SpeechRecognition' in window);
    }
    
    // Cleanup speech when component unmounts
    return () => {
      stopSpeaking();
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {}
      }
      // Clean up reconnection timeout
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    scrollToBottom();
    
    // Read the last assistant message aloud if TTS is enabled
    if (ttsEnabled && messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.role === 'assistant' && !lastMessage.isLoading) {
        speak(lastMessage.content, speechRate);
      }
    }
  }, [messages, ttsEnabled, speechRate]);
  
  // Check connection status on mount
  useEffect(() => {
    // Test connection when component mounts
    const checkConnection = async () => {
      try {
        setConnectionStatus('connecting');
        await submitMessage('ping', true);
        setConnectionStatus('connected');
        setErrorMessage('');
      } catch (error) {
        console.error('Initial connection check failed:', error);
        handleConnectionError(error);
      }
    };
    
    checkConnection();
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Helper function to extract text from API response
  const extractTextFromResponse = (response) => {
    if (typeof response === 'string') return response;
    if (response === null || response === undefined) return 'No response received';
    
    // If it's an object with a loading property, handle accordingly
    if (response && typeof response === 'object') {
      if (response.hasOwnProperty('__type__')) {
        return '[Response pending...]';
      }
      // Try to stringify the object
      try {
        return JSON.stringify(response);
      } catch (e) {
        return 'Received a response I cannot display';
      }
    }
    
    return String(response);
  };

  // Function to handle connection errors and auto-reconnect
  const handleConnectionError = (error) => {
    setConnectionStatus('disconnected');
    const errorMsg = error?.message || 'Network or server error';
    setErrorMessage(errorMsg);
    
    // Clear any existing retry timeout
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
    }
    
    // Set up auto-reconnect after 10 seconds
    retryTimeoutRef.current = setTimeout(() => {
      setConnectionStatus('connecting');
      setErrorMessage('Attempting to reconnect...');
      
      // Try to establish a new connection
      submitMessage('ping', true) // The second parameter indicates this is just a connection test
        .then(() => {
          setConnectionStatus('connected');
          setErrorMessage('');
        })
        .catch(e => {
          // If reconnection fails, try again later
          handleConnectionError(e);
        });
    }, 10000);
  };
  
  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!input.trim() || isLoading) return;

    // If we're disconnected, try to reconnect first
    if (connectionStatus === 'disconnected') {
      setConnectionStatus('connecting');
      setErrorMessage('Attempting to reconnect...');
    }

    const userMessage = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      setMessages(prev => [...prev, { role: 'assistant', content: '', isLoading: true }]);
      const response = await submitMessage(userMessage);
      
      // If we get here, we're connected
      if (connectionStatus !== 'connected') {
        setConnectionStatus('connected');
        setErrorMessage('');
      }
      
      setMessages(prev => {
        const newMessages = [...prev];
        // Replace the loading message with the actual response
        const textResponse = extractTextFromResponse(response);
        newMessages[newMessages.length - 1] = { role: 'assistant', content: textResponse };
        return newMessages;
      });
    } catch (error) {
      // Handle connection errors
      if (error.message && (error.message.includes('network') || error.message.includes('connect'))) {
        handleConnectionError(error);
      }
      
      setMessages(prev => {
        const newMessages = [...prev];
        // Replace the loading message with a more specific error
        const errorMsg = error?.message || 'Unknown error';
        const userFriendlyMessage = errorMsg.includes('after 3 attempts') ?
          'Sorry, I\'m having trouble connecting to my knowledge base. Please try again in a moment.' :
          'Sorry, I encountered an error while processing your request.';
          
        newMessages[newMessages.length - 1] = { 
          role: 'assistant', 
          content: userFriendlyMessage,
          isError: true
        };
        return newMessages;
      });
      console.error('Error submitting message:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleListening = () => {
    if (isListening) {
      // Stop listening
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      return;
    }
    
    // Start listening
    setIsListening(true);
    
    recognitionRef.current = initSpeechRecognition(
      // onResult
      (transcript) => {
        setInput(transcript);
        // Auto-submit after a brief delay to allow reading the transcription
        setTimeout(() => {
          if (recognitionRef.current) {
            handleSubmit();
          }
        }, 1000);
      },
      // onEnd
      () => {
        setIsListening(false);
      }
    );
    
    if (recognitionRef.current) {
      recognitionRef.current.start();
    } else {
      setIsListening(false);
    }
  };

  const toggleTts = () => {
    if (ttsEnabled) {
      stopSpeaking();
    }
    setTtsEnabled(!ttsEnabled);
  };

  const handleClear = async () => {
    try {
      stopSpeaking();
      await clearHistory();
      setMessages([]);
      
      // If we get here, we're connected
      if (connectionStatus !== 'connected') {
        setConnectionStatus('connected');
        setErrorMessage('');
      }
    } catch (error) {
      console.error('Error clearing chat history:', error);
      
      // Handle connection errors
      if (error.message && (error.message.includes('network') || error.message.includes('connect'))) {
        handleConnectionError(error);
      }
    }
  };

  const handleNewChat = async () => {
    try {
      stopSpeaking();
      await newChat();
      setMessages([]);
      
      // If we get here, we're connected
      if (connectionStatus !== 'connected') {
        setConnectionStatus('connected');
        setErrorMessage('');
      }
    } catch (error) {
      console.error('Error creating new chat:', error);
      
      // Handle connection errors
      if (error.message && (error.message.includes('network') || error.message.includes('connect'))) {
        handleConnectionError(error);
      }
    }
  };

  const handleRegenerate = async () => {
    if (isLoading || messages.length === 0) return;

    stopSpeaking();
    
    // If we're disconnected, try to reconnect first
    if (connectionStatus === 'disconnected') {
      setConnectionStatus('connecting');
      setErrorMessage('Attempting to reconnect...');
    }
    
    // Find the last assistant message
    const lastAssistantIndex = [...messages].reverse().findIndex(msg => msg.role === 'assistant');
    if (lastAssistantIndex === -1) return;

    const actualIndex = messages.length - 1 - lastAssistantIndex;
    setIsLoading(true);

    try {
      // Update the message to show loading
      setMessages(prev => {
        const newMessages = [...prev];
        newMessages[actualIndex] = { ...newMessages[actualIndex], content: '', isLoading: true };
        return newMessages;
      });

      const response = await regenerateMessage();
      
      // If we get here, we're connected
      if (connectionStatus !== 'connected') {
        setConnectionStatus('connected');
        setErrorMessage('');
      }
      
      // Update with the regenerated response
      setMessages(prev => {
        const newMessages = [...prev];
        const textResponse = extractTextFromResponse(response);
        newMessages[actualIndex] = { role: 'assistant', content: textResponse };
        return newMessages;
      });
    } catch (error) {
      // Handle connection errors
      if (error.message && (error.message.includes('network') || error.message.includes('connect'))) {
        handleConnectionError(error);
      }
      
      setMessages(prev => {
        const newMessages = [...prev];
        // Replace the loading message with a more specific error
        const errorMsg = error?.message || 'Unknown error';
        const userFriendlyMessage = errorMsg.includes('after 3 attempts') ?
          'Sorry, I\'m having trouble connecting to my knowledge base. Please try again in a moment.' :
          'Sorry, I encountered an error while regenerating the response.';
          
        newMessages[actualIndex] = { 
          role: 'assistant', 
          content: userFriendlyMessage,
          isError: true
        };
        return newMessages;
      });
      console.error('Error regenerating message:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!isLoading) return;

    try {
      stopSpeaking();
      await cancelGeneration();
      // Update the last message to show it was canceled
      setMessages(prev => {
        const newMessages = [...prev];
        const lastMessage = newMessages[newMessages.length - 1];
        if (lastMessage.isLoading) {
          newMessages[newMessages.length - 1] = { 
            ...lastMessage, 
            content: 'Generation canceled.', 
            isLoading: false 
          };
        }
        return newMessages;
      });
      
      // If we get here, we're connected
      if (connectionStatus !== 'connected') {
        setConnectionStatus('connected');
        setErrorMessage('');
      }
    } catch (error) {
      console.error('Error canceling generation:', error);
      
      // Handle connection errors
      if (error.message && (error.message.includes('network') || error.message.includes('connect'))) {
        handleConnectionError(error);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const increaseSpeechRate = () => {
    if (speechRate < 3) {
      setSpeechRate(prevRate => Math.min(prevRate + 0.25, 3));
    }
  };

  const decreaseSpeechRate = () => {
    if (speechRate > 0.5) {
      setSpeechRate(prevRate => Math.max(prevRate - 0.25, 0.5));
    }
  };

  return (
    <div className="chat-container">
      {/* Connection status indicator */}
      {connectionStatus !== 'connected' && (
        <div className={`connection-status ${connectionStatus}`}>
          {connectionStatus === 'connecting' ? 'Connecting...' : 'Disconnected'}
          {errorMessage && <div className="error-details">{errorMessage}</div>}
        </div>
      )}
      
      <div className="chat-messages">
        {messages.length === 0 && (
          <div className="empty-chat">
            <h3>How can I help you today?</h3>
            <p>Start a conversation with the A-U-R-A AI assistant.</p>
          </div>
        )}
        
        {messages.map((message, index) => (
          <div key={index} className={`message ${message.role} ${message.isError ? 'error' : ''}`}>
            <div className="message-header">
              {message.role === 'user' ? 'You' : 'A-U-R-A'}
            </div>
            <div className="message-content">
              {message.isLoading ? 
                <div className="loading-animation">Thinking...</div> : 
                <MessageContent content={message.content} />
              }
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="chat-controls">
        <button onClick={handleNewChat} disabled={isLoading}>New Chat</button>
        <button onClick={handleClear} disabled={isLoading}>Clear Chat</button>
        <button onClick={handleRegenerate} disabled={isLoading || messages.length === 0}>Regenerate</button>
        {speechEnabled && (
          <>
            <button 
              onClick={toggleTts} 
              className={ttsEnabled ? 'active' : ''}
              title="Text-to-Speech"
              disabled={connectionStatus !== 'connected'}
            >
              🔊
            </button>
            
            {ttsEnabled && (
              <div className="speech-rate-controls">
                <button onClick={decreaseSpeechRate} title="Slower" disabled={speechRate <= 0.5}>-</button>
                <span className="speech-rate">{speechRate.toFixed(1)}x</span>
                <button onClick={increaseSpeechRate} title="Faster" disabled={speechRate >= 3}>+</button>
              </div>
            )}
            
            <button 
              onClick={toggleListening} 
              className={isListening ? 'active' : ''}
              disabled={isLoading || connectionStatus !== 'connected'}
              title="Voice Input"
            >
              🎤
            </button>
          </>
        )}
        {isLoading && <button onClick={handleCancel}>Cancel</button>}
      </div>

      <form onSubmit={handleSubmit} className="chat-input">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={connectionStatus === 'disconnected' ? 'Reconnecting...' : isListening ? "Listening..." : "Type your message..."}
          disabled={isLoading || isListening || connectionStatus === 'connecting'}
        />
        <button 
          type="submit" 
          disabled={!input.trim() || isLoading || connectionStatus === 'connecting'}
          title={connectionStatus !== 'connected' ? 'Attempting to reconnect...' : ''}
        >
          Send
        </button>
      </form>
    </div>
  );
}