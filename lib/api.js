import { Client } from "@gradio/client";

// Maximum number of retry attempts for API calls
const MAX_RETRIES = 3;
// Delay between retries (in milliseconds) - increases with each retry
const BASE_RETRY_DELAY = 1000;

/**
 * Connect to the Qwen model with retry mechanism
 * @returns {Promise<Client>} The connected client
 */
export async function connectToQwen() {
  let retries = 0;
  let lastError;

  while (retries < MAX_RETRIES) {
    try {
      const hfToken = process.env.NEXT_PUBLIC_HF_TOKEN;
      if (!hfToken) {
        throw new Error("Missing Hugging Face token. Please check your environment variables.");
      }
      
      const client = await Client.connect("Qwen/QwQ-32B-Demo", {
        hf_token: hfToken,
      });
      return client;
    } catch (error) {
      lastError = error;
      console.error(`Error connecting to A-U-R-A model (attempt ${retries + 1}/${MAX_RETRIES}):`, error);
      
      // If we've reached max retries, throw the error
      if (retries === MAX_RETRIES - 1) {
        break;
      }
      
      // Wait before retrying with exponential backoff
      const delay = BASE_RETRY_DELAY * Math.pow(2, retries);
      await new Promise(resolve => setTimeout(resolve, delay));
      retries++;
    }
  }
  
  // If we've exhausted all retries, throw a more descriptive error
  throw new Error(`Failed to connect to A-U-R-A model after ${MAX_RETRIES} attempts: ${lastError?.message || 'Unknown error'}`);
}

// Helper function to extract the actual message from the A-U-R-A response
function extractMessageFromQwenResponse(response) {
  if (!response || typeof response !== 'object') {
    return "Couldn't process the response";
  }

  // Handle array responses (most common format)
  if (Array.isArray(response)) {
    // Look for the last items update that contains messages
    for (let i = response.length - 1; i >= 0; i--) {
      const update = response[i];
      if (update && update.__type__ === "update" && Array.isArray(update.items)) {
        // Find the assistant message in the items
        const assistantMessage = update.items.find(item => item.role === "assistant");
        if (assistantMessage && assistantMessage.content) {
          // Replace any mention of "Qwen" with "A-U-R-A" in the response
          let content = assistantMessage.content;
          content = content.replace(/\bQwen\b/g, "A-U-R-A");
          content = content.replace(/\bqwen\b/gi, "A-U-R-A");
          return content;
        }
      }
    }
  }

  // If we can't find the structured format, try to use toString or stringify
  try {
    let textResponse = typeof response.toString === 'function' ? 
      response.toString() : 
      JSON.stringify(response);
    
    // Replace any mention of "Qwen" with "A-U-R-A" in the response
    textResponse = textResponse.replace(/\bQwen\b/g, "A-U-R-A");
    textResponse = textResponse.replace(/\bqwen\b/gi, "A-U-R-A");
    return textResponse;
  } catch (e) {
    return "Received a response I cannot display";
  }
}

/**
 * Submit a message to the A-U-R-A model with retry mechanism
 * @param {string} message - The user's message
 * @param {boolean} [isConnectionTest=false] - Whether this is just a connection test
 * @returns {Promise<string>} The model's response
 */
export async function submitMessage(message, isConnectionTest = false) {
  let retries = 0;
  let lastError;

  while (retries < MAX_RETRIES) {
    try {
      const client = await connectToQwen();
      
      // If this is just a connection test, we don't need to actually submit the message
      if (isConnectionTest) {
        return "Connection successful";
      }
      
      const result = await client.predict("/submit", {
        sender_value: message,
      });
      return extractMessageFromQwenResponse(result.data);
    } catch (error) {
      lastError = error;
      console.error(`Error submitting message (attempt ${retries + 1}/${MAX_RETRIES}):`, error);
      
      // If we've reached max retries, break out of the loop
      if (retries === MAX_RETRIES - 1) {
        break;
      }
      
      // Wait before retrying with exponential backoff
      const delay = BASE_RETRY_DELAY * Math.pow(2, retries);
      await new Promise(resolve => setTimeout(resolve, delay));
      retries++;
    }
  }
  
  // If we've exhausted all retries, throw a more descriptive error
  throw new Error(`Failed to submit message after ${MAX_RETRIES} attempts: ${lastError?.message || 'Network or server error'}.`);
}

