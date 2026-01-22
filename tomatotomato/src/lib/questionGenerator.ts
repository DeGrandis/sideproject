import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";

// Initialize Bedrock client - uses credential chain
// Local: ~/.aws/credentials
// Docker/Production: IAM role (ECS task role, EC2 instance profile)
const bedrockClient = new BedrockRuntimeClient({
  region: process.env.AWS_REGION || "us-east-1",
});

// Use cross-region inference profile (required for on-demand throughput)
const MODEL_ID = "us.meta.llama3-1-70b-instruct-v1:0";

// System prompt for generating Apples to Apples style prompts
const PROMPT_GENERATOR_SYSTEM_PROMPT = `You are the host for an Apples to Apples or cards against humanity style game. Your job is to generate prompt questions for users to match their answer to. Keep prompts short, creative, and engaging (around 30-120 characters). Generate a comma-separated list of prompts.

CRITICAL OUTPUT REQUIREMENTS:
1. Output ONLY a comma-separated list of prompts
2. Each prompt should be 30-120 characters long
3. No quotes around individual prompts
4. No JSON formatting
5. No explanatory text before or after

EXAMPLES OF GOOD PROMPTS:
- What not to do on a first date
- Reasons to be late to work
- Best excuse to get out of jury duty
- Extremely Delicious
- Things That Are Broken
- Royal and Majestic
- Suspicious Characters
- Things You Find in a Garage`;

// System prompt for grading/scoring player answers
const GRADER_SYSTEM_PROMPT = `You are the judge for an Apples to Apples style game. Players submit creative text answers trying to match a given prompt. Your job is to score the answers based on how well they match the prompt and how creative/funny they are.  The players are young and immature, so expect to see some crude humor.

You will be given:
1. The prompt 
2. A list of player answers

Return a JSON array ranking the answers from best to worst fit, with scores. Score from 0 to 100 in increments of 1 for each answer

Consider:
- How raunchy or humorous the answer is
- How crude or clever the answer is
- How well the answer matches the prompt thematically
- Creativity and humor
- How memorable or impactful the answer is
- Game context (Apples to Apples values unexpected but fitting answers)

Return ONLY valid JSON:
[
{
  "answer": "the player's answer",
  "score": 85,
  "reasoning": "brief explanation why, 60 characters or less"
}
]

Output ONLY the JSON array - no explanatory text before or after.`;

export interface GeneratePromptsParams {
  theme: string;
  difficulty: 'easy' | 'medium' | 'hard';
  count: number;
}

export interface GradeAnswersParams {
  prompt: string;
  answers: string[]; // Player answers
}

export interface GradedAnswer {
  answer: string;
  score: number;
  reasoning: string;
}

/**
 * Generate Apples to Apples style prompts using AWS Bedrock (Llama 3.1 70B)
 * Returns a comma-separated list of prompts
 */
export async function generatePrompts(
  params: GeneratePromptsParams
): Promise<string[]> {
  const { theme, difficulty, count } = params;
  const maxRetries = 1;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        console.log(`[PromptGenerator] Retry attempt ${attempt} of ${maxRetries}`);
      }
      
      const prompts = await attemptGeneratePrompts(theme, difficulty, count);
      return prompts;
    } catch (error) {
      lastError = error as Error;
      console.error(`[PromptGenerator] Attempt ${attempt + 1} failed:`, error);
      
      if (attempt === maxRetries) {
        console.error('[PromptGenerator] All retry attempts exhausted');
        throw lastError;
      }
    }
  }

  throw lastError || new Error('Prompt generation failed');
}

/**
 * Single attempt to generate prompts
 */
async function attemptGeneratePrompts(
  theme: string,
  difficulty: string,
  count: number
): Promise<string[]> {
  const userPrompt = `Generate ${count} creative Apples to Apples style prompts about "${theme}" with ${difficulty} difficulty. Return only a comma-separated list.`;

  console.log(`[PromptGenerator] Generating ${count} prompts for theme: ${theme}, difficulty: ${difficulty}`);
  
  const command = new InvokeModelCommand({
    modelId: MODEL_ID,
    contentType: "application/json",
    accept: "application/json",
    body: JSON.stringify({
      prompt: `<|begin_of_text|><|start_header_id|>system<|end_header_id|>

${PROMPT_GENERATOR_SYSTEM_PROMPT}<|eot_id|><|start_header_id|>user<|end_header_id|>

${userPrompt}<|eot_id|><|start_header_id|>assistant<|end_header_id|>`,
      max_gen_len: 512,
      temperature: 0.9,
      top_p: 0.9,
    }),
  });

  const response = await bedrockClient.send(command);
  const responseBody = JSON.parse(new TextDecoder().decode(response.body));
  const generatedText = responseBody.generation.trim();

  console.log('[PromptGenerator] Raw response:', generatedText);

  // Parse comma-separated list
  const prompts = generatedText
    .split(',')
    .map((p: string) => p.trim())
    .filter((p: string) => p.length > 0);

  if (prompts.length === 0) {
    throw new Error('No prompts extracted from response');
  }

  console.log(`[PromptGenerator] Successfully generated ${prompts.length} prompts`);
  return prompts.slice(0, count); // Return only the requested count
}

