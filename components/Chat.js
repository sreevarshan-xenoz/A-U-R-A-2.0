import { useState, useEffect, useRef } from 'react';
import { submitMessage, newChat, regenerateMessage, cancelGeneration, clearHistory } from '../lib/api';
import { initSpeechRecognition, initSpeechSynthesis, speak, stopSpeaking } from '../lib/speech';

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