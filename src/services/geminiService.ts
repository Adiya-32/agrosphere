import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function analyzeField(context: any, question: string) {
  const model = "gemini-3-flash-preview";
  
  const prompt = `
    You are AgroSphere AI, a senior satellite data analyst.
    
    Context:
    - Location: ${context.location ? `${context.location.lat}, ${context.location.lng}` : 'Unknown'}
    - Layer: ${context.layer}
    - Time Horizon: ${context.horizon}
    
    User Question: ${question}
    
    Provide a detailed, professional analysis. If the location is provided, simulate a technical report based on typical satellite indices for that region.
  `;

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
  });

  return response.text;
}