/**
 * Grade/score player answers against a prompt using AWS Bedrock
 * Returns ranked answers with scores
 */
export async function gradeAnswers(
  params: GradeAnswersParams
): Promise<GradedAnswer[]> {
  const { prompt, answers } = params;
  const maxRetries = 1;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        console.log(`[Grader] Retry attempt ${attempt} of ${maxRetries}`);
      }
      
      const gradedAnswers = await attemptGradeAnswers(prompt, answers);
      return gradedAnswers;
    } catch (error) {
      lastError = error as Error;
      console.error(`[Grader] Attempt ${attempt + 1} failed:`, error);
      
      if (attempt === maxRetries) {
        console.error('[Grader] All retry attempts exhausted');
        throw lastError;
      }
    }
  }

  throw lastError || new Error('Grading failed');
}

/**
 * Single attempt to grade answers
 */
async function attemptGradeAnswers(
  prompt: string,
  answers: string[]
): Promise<GradedAnswer[]> {
  const answersList = answers.map((a, i) => `${i + 1}. ${a}`).join('\n');
  const userPrompt = `Prompt: "${prompt}"

Player answers:
${answersList}

Score each answer based on how well it matches the prompt and how creative or humorous it is, or how absurd it is.  Compare answers against each other on how relatively good they are.  `;

  console.log(`[Grader] Grading ${answers.length} answers for prompt: "${prompt}"`);
  
  const command = new InvokeModelCommand({
    modelId: MODEL_ID,
    contentType: "application/json",
    accept: "application/json",
    body: JSON.stringify({
      prompt: `<|begin_of_text|><|start_header_id|>system<|end_header_id|>

${GRADER_SYSTEM_PROMPT}<|eot_id|><|start_header_id|>user<|end_header_id|>

${userPrompt}<|eot_id|><|start_header_id|>assistant<|end_header_id|>`,
      max_gen_len: 1024,
      temperature: 0.8,
      top_p: 0.9,
    }),
  });

  const response = await bedrockClient.send(command);
  const responseBody = JSON.parse(new TextDecoder().decode(response.body));
  const generatedText = responseBody.generation;

  console.log('[Grader] Raw response:', generatedText);

  // Extract JSON array from response
  const jsonMatch = generatedText.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    throw new Error('No JSON array found in grader response');
  }

  let jsonString = jsonMatch[0];
  let gradedAnswers: GradedAnswer[];

  try {
    // Try parsing directly first
    gradedAnswers = JSON.parse(jsonString);
    console.log('[Grader] Parsed JSON directly (valid format)');
  } catch (firstError) {
    console.log('[Grader] Direct parse failed, attempting to fix JavaScript object notation...');
    
    // Fix JavaScript object notation to valid JSON
    jsonString = jsonString.replace(/(\w+):/g, '"$1":');
    jsonString = jsonString.replace(/'([^']*)'/g, '"$1"');

    console.log('[Grader] Cleaned JSON:', jsonString);
    gradedAnswers = JSON.parse(jsonString);
  }

  // Validate graded answers
  if (!Array.isArray(gradedAnswers) || gradedAnswers.length === 0) {
    throw new Error('Invalid graded answers format');
  }

  // Validate each answer
  gradedAnswers.forEach((a, index) => {
    if (!a.answer || typeof a.score !== 'number' || !a.reasoning) {
      throw new Error(`Invalid graded answer format at index ${index}`);
    }
    if (a.score < 0 || a.score > 100) {
      throw new Error(`Invalid score at index ${index}: must be 0-100, got ${a.score}`);
    }
  });

  // Sort by score descending
  gradedAnswers.sort((a, b) => b.score - a.score);

  console.log(`[Grader] Successfully graded ${gradedAnswers.length} answers`);
  return gradedAnswers;
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
