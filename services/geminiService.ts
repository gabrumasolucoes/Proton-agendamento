import { GoogleGenAI } from "@google/genai";
import { AiAnalysisResult, Appointment } from "../types";

// The API key is injected at build time by Vite (see vite.config.ts)
// We use a try-catch to safely fallback if something goes wrong with the replacement
const getApiKey = () => {
  try {
    return process.env.API_KEY || '';
  } catch (e) {
    return '';
  }
};

const apiKey = getApiKey();
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

// Fallback data for demo/offline purposes
const getMockAnalysis = (appointment: Appointment): AiAnalysisResult => {
  return {
    summary: `[DEMO] Análise automática para ${appointment.patientName}: O chatbot identificou sinais de interesse alto. O paciente mencionou "${appointment.notes.substring(0, 30)}...". Histórico sugere perfil detalhista.`,
    preparation: [
      "Revisar prontuário anterior (se houver)",
      "Preparar termo de consentimento para o procedimento: " + appointment.title,
      "Separar kit clínico padrão",
      "Verificar disponibilidade de retorno para semana seguinte"
    ],
    isMock: true
  };
};

export const analyzeAppointment = async (appointment: Appointment): Promise<AiAnalysisResult> => {
  if (!ai || !apiKey) {
    console.warn("API Key missing. Using mock data.");
    await new Promise(resolve => setTimeout(resolve, 1500));
    return getMockAnalysis(appointment);
  }

  const model = "gemini-2.5-flash";
  
  const prompt = `
    Atue como um assistente clínico sênior. Analise os dados do agendamento abaixo e forneça:
    1. Um resumo executivo clínico baseado nas notas do chatbot (seja direto).
    2. Uma lista de preparação sugerida para o profissional (quais materiais preparar, o que revisar no prontuário).
    
    Retorne APENAS um JSON válido.

    Dados do Agendamento:
    Paciente: ${appointment.patientName}
    Procedimento: ${appointment.title}
    Notas do Chatbot: ${appointment.notes}
    Status: ${appointment.status}
  `;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      }
    });

    const text = response.text;
    if (!text) throw new Error("Sem resposta da IA");

    return JSON.parse(text) as AiAnalysisResult;

  } catch (error) {
    console.error("Erro ao analisar agendamento:", error);
    await new Promise(resolve => setTimeout(resolve, 1000));
    return getMockAnalysis(appointment);
  }
};