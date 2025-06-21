import axios from 'axios';

export class OllamaService {
  private baseUrl: string;
  private model: string;

  constructor() {
    this.baseUrl = process.env.OLLAMA_HOST || 'http://localhost:11434';
    this.model = process.env.OLLAMA_MODEL || 'llama2';
  }

  async generateResponse(query: string, context: string = ''): Promise<string | null> {
    try {
      const prompt = this.buildPrompt(query, context);
      
      const response = await axios.post(`${this.baseUrl}/api/generate`, {
        model: this.model,
        prompt,
        stream: false,
        options: {
          temperature: 0.7,
          top_p: 0.9,
          max_tokens: 500,
        }
      }, {
        timeout: 30000,
      });

      return response.data.response;

    } catch (error) {
      console.error('Ollama error:', error);
      return null;
    }
  }

  private buildPrompt(query: string, context: string = ''): string {
    return `You are an AI assistant for Oman Airports (omanairports.co.om). 
You help visitors with information about flights, facilities, services, and general airport information.

${context ? `Context: ${context}\n\n` : ''}
Visitor Question: ${query}

Please provide a helpful, accurate, and concise response. If you don't have specific information, 
suggest contacting customer support or provide general guidance.

Response:`;
  }

  async isAvailable(): Promise<boolean> {
    try {
      await axios.get(`${this.baseUrl}/api/tags`, { timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }
} 