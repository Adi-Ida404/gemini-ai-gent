# Building Your First AI Agent with Google Gemini AI

This guide will help you build an AI agent that can understand requests, generate JavaScript code, and execute it safely - all using **Google Gemini AI** and free alternatives.

## What We're Building

By the end of this guide, you'll have:
- ✅ A fully functional AI agent using Google Gemini
- ✅ Code generation and execution capabilities
- ✅ Memory to maintain conversation context
- ✅ A clean React frontend
- ✅ Free deployment using Railway/Render

## Free Tech Stack

- **Google Gemini Pro** (Free tier: 15 req/min, 1M tokens/min)
- **LangGraph.js** for agent orchestration
- **Railway** or **Render** for free deployment
- **React + Vite** for frontend
- **Node.js + Express** for backend

## Prerequisites

1. Google AI Studio account (free)
2. Node.js installed
3. Basic knowledge of JavaScript/React

---

## Step 1: Get Your Google Gemini API Key

1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Click "Create API Key"
3. Copy your API key - we'll need this later

---

## Step 2: Project Setup

Create the project structure:

```bash
mkdir gemini-ai-agent
cd gemini-ai-agent

# Create folders
mkdir -p server/agent server/executor client

# Initialize package.json in each folder
cd server/agent && npm init -y
cd ../executor && npm init -y
cd ../../client && npm create vite@latest . -- --template react
```

---

## Step 3: Install Dependencies

### Agent Dependencies
```bash
cd server/agent
npm install @langchain/langgraph @langchain/core @langchain/google-genai zod express cors dotenv
```

### Executor Dependencies
```bash
cd ../executor
npm install express cors dotenv
```

### Frontend Dependencies
```bash
cd ../../client
npm install
```

---

## Step 4: Create the Basic Agent

Create `server/agent/agent.js`:

```javascript
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { MemorySaver } from '@langchain/langgraph';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

// Initialize Gemini model
const model = new ChatGoogleGenerativeAI({
  model: 'gemini-pro',
  apiKey: process.env.GOOGLE_API_KEY,
  temperature: 0.1,
});

// Weather tool (placeholder)
const weatherTool = tool(
  async ({ query }) => {
    if (query.toLowerCase().includes('san francisco')) {
      return "It's 60 degrees and foggy.";
    }
    return "It's 90 degrees and sunny.";
  },
  {
    name: 'weather',
    description: 'Get Weather in a specific city',
    schema: z.object({
      query: z.string().describe('The query to use in your search.'),
    }),
  }
);

// JavaScript executor tool
const jsExecutor = tool(
  async ({ code }) => {
    try {
      const response = await fetch(process.env.EXECUTOR_URL || 'http://localhost:3000', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code }),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      return result;
    } catch (error) {
      return {
        stdout: '',
        stderr: `Error executing code: ${error.message}`,
      };
    }
  },
  {
    name: 'run_javascript_code_tool',
    description: `Run general purpose javascript code.
This can be used to access Internet or do any computation that you need.
The output will be composed of the stdout and stderr.
The code should be written in a way that it can be executed with javascript eval in node environment.`,
    schema: z.object({
      code: z.string().describe('code to be executed'),
    }),
  }
);

// Initialize memory
const checkpointSaver = new MemorySaver();

// Create the agent
const tools = [weatherTool, jsExecutor];

export const agent = createReactAgent({
  llm: model,
  tools,
  checkpointSaver,
});
```

---

## Step 5: Create the Agent API

Create `server/agent/index.js`:

```javascript
import express from 'express';
import cors from 'cors';
import { agent } from './agent.js';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

app.use(express.json());
app.use(cors({ origin: '*' }));

app.post('/generate', async (req, res) => {
  try {
    const { prompt, thread_id } = req.body;
    
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    const result = await agent.invoke(
      {
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      },
      { configurable: { thread_id: thread_id || 'default' } }
    );

    const response = result.messages.at(-1)?.content || 'No response generated';
    res.json({ content: response });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'OK' });
});

app.listen(port, () => {
  console.log(`Agent API listening on port ${port}`);
});
```

---

## Step 6: Create the Code Executor

