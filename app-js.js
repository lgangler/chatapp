// app.js - Main application logic for the PWA version

document.addEventListener('DOMContentLoaded', function() {
  // DOM elements
  const messagesContainer = document.getElementById('messages-container');
  const chatForm = document.getElementById('chat-form');
  const messageInput = document.getElementById('message-input');
  const typingIndicator = document.getElementById('typing-indicator');

  // Dictionary mapping keywords in source filenames to URLs
  const sourceLinks = [
    { keyword: "handbook", url: "https://www.madison.k12.wi.us/human-resources/employee-handbook" },
    { keyword: "policy", url: "https://www.madison.k12.wi.us/families/district-policy-guides" },
    { keyword: "calendar", url: "https://www.madison.k12.wi.us/about/calendar-of-events/2024-2025-school-year-calendar" },
    { keyword: "times", url: "https://www.madison.k12.wi.us/families/start-and-dismissal-times/24-25-school-start-dismissal-times-all-schools" },
    { keyword: "directories", url: "https://www.madison.k12.wi.us/contact-us/school-directories" },
  ];

  // Helper function to find a URL for a given filename
  function findSourceUrl(filename) {
    // Convert filename to lowercase for case-insensitive matching
    const lowercaseFilename = filename.toLowerCase();
    
    // Try to find a matching keyword in the filename
    for (const source of sourceLinks) {
      if (lowercaseFilename.includes(source.keyword)) {
        return source.url;
      }
    }
    
    // Default to the MMSD homepage if no match is found
    return "https://www.mmsd.org";
  }

  // Chat state
  let messages = [];
  
  // Initialize
  initChat();
  fixIOSScrolling();

  // Event listeners
  chatForm.addEventListener('submit', handleSubmit);
  messageInput.addEventListener('focus', onInputFocus);

  // Fix iOS scrolling issue when keyboard appears
  function fixIOSScrolling() {
    // For iOS devices
    if (/iPad|iPhone|iPod/.test(navigator.userAgent)) {
      window.addEventListener('resize', () => {
        if (document.activeElement === messageInput) {
          // Scroll to bottom after a small delay to let keyboard appear
          setTimeout(scrollToBottom, 300);
        }
      });
    }
  }

  function onInputFocus() {
    // Scroll to bottom when input is focused (helpful on mobile)
    setTimeout(scrollToBottom, 100);
  }

  async function initChat() {
    try {
      // Try to load previous messages from localStorage
      const savedMessages = localStorage.getItem('chatMessages');
      if (savedMessages) {
        messages = JSON.parse(savedMessages);
        renderMessages();
      } else {
        addBotMessage("Welcome to the Madison Metropolitan School District chatbot assistant! How can I help you today?");
      }
    } catch (error) {
      console.error('Error initializing chat:', error);
      addBotMessage("Welcome to the Madison Metropolitan School District chatbot assistant! How can I help you today?");
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    
    const userInput = messageInput.value.trim();
    if (!userInput) return;
    
    // Clear the input
    messageInput.value = '';
    
    // Add user message to the chat
    addUserMessage(userInput);
    
    // Show typing indicator
    showTypingIndicator();
    
    try {
      // Send request to the API
      const response = await requestChatbotGPT(userInput, messages);
      
      // Hide typing indicator
      hideTypingIndicator();
      
      // Process and display the response
      if (Array.isArray(response)) {
        addBotLinksMessage(response);
      } else if (typeof response === 'object' && response.text && response.annotations) {
        // Handle response with file citations
        addBotMessageWithCitations(response.text, response.annotations);
      } else {
        addBotMessage(response);
      }
      
      // Save the conversation
      saveConversation(messages);
      
    } catch (error) {
      console.error('Error:', error);
      hideTypingIndicator();
      addBotMessage('Sorry, there was an error processing your request.');
    }
    
    // Scroll to the bottom
    scrollToBottom();
  }

  function addUserMessage(content) {
    const message = { role: 'user', content };
    messages.push(message);
    
    const messageElement = document.createElement('div');
    messageElement.className = 'message user-message';
    messageElement.textContent = content;
    
    messagesContainer.appendChild(messageElement);
    scrollToBottom();
  }

  function addBotMessage(content) {
    const message = { role: 'assistant', content };
    messages.push(message);
    
    const messageElement = document.createElement('div');
    messageElement.className = 'message bot-message';
    
    // Parse markdown content
    const markdownContent = document.createElement('div');
    markdownContent.className = 'markdown-content';
    markdownContent.innerHTML = marked.parse(content);
    
    messageElement.appendChild(markdownContent);
    messagesContainer.appendChild(messageElement);
    scrollToBottom();
  }

  function addBotMessageWithCitations(text, annotations) {
    // Store the message in the chat history
    const message = { 
      role: 'assistant', 
      content: text,
      annotations: annotations // Store annotations for potential future use
    };
    messages.push(message);
    
    const messageElement = document.createElement('div');
    messageElement.className = 'message bot-message';
    
    // Parse markdown content
    const markdownContent = document.createElement('div');
    markdownContent.className = 'markdown-content';
    markdownContent.innerHTML = marked.parse(text);
    
    messageElement.appendChild(markdownContent);
    
    // Add citations section if there are file citations
    if (annotations && annotations.length > 0) {
      const citationsContainer = document.createElement('div');
      citationsContainer.className = 'citations-container';
      
      const citationsTitle = document.createElement('p');
      citationsTitle.className = 'citations-title';
      citationsTitle.textContent = 'Sources:';
      citationsContainer.appendChild(citationsTitle);
      
      // Create a Set to track unique filenames
      const citedFiles = new Set();
      
      // Add each citation
      annotations.forEach((annotation, index) => {
        if (annotation.type === 'file_citation' && annotation.filename) {
          citedFiles.add(annotation.filename);
        }
      });
      
      // Create citation list
      if (citedFiles.size > 0) {
        const citationsList = document.createElement('ul');
        citationsList.className = 'citations-list';
        
        citedFiles.forEach(filename => {
          const citationItem = document.createElement('li');
          citationItem.className = 'citation-item';
          
          // Create an anchor element for the source
          const sourceLink = document.createElement('a');
          sourceLink.href = findSourceUrl(filename);
          sourceLink.textContent = filename;
          sourceLink.target = '_blank';
          sourceLink.rel = 'noopener noreferrer';
          sourceLink.className = 'source-link';
          
          // Add the link to the citation item
          citationItem.appendChild(sourceLink);
          citationsList.appendChild(citationItem);
        });
        
        citationsContainer.appendChild(citationsList);
        messageElement.appendChild(citationsContainer);
      }
    }
    
    messagesContainer.appendChild(messageElement);
    scrollToBottom();
  }

  function addBotLinksMessage(links) {
    // Determine if this is district search or general web search
    const isDistrictSearch = links.length > 0 && links[0].source === 'district';
    
    const message = { 
      role: 'assistant', 
      content: links.map(link => `${link.title}: ${link.link}`).join('\n') 
    };
    messages.push(message);
    
    const messageElement = document.createElement('div');
    messageElement.className = 'message bot-message';
    
    const introText = document.createElement('p');
    
    // Customize the intro text based on search type and number of links
    if (isDistrictSearch) {
      if (links.length === 1) {
        introText.textContent = 'Here is a district resource you might find useful:';
      } else {
        introText.textContent = 'Here are district resources you might find useful:';
      }
    } else {
      introText.textContent = 'Here are some results that you might find useful:';
    }
    
    messageElement.appendChild(introText);
    
    const linksContainer = document.createElement('div');
    linksContainer.className = 'link-container';
    
    // Show only the actual links (remove the source property for display)
    links.forEach(item => {
      if (item.link) {
        const linkItem = document.createElement('div');
        linkItem.className = 'link-item';
        
        const link = document.createElement('a');
        link.href = item.link;
        link.textContent = item.title;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        
        linkItem.appendChild(link);
        linksContainer.appendChild(linkItem);
      }
    });
    
    messageElement.appendChild(linksContainer);
    messagesContainer.appendChild(messageElement);
    scrollToBottom();
  }

  function showTypingIndicator() {
    typingIndicator.classList.remove('hidden');
    scrollToBottom();
  }

  function hideTypingIndicator() {
    typingIndicator.classList.add('hidden');
  }

  function scrollToBottom() {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  function renderMessages() {
    // Clear the container
    messagesContainer.innerHTML = '';
    
    // Render each message
    messages.forEach(message => {
      if (message.role === 'user') {
        const messageElement = document.createElement('div');
        messageElement.className = 'message user-message';
        messageElement.textContent = message.content;
        messagesContainer.appendChild(messageElement);
      } else if (message.role === 'assistant') {
        // Check if it's a links message (contains URL patterns)
        const linkPattern = /(.*?): (http[s]?:\/\/[^\s]+)/g;
        const isLinkMessage = linkPattern.test(message.content);
        
        if (isLinkMessage) {
          const links = [];
          let match;
          
          // Reset the regex
          linkPattern.lastIndex = 0;
          
          while ((match = linkPattern.exec(message.content)) !== null) {
            links.push({ title: match[1], link: match[2] });
          }
          
          addBotLinksMessage(links);
        } else if (message.annotations) {
          // Handle messages with citations
          addBotMessageWithCitations(message.content, message.annotations);
        } else {
          const messageElement = document.createElement('div');
          messageElement.className = 'message bot-message';
          
          // Parse markdown content
          const markdownContent = document.createElement('div');
          markdownContent.className = 'markdown-content';
          markdownContent.innerHTML = marked.parse(message.content);
          
          messageElement.appendChild(markdownContent);
          messagesContainer.appendChild(messageElement);
        }
      }
    });
    
    scrollToBottom();
  }

  // Save conversation to localStorage
  function saveConversation(messages) {
    try {
      localStorage.setItem('chatMessages', JSON.stringify(messages));
    } catch (error) {
      console.error('Error saving conversation:', error);
    }
  }

  // Add a way to clear conversation history
  window.clearChat = function() {
    messages = [];
    localStorage.removeItem('chatMessages');
    messagesContainer.innerHTML = '';
    addBotMessage("Chat history cleared. How can I help you today?");
  }
});