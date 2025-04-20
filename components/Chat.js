import { useState, useEffect, useRef } from 'react';
import { submitMessage, newChat, regenerateMessage, cancelGeneration, clearHistory } from '../lib/api';

export default function Chat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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

  const handleSubmit = async (e) => {
    e.preventDefault();
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
        const textResponse = extractTextFromResponse(response);
        newMessages[newMessages.length - 1] = { role: 'assistant', content: textResponse };
        return newMessages;
      });
    } catch (error) {
      setMessages(prev => {
        const newMessages = [...prev];
        // Replace the loading message with an error
        newMessages[newMessages.length - 1] = { 
          role: 'assistant', 
          content: 'Sorry, I encountered an error while processing your request.' 
        };
        return newMessages;
      });
      console.error('Error submitting message:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClear = async () => {
    try {
      await clearHistory();
      setMessages([]);
    } catch (error) {
      console.error('Error clearing chat history:', error);
    }
  };

  const handleNewChat = async () => {
    try {
      await newChat();
      setMessages([]);
    } catch (error) {
      console.error('Error creating new chat:', error);
    }
  };

  const handleRegenerate = async () => {
    if (isLoading || messages.length === 0) return;

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
        const textResponse = extractTextFromResponse(response);
        newMessages[actualIndex] = { role: 'assistant', content: textResponse };
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
    } catch (error) {
      console.error('Error canceling generation:', error);
    } finally {
      setIsLoading(false);
    }
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
                message.content
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
        {isLoading && <button onClick={handleCancel}>Cancel</button>}
      </div>

      <form onSubmit={handleSubmit} className="chat-input">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your message..."
          disabled={isLoading}
        />
        <button type="submit" disabled={!input.trim() || isLoading}>
          Send
        </button>
      </form>
    </div>
  );
} 