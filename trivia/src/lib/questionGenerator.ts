import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";

// Initialize Bedrock client - uses credential chain
// Local: ~/.aws/credentials
// Docker/Production: IAM role (ECS task role, EC2 instance profile)
const bedrockClient = new BedrockRuntimeClient({
  region: process.env.AWS_REGION || "us-east-1",
});

// Use cross-region inference profile instead of direct model ID
const MODEL_ID = "us.meta.llama3-1-70b-instruct-v1:0";

const SYSTEM_PROMPT = `You are a host for a trivia game. You are being instructed to generate questions for users playing the game in a batch depending on parameters which contain the subject matter for the trivia and the difficulty and quantity. Keep the length of the question short, around 50-120 characters max. Do not output any other text besides the valid JSON array. You MUST use proper JSON syntax with double quotes around property names and string values. You should output the questions in valid JSON format as follows:

[
{
  "question": "the question text",
  "options": ["choice0", "choice1", "choice2", "choice3"],
  "correctAnswer": 2
}
]

CRITICAL JSON REQUIREMENTS:
1. Use double quotes (") for all property names and string values, not single quotes (')
2. Apostrophes (single quotes) inside double-quoted strings do NOT need escaping - just use them directly
3. Only escape these special characters: backslash (\\), double quote (\"), newline (\\n), tab (\\t)
4. Example CORRECT: "question": "What is the moon's distance from Earth?"
5. Example INCORRECT: "question": "What is the moon\\'s distance from Earth?"
6. Ensure all commas, brackets, and braces are properly placed
7. Output ONLY the JSON array - no explanatory text before or after

CRITICAL: correctAnswer MUST be a 0-based array index (0, 1, 2, or 3).
- If the first option is correct, use "correctAnswer": 0
- If the second option is correct, use "correctAnswer": 1
- If the third option is correct, use "correctAnswer": 2
- If the fourth option is correct, use "correctAnswer": 3
DO NOT use 1-based numbering (1, 2, 3, 4). Arrays start at index 0.`;

export interface GenerateQuestionsParams {
  theme: string;
  difficulty: 'easy' | 'medium' | 'hard';
  count: number;
}

export interface GeneratedQuestion {
  question: string;
  options: string[];
  correctAnswer: number;
}

/**
 * Generate trivia questions using AWS Bedrock (Llama 3.1 70B)
 */
export async function generateQuestions(
  params: GenerateQuestionsParams
): Promise<GeneratedQuestion[]> {
  const { theme, difficulty, count } = params;

  const userPrompt = `Generate ${count} trivia questions about "${theme}" with super ${difficulty} difficulty.`;

  try {
    console.log(`[QuestionGenerator] Generating ${count} questions for theme: ${theme}, difficulty: ${difficulty}`);
    
    const command = new InvokeModelCommand({
      modelId: MODEL_ID,
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify({
        prompt: `<|begin_of_text|><|start_header_id|>system<|end_header_id|>

${SYSTEM_PROMPT}<|eot_id|><|start_header_id|>user<|end_header_id|>

${userPrompt}<|eot_id|><|start_header_id|>assistant<|end_header_id|>`,
        max_gen_len: 1024,
        temperature: 0.7,
        top_p: 0.9,
      }),
    });

    const response = await bedrockClient.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    const generatedText = responseBody.generation;

    console.log('[QuestionGenerator] Raw response:', generatedText);

    // Extract JSON array from response
    const jsonMatch = generatedText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error('No JSON array found in response');
    }

    let jsonString = jsonMatch[0];
    let questions: GeneratedQuestion[];

    try {
      // Try parsing directly first (if model returned valid JSON)
      questions = JSON.parse(jsonString);
      console.log('[QuestionGenerator] Parsed JSON directly (valid format)');
    } catch (firstError) {
      console.log('[QuestionGenerator] Direct parse failed, attempting to fix JavaScript object notation...');
      
      // Fix JavaScript object notation to valid JSON
      // Replace unquoted property names with quoted ones (e.g., question: -> "question":)
      jsonString = jsonString.replace(/(\w+):/g, '"$1":');
      
      // Replace single quotes used as string delimiters with double quotes
      // This preserves apostrophes within strings by matching quoted strings specifically
      jsonString = jsonString.replace(/'([^']*)'/g, '"$1"');

      console.log('[QuestionGenerator] Cleaned JSON:', jsonString);
      questions = JSON.parse(jsonString);
    }

    // Validate questions
    if (!Array.isArray(questions) || questions.length === 0) {
      throw new Error('Invalid questions format');
    }

    // Validate each question
    questions.forEach((q, index) => {
      if (!q.question || !Array.isArray(q.options) || q.options.length !== 4 || typeof q.correctAnswer !== 'number') {
        throw new Error(`Invalid question format at index ${index}`);
      }
      if (q.correctAnswer < 0 || q.correctAnswer > 3) {
        throw new Error(`Invalid correctAnswer at index ${index}: must be 0-3`);
      }
    });

    console.log(`[QuestionGenerator] Successfully generated ${questions.length} questions`);
    return questions;

  } catch (error) {
    console.error('[QuestionGenerator] Error generating questions:', error);
    throw error;
  }
}

/**
 * Check if AWS credentials are available
 */
export async function checkAWSConnection(): Promise<boolean> {
  try {
    // Try a simple API call to verify credentials
    const command = new InvokeModelCommand({
      modelId: MODEL_ID,
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify({
        prompt: "<|begin_of_text|><|start_header_id|>user<|end_header_id|>\n\nHello<|eot_id|><|start_header_id|>assistant<|end_header_id|>",
        max_gen_len: 10,
      }),
    });
    
    await bedrockClient.send(command);
    console.log('[QuestionGenerator] AWS Bedrock connection successful');
    return true;
  } catch (error) {
    console.error('[QuestionGenerator] AWS Bedrock connection failed:', error);
    return false;
  }
}
