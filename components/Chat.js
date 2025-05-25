import { useState, useEffect, useRef } from 'react';
import { submitMessage, newChat, regenerateMessage, cancelGeneration, clearHistory } from '../lib/api';
import { initSpeechRecognition, initSpeechSynthesis, speak, stopSpeaking } from '../lib/speech';
import CodeBlock from './CodeBlock';

export default function Chat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [speechEnabled, setSpeechEnabled] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const [speechRate, setSpeechRate] = useState(1.5);
  const messagesEndRef = useRef(null);
  const recognitionRef = useRef(null);

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

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Helper function to extract text from API response
  const extractTextFromResponse = (response) => {
    if (typeof response === 'string') return { type: "text", content: response };
    if (response === null || response === undefined) return { type: "text", content: 'No response received' };
    
    // If it's an object with a loading property, handle accordingly
    if (response && typeof response === 'object') {
      if (response.hasOwnProperty('__type__')) {
        return { type: "text", content: '[Response pending...]' };
      }
      
      // If it's already a structured response, return it
      if (response.type) {
        return response;
      }
      
      // Try to stringify the object
      try {
        return { type: "text", content: JSON.stringify(response) };
      } catch (e) {
        return { type: "text", content: 'Received a response I cannot display' };
      }
    }
    
    return { type: "text", content: String(response) };
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      setMessages(prev => [...prev, { role: 'assistant', content: '', isLoading: true }]);
      const response = await submitMessage(userMessage);
      
      setMessages(prev => {
        const newMessages = [...prev];
        // Replace the loading message with the actual response
        const structuredResponse = extractTextFromResponse(response);
        newMessages[newMessages.length - 1] = { role: 'assistant', content: structuredResponse };
        return newMessages;
      });
    } catch (error) {
      setMessages(prev => {
        const newMessages = [...prev];
        // Replace the loading message with an error
        newMessages[newMessages.length - 1] = { 
          role: 'assistant', 
          content: { type: "text", content: 'Sorry, I encountered an error while processing your request.' }
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
    } catch (error) {
      console.error('Error clearing chat history:', error);
    }
  };

  const handleNewChat = async () => {
    try {
      stopSpeaking();
      await newChat();
      setMessages([]);
    } catch (error) {
      console.error('Error creating new chat:', error);
    }
  };

  const handleRegenerate = async () => {
    if (isLoading || messages.length === 0) return;

    stopSpeaking();
    
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
      
      // Update with the regenerated response
      setMessages(prev => {
        const newMessages = [...prev];
        const structuredResponse = extractTextFromResponse(response);
        newMessages[actualIndex] = { role: 'assistant', content: structuredResponse };
        return newMessages;
      });
    } catch (error) {
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
            content: { type: "text", content: 'Generation canceled.' },
            isLoading: false 
          };
        }
        return newMessages;
      });
    } catch (error) {
      console.error('Error canceling generation:', error);
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

  // Component to render structured content
  const StructuredContent = ({ content }) => {
    if (!content) return null;
    
    // Handle different content types
    switch (content.type) {
      case "text":
        return <div className="message-text">{content.content}</div>;
        
      case "json":
        return (
          <div className="message-json">
            <pre>{JSON.stringify(content.content, null, 2)}</pre>
          </div>
        );
        
      case "structured":
        return (
          <div className="message-structured">
            {content.sections.map((section, i) => {
              switch (section.type) {
                case "heading":
                  return <h3 key={i}>{section.content}</h3>;
                case "text":
                  return <p key={i}>{section.content}</p>;
                case "list":
                  return (
                    <ul key={i}>
                      {section.items.map((item, j) => (
                        <li key={j}>{item}</li>
                      ))}
                    </ul>
                  );
                case "numberedList":
                  return (
                    <ol key={i}>
                      {section.items.map((item, j) => (
                        <li key={j}>{item}</li>
                      ))}
                    </ol>
                  );
                case "table":
                  return (
                    <div key={i} className="message-table-container">
                      <table className="message-table">
                        <thead>
                          <tr>
                            {section.data.headers.map((header, j) => (
                              <th key={j}>{header}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {section.data.rows.map((row, j) => (
                            <tr key={j}>
                              {row.map((cell, k) => (
                                <td key={k}>{cell}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                default:
                  return null;
              }
            })}
          </div>
        );
        
      case "codeBlocks":
        return (
          <div className="message-code-blocks">
            {content.text && <p>{content.text}</p>}
            {content.codeBlocks.map((block, i) => (
              <CodeBlock 
                key={i} 
                language={block.language} 
                code={block.code} 
              />
            ))}
          </div>
        );
        
      case "markdown":
        // Check if the markdown contains code blocks
        if (content.content.includes('```')) {
          // Process markdown with code blocks
          const sections = [];
          let currentSection = { type: "text", content: "" };
          let inCodeBlock = false;
          let codeLanguage = "";
          let codeContent = [];
          
          const lines = content.content.split('\n');
          
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            // Check for code block start
            if (line.trim().startsWith('```') && !inCodeBlock) {
              // Save any text content before the code block
              if (currentSection.content) {
                sections.push(currentSection);
                currentSection = { type: "text", content: "" };
              }
              
              inCodeBlock = true;
              // Extract language if present
              const langMatch = line.trim().match(/^```(\w+)?/);
              codeLanguage = langMatch && langMatch[1] ? langMatch[1] : "";
              codeContent = [];
            } 
            // Check for code block end
            else if (inCodeBlock && line.trim().startsWith('```')) {
              inCodeBlock = false;
              
              // Add the code block
              sections.push({ 
                type: "code", 
                language: codeLanguage, 
                code: codeContent.join('\n') 
              });
              
              // Start a new text section
              currentSection = { type: "text", content: "" };
            }
            // Collect code content
            else if (inCodeBlock) {
              codeContent.push(line);
            }
            // Regular markdown processing
            else {
              // Handle headings
              if (line.startsWith('# ')) {
                if (currentSection.content) {
                  sections.push(currentSection);
                }
                sections.push({ type: "heading", content: line.substring(2) });
                currentSection = { type: "text", content: "" };
              } 
              // Handle list items
              else if (line.trim().startsWith('- ') || line.trim().startsWith('* ') || line.trim().startsWith('• ')) {
                if (currentSection.type !== "list") {
                  if (currentSection.content) {
                    sections.push(currentSection);
                  }
                  currentSection = { type: "list", items: [] };
                }
                currentSection.items.push(line.trim().substring(2));
              }
              // Handle numbered list items
              else if (/^\d+\.\s/.test(line.trim())) {
                if (currentSection.type !== "numberedList") {
                  if (currentSection.content) {
                    sections.push(currentSection);
                  }
                  currentSection = { type: "numberedList", items: [] };
                }
                currentSection.items.push(line.trim().replace(/^\d+\.\s/, ''));
              }
              // Regular text
              else {
                if (currentSection.type === "list" || currentSection.type === "numberedList") {
                  sections.push(currentSection);
                  currentSection = { type: "text", content: "" };
                }
                
                if (currentSection.content) {
                  currentSection.content += '\n' + line;
                } else {
                  currentSection.content = line;
                }
              }
            }
          }
          
          // Add the last section
          if (currentSection.content || 
              (currentSection.type === "list" && currentSection.items.length > 0) || 
              (currentSection.type === "numberedList" && currentSection.items.length > 0)) {
            sections.push(currentSection);
          }
          
          // If we're still in a code block at the end, add it
          if (inCodeBlock && codeContent.length > 0) {
            sections.push({ 
              type: "code", 
              language: codeLanguage, 
              code: codeContent.join('\n') 
            });
          }
          
          // Render the structured content
          return (
            <div className="message-structured">
              {sections.map((section, i) => {
                switch (section.type) {
                  case "heading":
                    return <h3 key={i}>{section.content}</h3>;
                  case "text":
                    return <p key={i}>{section.content}</p>;
                  case "list":
                    return (
                      <ul key={i}>
                        {section.items.map((item, j) => (
                          <li key={j}>{item}</li>
                        ))}
                      </ul>
                    );
                  case "numberedList":
                    return (
                      <ol key={i}>
                        {section.items.map((item, j) => (
                          <li key={j}>{item}</li>
                        ))}
                      </ol>
                    );
                  case "code":
                    return (
                      <CodeBlock 
                        key={i} 
                        language={section.language} 
                        code={section.code} 
                      />
                    );
                  case "table":
                    return (
                      <div key={i} className="message-table-container">
                        <table className="message-table">
                          <thead>
                            <tr>
                              {section.data.headers.map((header, j) => (
                                <th key={j}>{header}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {section.data.rows.map((row, j) => (
                              <tr key={j}>
                                {row.map((cell, k) => (
                                  <td key={k}>{cell}</td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    );
                  default:
                    return null;
                }
              })}
            </div>
          );
        }
        
        // Check if the markdown contains tables
        if (content.hasTables) {
          // Process markdown with tables
          const lines = content.content.split('\n');
          const sections = [];
          let currentSection = { type: "text", content: "" };
          let inTable = false;
          let tableLines = [];
          
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            // Check for table start
            if (line.trim().startsWith('|') && line.trim().endsWith('|') && !inTable) {
              // Save any text content before the table
              if (currentSection.content) {
                sections.push(currentSection);
                currentSection = { type: "text", content: "" };
              }
              
              inTable = true;
              tableLines = [line];
            } 
            // Check for table end
            else if (inTable && (!line.trim().startsWith('|') || !line.trim().endsWith('|'))) {
              if (line.includes('---')) {
                // This is a separator row, add it to the table
                tableLines.push(line);
              } else {
                // End of table
                inTable = false;
                
                // Parse and add the table
                const tableData = parseTable(tableLines);
                sections.push({ type: "table", data: tableData });
                
                // Start a new text section
                currentSection = { type: "text", content: line };
              }
            }
            // Continue collecting table lines
            else if (inTable) {
              tableLines.push(line);
            }
            // Regular markdown processing
            else {
              // Handle headings
              if (line.startsWith('# ')) {
                if (currentSection.content) {
                  sections.push(currentSection);
                }
                sections.push({ type: "heading", content: line.substring(2) });
                currentSection = { type: "text", content: "" };
              } 
              // Handle list items
              else if (line.trim().startsWith('- ') || line.trim().startsWith('* ') || line.trim().startsWith('• ')) {
                if (currentSection.type !== "list") {
                  if (currentSection.content) {
                    sections.push(currentSection);
                  }
                  currentSection = { type: "list", items: [] };
                }
                currentSection.items.push(line.trim().substring(2));
              }
              // Handle numbered list items
              else if (/^\d+\.\s/.test(line.trim())) {
                if (currentSection.type !== "numberedList") {
                  if (currentSection.content) {
                    sections.push(currentSection);
                  }
                  currentSection = { type: "numberedList", items: [] };
                }
                currentSection.items.push(line.trim().replace(/^\d+\.\s/, ''));
              }
              // Regular text
              else {
                if (currentSection.type === "list" || currentSection.type === "numberedList") {
                  sections.push(currentSection);
                  currentSection = { type: "text", content: line };
                } else {
                  if (currentSection.content) {
                    currentSection.content += '\n' + line;
                  } else {
                    currentSection.content = line;
                  }
                }
              }
            }
          }
          
          // Add the last section
          if (currentSection.content || 
              (currentSection.type === "list" && currentSection.items.length > 0) || 
              (currentSection.type === "numberedList" && currentSection.items.length > 0)) {
            sections.push(currentSection);
          }
          
          // If we're still in a table at the end, add it
          if (inTable && tableLines.length > 0) {
            const tableData = parseTable(tableLines);
            sections.push({ type: "table", data: tableData });
          }
          
          // Render the structured content
          return (
            <div className="message-structured">
              {sections.map((section, i) => {
                switch (section.type) {
                  case "heading":
                    return <h3 key={i}>{section.content}</h3>;
                  case "text":
                    return <p key={i}>{section.content}</p>;
                  case "list":
                    return (
                      <ul key={i}>
                        {section.items.map((item, j) => (
                          <li key={j}>{item}</li>
                        ))}
                      </ul>
                    );
                  case "numberedList":
                    return (
                      <ol key={i}>
                        {section.items.map((item, j) => (
                          <li key={j}>{item}</li>
                        ))}
                      </ol>
                    );
                  case "table":
                    return (
                      <div key={i} className="message-table-container">
                        <table className="message-table">
                          <thead>
                            <tr>
                              {section.data.headers.map((header, j) => (
                                <th key={j}>{header}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {section.data.rows.map((row, j) => (
                              <tr key={j}>
                                {row.map((cell, k) => (
                                  <td key={k}>{cell}</td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    );
                  default:
                    return null;
                }
              })}
            </div>
          );
        }
        
        // Regular markdown rendering (existing code)
        return (
          <div className="message-markdown">
            {content.content.split('\n').map((line, i) => {
              // Handle headings
              if (line.startsWith('# ')) {
                return <h3 key={i}>{line.substring(2)}</h3>;
              }
              if (line.startsWith('## ')) {
                return <h4 key={i}>{line.substring(3)}</h4>;
              }
              if (line.startsWith('### ')) {
                return <h5 key={i}>{line.substring(4)}</h5>;
              }
              
              // Handle code blocks - we'll skip these as they're handled above
              if (line.startsWith('```')) {
                return null; // Skip the code block markers
              }
              
              // Handle list items
              if (line.trim().startsWith('- ') || line.trim().startsWith('* ') || line.trim().startsWith('• ')) {
                return <li key={i}>{line.trim().substring(2)}</li>;
              }
              
              // Handle numbered list items
              if (/^\d+\.\s/.test(line.trim())) {
                return <li key={i}>{line.trim().replace(/^\d+\.\s/, '')}</li>;
              }
              
              // Regular text
              return <p key={i}>{line}</p>;
            })}
          </div>
        );
        
      default:
        return <div className="message-text">{JSON.stringify(content)}</div>;
    }
  };

  // Helper function to parse a markdown table (same as in api.js)
  const parseTable = (tableLines) => {
    // Skip the separator row (usually the second row with dashes)
    const headerRow = tableLines[0];
    const dataRows = tableLines.filter((line, index) => 
      index > 1 && line.trim().startsWith('|') && line.trim().endsWith('|')
    );
    
    // Parse headers
    const headers = headerRow
      .split('|')
      .filter(cell => cell.trim() !== '')
      .map(cell => cell.trim());
    
    // Parse data rows
    const rows = dataRows.map(row => {
      return row
        .split('|')
        .filter(cell => cell.trim() !== '')
        .map(cell => cell.trim());
    });
    
    return { headers, rows };
  };

  return (
    <div className="chat-container">
      <div className="chat-messages">
        {messages.length === 0 && (
          <div className="empty-chat">
            <h3>How can I help you today?</h3>
            <p>Start a conversation with the A-U-R-A AI assistant.</p>
          </div>
        )}
        
        {messages.map((message, index) => (
          <div key={index} className={`message ${message.role}`}>
            <div className="message-header">
              {message.role === 'user' ? 'You' : 'A-U-R-A'}
            </div>
            <div className="message-content">
              {message.isLoading ? 
                <div className="loading-animation">Thinking...</div> : 
                <StructuredContent content={message.content} />
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
              disabled={isLoading}
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
          placeholder={isListening ? "Listening..." : "Type your message..."}
          disabled={isLoading || isListening}
        />
        <button type="submit" disabled={!input.trim() || isLoading}>
          Send
        </button>
      </form>
    </div>
  );
} 