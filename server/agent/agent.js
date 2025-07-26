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