Create `server/executor/index.js`:

```javascript
import express from 'express';
import dotenv from 'dotenv';

dotenv.config();

async function evalAndCaptureOutput(code) {
  const oldLog = console.log;
  const oldError = console.error;
  let output = [];
  let errorOutput = [];

  console.log = (...args) => output.push(args.join(' '));
  console.error = (...args) => errorOutput.push(args.join(' '));

  try {
    // Add some safety measures
    if (code.includes('process.exit') || 
        code.includes('require(') || 
        code.includes('import ') ||
        code.includes('eval(')) {
      throw new Error('Potentially dangerous code detected');
    }

    await eval(code);
  } catch (error) {
    errorOutput.push(error.message);
  }

  console.log = oldLog;
  console.error = oldError;

  return { 
    stdout: output.join('\n'), 
    stderr: errorOutput.join('\n') 
  };
}

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

app.post('/', async (req, res) => {
  try {
    const { code } = req.body;
    
    if (!code) {
      return res.status(400).json({ error: 'Code is required' });
    }

    const result = await evalAndCaptureOutput(code);
    res.json(result);
  } catch (error) {
    res.status(500).json({ 
      stdout: '', 
      stderr: `Execution error: ${error.message}` 
    });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'OK' });
});

app.listen(port, () => {
  console.log(`JS Executor app listening on port ${port}`);
});
```

---

## Step 7: Create Environment Files

Create `server/agent/.env`:
```env
GOOGLE_API_KEY=your_google_gemini_api_key_here
EXECUTOR_URL=http://localhost:3000
```

Create `server/executor/.env`:
```env
PORT=3000
```

---

## Step 8: Build the Frontend

Replace `client/src/App.jsx` with:

```jsx
import { useState } from 'react';
import './App.css';

function App() {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [threadId] = useState(Date.now()); // Simple thread ID

  const sendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage = { role: 'user', content: inputValue };
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: inputValue,
          thread_id: threadId,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const assistantMessage = { 
        role: 'assistant', 
        content: data.content || 'No response received' 
      };
      
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error:', error);
      const errorMessage = { 
        role: 'assistant', 
        content: `Error: ${error.message}` 
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="app">
      <div className="chat-container">
        <div className="chat-header">
          <h1>🤖 Gemini AI Agent</h1>
          <p>Ask me anything! I can generate and execute JavaScript code.</p>
        </div>
        
        <div className="messages-container">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`message ${message.role === 'user' ? 'user-message' : 'assistant-message'}`}
            >
              <div className="message-content">
                {message.content}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="message assistant-message">
              <div className="message-content loading">
                Thinking...
              </div>
            </div>
          )}
        </div>

        <div className="input-container">
          <textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask me to calculate something, fetch data, or solve a problem..."
            disabled={isLoading}
          />
          <button onClick={sendMessage} disabled={isLoading || !inputValue.trim()}>
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;
```

Replace `client/src/App.css` with:

