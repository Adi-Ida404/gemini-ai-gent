const { ChatGoogleGenerativeAI } = require("@langchain/google-genai");

dotenv.config();

const model = new ChatGoogleGenerativeAI({
    apiKey: process.env.GOOGLE_GENAI_API_KEY,
    model: "gemini-pro",
    temperature: 0.1
});

// Weather tool (placeholder)
const weatherTool = tool(
    async({query}) => {
        if(query.toLowerCase().includes('san francisco')){
            return "It's 60 degrees and foggy.";
        }
        return "It's 90 degrees and sunny.";
    },
    {
        name: "weather",
        description: "Get Weather in a specific city",
        schema: z.object({
            query: z.string().describe('The query to use in your search.'),
        }),
    }
);

