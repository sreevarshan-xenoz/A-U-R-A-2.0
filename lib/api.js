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
    return { type: "text", content: "Couldn't process the response" };
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
          
          // Process the content to create a structured format
          return structureResponse(content);
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
    
    // Process the content to create a structured format
    return structureResponse(textResponse);
  } catch (e) {
    return { type: "text", content: "Received a response I cannot display" };
  }
}

// Function to structure the AI response into a more organized format
function structureResponse(text) {
  // Check if the text is already in JSON format
  try {
    const jsonObj = JSON.parse(text);
    if (typeof jsonObj === 'object') {
      return { type: "json", content: jsonObj };
    }
  } catch (e) {
    // Not JSON, continue with text processing
  }

  // Check for markdown-like formatting
  if (text.includes('```') || text.includes('# ') || text.includes('- ') || text.includes('1. ') || text.includes('|')) {
    // Check specifically for tables
    if (text.includes('|') && text.includes('---')) {
      return { type: "markdown", content: text, hasTables: true };
    }
    return { type: "markdown", content: text };
  }

  // Check for table-like content
  if (text.includes('|') && text.includes('\n')) {
    const lines = text.split('\n');
    let inTable = false;
    let tableStartIndex = -1;
    let tableEndIndex = -1;
    
    // Find table boundaries
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith('|') && line.endsWith('|')) {
        if (!inTable) {
          inTable = true;
          tableStartIndex = i;
        }
      } else if (inTable && (line.includes('---') || !line.startsWith('|'))) {
        if (line.includes('---')) {
          // This is a separator row, continue
          continue;
        } else {
          // End of table
          tableEndIndex = i - 1;
          inTable = false;
          break;
        }
      }
    }
    
    // If we found a table
    if (tableStartIndex >= 0 && tableEndIndex > tableStartIndex) {
      const tableLines = lines.slice(tableStartIndex, tableEndIndex + 1);
      const tableData = parseTable(tableLines);
      
      // Create a structured response with the table
      const sections = [];
      
      // Add text before the table
      if (tableStartIndex > 0) {
        const beforeText = lines.slice(0, tableStartIndex).join('\n');
        if (beforeText.trim()) {
          sections.push({ type: "text", content: beforeText });
        }
      }
      
      // Add the table
      sections.push({ type: "table", data: tableData });
      
      // Add text after the table
      if (tableEndIndex < lines.length - 1) {
        const afterText = lines.slice(tableEndIndex + 1).join('\n');
        if (afterText.trim()) {
          sections.push({ type: "text", content: afterText });
        }
      }
      
      return { type: "structured", sections };
    }
  }

  // Check for list-like content
  if (text.includes('\n- ') || text.includes('\n* ') || text.includes('\n• ')) {
    // Convert to a structured list
    const lines = text.split('\n');
    const sections = [];
    let currentSection = { type: "text", content: "" };
    
    for (const line of lines) {
      // Check for section headers
      if (line.startsWith('# ')) {
        if (currentSection.content) {
          sections.push(currentSection);
        }
        currentSection = { type: "heading", content: line.substring(2) };
        sections.push(currentSection);
        currentSection = { type: "text", content: "" };
      } 
      // Check for list items
      else if (line.trim().startsWith('- ') || line.trim().startsWith('* ') || line.trim().startsWith('• ')) {
        if (currentSection.type !== "list") {
          if (currentSection.content) {
            sections.push(currentSection);
          }
          currentSection = { type: "list", items: [] };
        }
        currentSection.items.push(line.trim().substring(2));
      }
      // Check for numbered list items
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
    
    // Add the last section
    if (currentSection.content || (currentSection.type === "list" && currentSection.items.length > 0) || 
        (currentSection.type === "numberedList" && currentSection.items.length > 0)) {
      sections.push(currentSection);
    }
    
    return { type: "structured", sections };
  }

  // Check for code blocks
  if (text.includes('```')) {
    const codeBlocks = [];
    let inCodeBlock = false;
    let currentCodeBlock = { language: "", code: "" };
    let regularText = "";
    
    const lines = text.split('\n');
    for (const line of lines) {
      if (line.startsWith('```')) {
        if (inCodeBlock) {
          // End of code block
          codeBlocks.push(currentCodeBlock);
          inCodeBlock = false;
        } else {
          // Start of code block
          inCodeBlock = true;
          const language = line.substring(3).trim();
          currentCodeBlock = { language, code: "" };
        }
      } else if (inCodeBlock) {
        currentCodeBlock.code += line + '\n';
      } else {
        regularText += line + '\n';
      }
    }
    
    if (codeBlocks.length > 0) {
      return { 
        type: "codeBlocks", 
        text: regularText.trim(),
        codeBlocks 
      };
    }
  }

  // Default to plain text
  return { type: "text", content: text };
}

// Helper function to parse a markdown table
function parseTable(tableLines) {
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