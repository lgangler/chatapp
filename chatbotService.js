// chatbotService.js for PWA
const MAX_TOKENS = 3800;
const API_URL = 'https://api.openai.com/v1/responses'; // Responses API endpoint

// Make function globally accessible
window.requestChatbotGPT = async function(prompt, sessionData, temperature = 0, model = 'gpt-4o-mini', formatAsJSON = false) {
  const today = new Date();
  const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  const currentDate = today.toLocaleDateString('en-US', dateOptions);

  const instructions = `
You are the Madison Metropolitan School District (MMSD) public-facing AI chatbot assistant. Your role is to support teachers, staff, students, and parents by providing concise, friendly, and accurate information about MMSD. You do not reveal your internal processes.

Steps to follow:
1. Determine the user's intent. If the question is not about MMSD, politely inform the user that you cannot assist with that.
2. Determine if the question is clear. If not, ask for clarification.
3. Search the MMSD knowledge base for relevant information if the question is about MMSD.
4. Determine if the question can be accurately answered based on the knowledge base.
5. If yes, provide a clear and concise answer, including citations from the MMSD knowledge base.
6. If the information is not available, unclear, or you cannot be certain of the answer, briefly inform the user that you are unsure and point them to official MMSD resources.

Response Guidelines:
**Clarity & Tone:**
   - Be very brief, friendly, and professional.
   - Prioritize accuracy and clarity in all responses.

**Professionalism:**
   - Do not reveal or reference searching the knowledge base or your internal processes.
   - Do not mention uploaded documents
   - Never use the word "Document" or "Documents" in your responses.
   
**Knowledge Base Priority:**
   - When the answer is available, include a clear citation.
   - If you draw on multiple documents, mention all relevant sources.
   - Never provide information that is not in the knowledge base. For example, "What color is the sky?" you cannot answer.

**Handling Uncertainty & Ambiguity:**
   - If you need information, ask the user. For example, "What school are you asking about?"
   - If you cannot find a clear answer, state that you are unsure and advise the user to check with official MMSD resources
   - Say something like: "I'm sorry, but I am not sure about that. [advise the user on where to find the information]."
   - Do not speculate.
   - If a question has multiple interpretations, ask the user for clarification instead of guessing.

Context Information:
Today's date is: ${currentDate}
MMSD Website: mmsd.org

Use the above guidelines to ensure every response is accurate, well-cited, and user-focused.
`;

  // NOTE: In a production app, you would never hardcode API keys in client-side JavaScript
  // You would use a server-side API proxy instead
  // This is just for demonstration purposes
  const apiKey = 'sk-proj-Yxcvqw6WFydE9c7tmjoPT3BlbkFJbxUyxNAPWsPdWWs0VUue'; 
  
  const payload = createPayload(prompt, sessionData, temperature, model, formatAsJSON, MAX_TOKENS, instructions);
  const options = {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload),
  };

  try {
    const response = await fetch(API_URL, options);
    console.log("response:", response);
    const res = await response.json();
    return handleResponse(res, prompt);
  } catch (error) {
    console.error('Error in API request: ', error);
    return 'Sorry, there was an error processing your request.';
  }
}

function createPayload(prompt, sessionData, temperature, model, formatAsJSON, MAX_TOKENS, instructions) {
  // Create input messages array
  const input = [
    ...sessionData.map(message => ({ role: message.role, content: message.content })),
    { role: 'user', content: prompt },
  ];

  // Define the tools array with file_search
  const tools = [
    {
      "type": "file_search",
      "vector_store_ids": ["vs_67db1b713324819193ea6c60acb2c437"],
      "max_num_results": 5
    }
  ];

  const payload = {
    model: model,
    input: input,
    instructions: instructions,
    temperature: temperature,
    max_output_tokens: MAX_TOKENS,
    tools: tools,
    tool_choice: "auto",
    ...(formatAsJSON && { text: { format: { type: "json_object" } } })
  };

  return payload;
}

function handleResponse(res, prompt) {
  console.log("Full response:", res);
  
  // Check for errors
  if (res.error) {
    console.error('API error:', res.error);
    return 'Sorry, there was an error processing your request. Please try again later.';
  }
  
  // Check for function calls in the response output
  if (res.output && res.output.length > 0) {
    // Check if there was a file search call
    const fileSearchCall = res.output.find(item => item.type === 'file_search_call');
    
    // Look for message content
    const message = res.output.find(item => item.type === 'message');
    if (message && message.content && message.content.length > 0) {
      const textContent = message.content.find(item => item.type === 'output_text');
      if (textContent) {
        // Check if there are file citations
        if (textContent.annotations && textContent.annotations.length > 0) {
          // Return both the text and annotations for the UI to display
          return {
            text: textContent.text.trim(),
            annotations: textContent.annotations
          };
        } else {
          return textContent.text.trim();
        }
      }
    }
  }
  
  // If we have output_text helper on the response, use it
  if (res.output_text) {
    return res.output_text.trim();
  }
  
  // Fallback response
  return 'I apologize, but I encountered an issue processing your request. Please try asking in a different way.';
}