```css
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  background: #0a0a0a;
  color: #ffffff;
  line-height: 1.6;
}

.app {
  min-height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 20px;
}

.chat-container {
  width: 100%;
  max-width: 1024px;
  height: 80vh;
  background: #1a1a1a;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  border: 1px solid #333;
}

.chat-header {
  padding: 24px;
  border-bottom: 1px solid #333;
  text-align: center;
}

.chat-header h1 {
  font-size: 24px;
  margin-bottom: 8px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.chat-header p {
  color: #888;
  font-size: 14px;
}

.messages-container {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  scroll-behavior: smooth;
}

.message {
  margin-bottom: 16px;
  display: flex;
}

.user-message {
  justify-content: flex-end;
}

.assistant-message {
  justify-content: flex-start;
}

.message-content {
  max-width: 70%;
  padding: 12px 16px;
  border-radius: 12px;
  white-space: pre-wrap;
  word-wrap: break-word;
}

.user-message .message-content {
  background: #667eea;
  color: white;
}

.assistant-message .message-content {
  background: #2a2a2a;
  color: #e0e0e0;
  border: 1px solid #333;
}

.loading {
  opacity: 0.7;
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 0.7; }
  50% { opacity: 1; }
}

.input-container {
  padding: 20px;
  border-top: 1px solid #333;
  display: flex;
  gap: 12px;
}

textarea {
  flex: 1;
  background: #2a2a2a;
  border: 1px solid #444;
  border-radius: 8px;
  padding: 12px;
  color: #fff;
  font-size: 14px;
  resize: none;
  min-height: 50px;
  font-family: inherit;
}

textarea:focus {
  outline: none;
  border-color: #667eea;
}

textarea::placeholder {
  color: #888;
}

button {
  background: #667eea;
  color: white;
  border: none;
  border-radius: 8px;
  padding: 12px 24px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: background 0.2s;
}

button:hover:not(:disabled) {
  background: #5a67d8;
}

button:disabled {
  background: #444;
  cursor: not-allowed;
  opacity: 0.6;
}

/* Scrollbar styling */
.messages-container::-webkit-scrollbar {
  width: 6px;
}

.messages-container::-webkit-scrollbar-track {
  background: #1a1a1a;
}

.messages-container::-webkit-scrollbar-thumb {
  background: #444;
  border-radius: 3px;
}

.messages-container::-webkit-scrollbar-thumb:hover {
  background: #555;
}
```

Create `client/.env`:
```env
VITE_API_URL=http://localhost:3001
```

---

## Step 9: Test Locally

1. **Start the executor:**
```bash
cd server/executor
node index.js
```

2. **Start the agent API:**
```bash
cd server/agent
node index.js
```

3. **Start the frontend:**
```bash
cd client
npm run dev
```

4. **Test it out!**
   - Open http://localhost:5173
   - Try: "What's the weather in San Francisco?"
   - Try: "Calculate the sum of numbers from 1 to 100"
   - Try: "Generate a random number and tell me if it's prime"

---

## Step 10: Free Deployment Options

### Option A: Railway (Recommended)

1. Create account at [Railway](https://railway.app)
2. Install Railway CLI: `npm install -g @railway/cli`
3. Create `railway.json` in project root:

```json
{
  "deploy": {
    "numReplicas": 1,
    "restartPolicyType": "ON_FAILURE"
  }
}
```

4. Deploy each service:
```bash
# Deploy executor
cd server/executor
railway login
railway init
railway up

# Deploy agent
cd ../agent
railway init
railway up

# Deploy frontend
cd ../../client
npm run build
railway init
railway up
```

### Option B: Render

1. Create account at [Render](https://render.com)
2. Connect your GitHub repo
3. Create 3 services:
   - Web Service for agent (server/agent)
   - Web Service for executor (server/executor)  
   - Static Site for frontend (client/dist)

---

## Step 11: Environment Variables for Production

Set these in your deployment platform:

**Agent Service:**
- `GOOGLE_API_KEY`: Your Gemini API key
- `EXECUTOR_URL`: URL of your deployed executor service

**Frontend:**
- `VITE_API_URL`: URL of your deployed agent service

---

## Testing Your Agent

Try these example prompts:

1. **Simple calculation:** "What's 15 * 37?"
2. **Data fetching:** "Get the current Bitcoin price"
3. **Array operations:** "Create an array of 10 random numbers and sort them"
4. **API calls:** "Fetch a random joke from the internet"
5. **Data processing:** "Generate 5 random colors in hex format"

---

## Key Differences from Original

✅ **Google Gemini** instead of Anthropic Claude
✅ **Railway/Render** instead of Genezio (free alternatives)
✅ **Simplified deployment** with multiple free options
✅ **Enhanced error handling** for production use
✅ **Safety measures** in code execution

---

## Next Steps

- Add more tools (database access, file operations)
- Implement user authentication
- Add rate limiting
- Create more sophisticated memory management
- Add code syntax highlighting in the UI

---

## Troubleshooting

**Common issues:**

1. **API key errors:** Make sure your Google AI Studio API key is correct
2. **CORS issues:** Ensure your frontend URL is allowed in your backend
3. **Memory issues:** The free tier has limitations - monitor your usage
4. **Code execution failures:** Check the executor logs for detailed errors

Happy coding! 🚀
