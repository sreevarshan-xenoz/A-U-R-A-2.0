import { Client } from "@gradio/client";

export async function connectToQwen() {
  try {
    const hfToken = process.env.NEXT_PUBLIC_HF_TOKEN;
    const client = await Client.connect("Qwen/QwQ-32B-Demo", {
      hf_token: hfToken,
    });
    return client;
  } catch (error) {
    console.error("Error connecting to A-U-R-A model:", error);
    throw error;
  }
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

export async function submitMessage(message) {
  try {
    const client = await connectToQwen();
    const result = await client.predict("/submit", {
      sender_value: message,
    });
    return extractMessageFromQwenResponse(result.data);
  } catch (error) {
    console.error("Error submitting message:", error);
    throw error;
  }
}

export async function newChat() {
  try {
    const client = await connectToQwen();
    const result = await client.predict("/new_chat", {});
    return result.data;
  } catch (error) {
    console.error("Error creating new chat:", error);
    throw error;
  }
}

export async function regenerateMessage() {
  try {
    const client = await connectToQwen();
    const result = await client.predict("/regenerate_message", {});
    return extractMessageFromQwenResponse(result.data);
  } catch (error) {
    console.error("Error regenerating message:", error);
    throw error;
  }
}

export async function cancelGeneration() {
  try {
    const client = await connectToQwen();
    const result = await client.predict("/cancel", {});
    return result.data;
  } catch (error) {
    console.error("Error canceling generation:", error);
    throw error;
  }
}

export async function clearHistory() {
  try {
    const client = await connectToQwen();
    const result = await client.predict("/clear_conversation_history", {});
    return result.data;
  } catch (error) {
    console.error("Error clearing history:", error);
    throw error;
  }
} 