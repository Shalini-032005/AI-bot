import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const OPENROUTER_API_KEY = "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";
const systemPrompt = `You are a friendly AI assistant for an electronics shop.
Answer only electronics-related questions like:
- components (resistors, ICs, Arduino, sensors)
- mobiles, laptops, chargers
- prices (estimate), availability, warranty
- suggest best products for beginners

Be short, friendly, and helpful.`;

app.post("/chat", async (req, res) => {
  try {
    const { message, history } = req.body;

    if (!message) {
      return res.status(400).json({ reply: "Message is required" });
    }

    // Convert history from Gemini format to OpenRouter format
    const messages = [];
    
    // Add system prompt
    messages.push({ role: "system", content: systemPrompt });
    
    // Add conversation history if provided
    if (history && history.length > 0) {
      history.forEach(msg => {
        if (msg.role === "user") {
          messages.push({ role: "user", content: msg.parts?.[0]?.text || msg.content });
        } else if (msg.role === "model" || msg.role === "assistant") {
          messages.push({ role: "assistant", content: msg.parts?.[0]?.text || msg.content });
        }
      });
    }
    
    // Add current user message
    messages.push({ role: "user", content: message });

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:3000",
      },
      body: JSON.stringify({
        model: "nex-agi/deepseek-v3.1-nex-n1:free",
        messages: messages
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("OpenRouter API Error:", data);
      throw new Error(data.error?.message || "OpenRouter API error");
    }

    const reply = data.choices?.[0]?.message?.content || "Sorry, something went wrong";

    res.json({
      reply: reply
    });
  } catch (error) {
    console.error("OpenRouter error:", error);
    res.status(500).json({
      reply: `Error: ${error.message || "Internal server error"}`
    });
  }
});

app.listen(3000, () => {
  console.log("✅ Server running on http://localhost:3000");
  console.log("🔌 Using OpenRouter with nex-agi/deepseek-v3.1-nex-n1:free");
});