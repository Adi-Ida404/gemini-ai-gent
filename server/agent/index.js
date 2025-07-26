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