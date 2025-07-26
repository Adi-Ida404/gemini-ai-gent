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