/**
 * Create a new chat session with retry mechanism
 * @returns {Promise<any>} Result of the operation
 */
export async function newChat() {
  let retries = 0;
  let lastError;

  while (retries < MAX_RETRIES) {
    try {
      const client = await connectToQwen();
      const result = await client.predict("/new_chat", {});
      return result.data;
    } catch (error) {
      lastError = error;
      console.error(`Error creating new chat (attempt ${retries + 1}/${MAX_RETRIES}):`, error);
      
      if (retries === MAX_RETRIES - 1) break;
      
      const delay = BASE_RETRY_DELAY * Math.pow(2, retries);
      await new Promise(resolve => setTimeout(resolve, delay));
      retries++;
    }
  }
  
  throw new Error(`Failed to create new chat after ${MAX_RETRIES} attempts: ${lastError?.message || 'Network or server error'}.`);
}

/**
 * Regenerate the last assistant message with retry mechanism
 * @returns {Promise<string>} The regenerated response
 */
export async function regenerateMessage() {
  let retries = 0;
  let lastError;

  while (retries < MAX_RETRIES) {
    try {
      const client = await connectToQwen();
      const result = await client.predict("/regenerate_message", {});
      return extractMessageFromQwenResponse(result.data);
    } catch (error) {
      lastError = error;
      console.error(`Error regenerating message (attempt ${retries + 1}/${MAX_RETRIES}):`, error);
      
      if (retries === MAX_RETRIES - 1) break;
      
      const delay = BASE_RETRY_DELAY * Math.pow(2, retries);
      await new Promise(resolve => setTimeout(resolve, delay));
      retries++;
    }
  }
  
  throw new Error(`Failed to regenerate message after ${MAX_RETRIES} attempts: ${lastError?.message || 'Network or server error'}.`);
}

/**
 * Cancel the current generation with retry mechanism
 * @returns {Promise<any>} Result of the operation
 */
export async function cancelGeneration() {
  let retries = 0;
  let lastError;

  while (retries < MAX_RETRIES) {
    try {
      const client = await connectToQwen();
      const result = await client.predict("/cancel", {});
      return result.data;
    } catch (error) {
      lastError = error;
      console.error(`Error canceling generation (attempt ${retries + 1}/${MAX_RETRIES}):`, error);
      
      if (retries === MAX_RETRIES - 1) break;
      
      const delay = BASE_RETRY_DELAY * Math.pow(2, retries);
      await new Promise(resolve => setTimeout(resolve, delay));
      retries++;
    }
  }
  
  throw new Error(`Failed to cancel generation after ${MAX_RETRIES} attempts: ${lastError?.message || 'Network or server error'}.`);
}

/**
 * Clear conversation history with retry mechanism
 * @returns {Promise<any>} Result of the operation
 */
export async function clearHistory() {
  let retries = 0;
  let lastError;

  while (retries < MAX_RETRIES) {
    try {
      const client = await connectToQwen();
      const result = await client.predict("/clear_conversation_history", {});
      return result.data;
    } catch (error) {
      lastError = error;
      console.error(`Error clearing history (attempt ${retries + 1}/${MAX_RETRIES}):`, error);
      
      if (retries === MAX_RETRIES - 1) break;
      
      const delay = BASE_RETRY_DELAY * Math.pow(2, retries);
      await new Promise(resolve => setTimeout(resolve, delay));
      retries++;
    }
  }
  
  throw new Error(`Failed to clear history after ${MAX_RETRIES} attempts: ${lastError?.message || 'Network or server error'}.`);
}