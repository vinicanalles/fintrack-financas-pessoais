import { GoogleGenAI } from "@google/genai";

const API_KEY = process.env.GEMINI_API_KEY || '';

export async function getFinancialAdvice(transactions: any[], goals: any[]) {
  if (!API_KEY) {
    throw new Error("GEMINI_API_KEY não configurada.");
  }

  const ai = new GoogleGenAI({ apiKey: API_KEY });
  
  const prompt = `
    Você é um consultor financeiro pessoal especializado em ajudar brasileiros a gerenciarem melhor seu dinheiro.
    Analise as seguintes transações e metas do usuário e forneça 3 dicas práticas e personalizadas.
    
    Transações Recentes:
    ${transactions.map(t => `- ${t.date}: ${t.description || t.category} (${t.type === 'income' ? 'Entrada' : 'Saída'}) - R$ ${t.amount}`).join('\n')}
    
    Metas Atuais:
    ${goals.map(g => `- ${g.title}: R$ ${g.currentAmount} de R$ ${g.targetAmount}`).join('\n')}
    
    Responda em formato Markdown, com um tom encorajador e profissional.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });
    return response.text;
  } catch (error) {
    console.error("Erro ao chamar Gemini:", error);
    throw error;
  }
}
