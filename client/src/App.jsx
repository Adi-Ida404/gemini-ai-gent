import { use, useState } from 'react'
import './App.css'

function App() {
  const [messages,setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [threadId] = useState(Date.now());

  const sendMessage = async() => {
    if(!inputValue.trim() || isLoading) return;

    const userMessage = {role: 'user', content: inputValue};
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);
    try{
      const response = await fetch(`${import.meta.env.VITE_API_URL}/generate`, {
        method: 'POST',
        headers:{
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: inputValue,
          threadId: threadId,
        }),
      });

      if(!response.ok){
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const assistantMessage = {
        role: 'assistant',
        content: data.content || 'No response received',
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

const handleKeyPress = (e)=> {
  if(e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
};

return (
  <div className="app">
    <div className="chat-contained">
      <div className="chat-header">
        <h1>Gemini AI Chat</h1>
        <p> Ask me anything! I can generate and execute Javascript code. </p>
      </div>

      <div className="messages-container">
        {messages.map((message, index) => (
          <div 
            key={index}
            className ={`message ${message.role === 'user' ? 'user-message' : 'assistant-message'}`}
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

export default App
