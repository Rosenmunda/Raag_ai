import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import connectToDatabase from "@/lib/db";
import { Plan } from "@/models/Plan";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// validate and fix workout plan to ensure it has proper numeric types
function validateWorkoutPlan(plan: any) {
  const validatedPlan = {
    schedule: Array.isArray(plan?.schedule) ? plan.schedule : [],
    exercises: Array.isArray(plan?.exercises) ? plan.exercises.map((exercise: any) => ({
      day: exercise?.day || "Unknown Day",
      routines: Array.isArray(exercise?.routines) ? exercise.routines.map((routine: any) => ({
        name: routine?.name || "Exercise",
        sets: typeof routine?.sets === "number" ? routine.sets : parseInt(routine?.sets) || 1,
        reps: typeof routine?.reps === "number" ? routine.reps : parseInt(routine?.reps) || 10,
      })) : [],
    })) : [],
  };
  return validatedPlan;
}

// validate diet plan to ensure it strictly follows schema
function validateDietPlan(plan: any) {
  // only keep the fields we want
  const validatedPlan = {
    dailyCalories: typeof plan?.dailyCalories === 'number' ? plan.dailyCalories : parseInt(plan?.dailyCalories) || 2000,
    meals: Array.isArray(plan?.meals) ? plan.meals.map((meal: any) => ({
      name: meal?.name || "Meal",
      foods: Array.isArray(meal?.foods) ? meal.foods : [],
    })) : [],
  };
  return validatedPlan;
}

export async function POST(req: Request) {
  let toolCallId = "unknown";
  try {
    const rawPayload = await req.json();
    console.log("Raw Payload is here:", rawPayload);
    
    // DEBUG: Write payload to file so we can inspect what Vapi is sending
    try {
      require('fs').appendFileSync('vapi-payload.log', JSON.stringify(rawPayload, null, 2) + '\n\n');
    } catch (e) {}

    let payload = rawPayload;
    // Handle Vapi's Tool Call format
    if (rawPayload.message && rawPayload.message.type === "tool-calls") {
      const toolCallInfo = rawPayload.message.toolWithToolCallList[0].toolCall;
      const args = toolCallInfo.function.arguments;
      payload = typeof args === "string" ? JSON.parse(args) : args;
      toolCallId = toolCallInfo.id;
    } else if (rawPayload.message && rawPayload.message.type === "function-call") {
      // Fallback for older Vapi format
      const args = rawPayload.message.functionCall.parameters;
      payload = typeof args === "string" ? JSON.parse(args) : args;
      toolCallId = rawPayload.message.functionCall.id || "unknown";
    }

    console.log("Parsed payload arguments:", payload);

    let {
      user_id,
      age,
      height,
      weight,
      injuries,
      workout_days,
      fitness_goal,
      fitness_level,
      dietary_restrictions,
    } = payload;

    // Extract user_id from variableValues if LLM didn't provide it, or if it hallucinated the template string
    if (
      !user_id ||
      user_id === "{{ user_id }}" ||
      user_id === "{{user_id}}"
    ) {
      if (rawPayload?.message?.call?.variableValues?.user_id) {
        user_id = rawPayload.message.call.variableValues.user_id;
      }
    }

    if (!user_id || user_id === "{{ user_id }}") {
      throw new Error("Missing valid user_id in payload and variableValues");
    }

    const model = genAI.getGenerativeModel({
      model: "gemini-flash-latest",
      generationConfig: {
        temperature: 0.4, // lower temperature for more predictable outputs
        topP: 0.9,
        responseMimeType: "application/json",
      },
    });

    const workoutPrompt = `You are an experienced fitness coach creating a personalized workout plan based on:
      Age: ${age}
      Height: ${height}
      Weight: ${weight}
      Injuries or limitations: ${injuries}
      Available days for workout: ${workout_days}
      Fitness goal: ${fitness_goal}
      Fitness level: ${fitness_level}
      
      As a professional coach:
      - Consider muscle group splits to avoid overtraining the same muscles on consecutive days
      - Design exercises that match the fitness level and account for any injuries
      - Structure the workouts to specifically target the user's fitness goal
      
      CRITICAL SCHEMA INSTRUCTIONS:
      - Your output MUST contain ONLY the fields specified below, NO ADDITIONAL FIELDS
      - "sets" and "reps" MUST ALWAYS be NUMBERS, never strings
      - For example: "sets": 3, "reps": 10
      - Do NOT use text like "reps": "As many as possible" or "reps": "To failure"
      - Instead use specific numbers like "reps": 12 or "reps": 15
      - For cardio, use "sets": 1, "reps": 1 or another appropriate number
      - NEVER include strings for numerical fields
      - NEVER add extra fields not shown in the example below
      
      Return a JSON object with this EXACT structure:
      {
        "schedule": ["Monday", "Wednesday", "Friday"],
        "exercises": [
          {
            "day": "Monday",
            "routines": [
              {
                "name": "Exercise Name",
                "sets": 3,
                "reps": 10
              }
            ]
          }
        ]
      }
      
      DO NOT add any fields that are not in this example. Your response must be a valid JSON object with no additional text.`;

    const workoutResult = await model.generateContent(workoutPrompt);
    const workoutPlanText = workoutResult.response.text();

    // VALIDATE THE INPUT COMING FROM AI
    let workoutPlan;
    try {
      let cleanText = workoutPlanText.replace(/```json\n?|\n?```/g, "").trim();
      const firstBrace = cleanText.indexOf('{');
      const lastBrace = cleanText.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1) {
        cleanText = cleanText.substring(firstBrace, lastBrace + 1);
      }
      workoutPlan = JSON.parse(cleanText);
    } catch (err) {
      console.error("Gemini returned invalid JSON for workout plan:", workoutPlanText);
      throw new Error("Failed to parse AI workout plan");
    }
    workoutPlan = validateWorkoutPlan(workoutPlan);

    const dietPrompt = `You are an experienced nutrition coach creating a personalized diet plan based on:
        Age: ${age}
        Height: ${height}
        Weight: ${weight}
        Fitness goal: ${fitness_goal}
        Dietary restrictions: ${dietary_restrictions}
        
        As a professional nutrition coach:
        - Calculate appropriate daily calorie intake based on the person's stats and goals
        - Create a balanced meal plan with proper macronutrient distribution
        - Include a variety of nutrient-dense foods while respecting dietary restrictions
        - Consider meal timing around workouts for optimal performance and recovery
        
        CRITICAL SCHEMA INSTRUCTIONS:
        - Your output MUST contain ONLY the fields specified below, NO ADDITIONAL FIELDS
        - "dailyCalories" MUST be a NUMBER, not a string
        - DO NOT add fields like "supplements", "macros", "notes", or ANYTHING else
        - ONLY include the EXACT fields shown in the example below
        - Each meal should include ONLY a "name" and "foods" array

        Return a JSON object with this EXACT structure and no other fields:
        {
          "dailyCalories": 2000,
          "meals": [
            {
              "name": "Breakfast",
              "foods": ["Oatmeal with berries", "Greek yogurt", "Black coffee"]
            },
            {
              "name": "Lunch",
              "foods": ["Grilled chicken salad", "Whole grain bread", "Water"]
            }
          ]
        }
        
        DO NOT add any fields that are not in this example. Your response must be a valid JSON object with no additional text.`;

    const dietResult = await model.generateContent(dietPrompt);
    const dietPlanText = dietResult.response.text();

    // VALIDATE THE INPUT COMING FROM AI
    let dietPlan;
    try {
      let cleanText = dietPlanText.replace(/```json\n?|\n?```/g, "").trim();
      const firstBrace = cleanText.indexOf('{');
      const lastBrace = cleanText.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1) {
        cleanText = cleanText.substring(firstBrace, lastBrace + 1);
      }
      dietPlan = JSON.parse(cleanText);
    } catch (err) {
      console.error("Gemini returned invalid JSON for diet plan:", dietPlanText);
      throw new Error("Failed to parse AI diet plan");
    }
    dietPlan = validateDietPlan(dietPlan);

    // save to our DB: MongoDB
    await connectToDatabase();
    
    // deactivate any active plans first
    await Plan.updateMany({ userId: user_id, isActive: true }, { isActive: false });

    const newPlan = await Plan.create({
      userId: user_id,
      dietPlan,
      isActive: true,
      workoutPlan,
      name: `${fitness_goal} Plan - ${new Date().toLocaleDateString()}`,
    });

    let responsePayload: any = {
      success: true,
      data: {
        planId: newPlan._id,
        workoutPlan,
        dietPlan,
      },
    };

    // If it's a Vapi Tool Call, respond in Vapi's required format
    if (toolCallId !== "unknown") {
      responsePayload = {
        results: [
          {
            toolCallId: toolCallId,
            result: "Successfully created fitness and diet plan! You can tell the user their plan is ready in their profile.",
          },
        ],
      };
    }

    return NextResponse.json(responsePayload, { status: 200 });
  } catch (error) {
    console.error("Error generating fitness plan:", error);

    // We should also try to send back an error result for Vapi
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        results: [
          {
            toolCallId: toolCallId !== "unknown" ? toolCallId : "unknown",
            error: "Failed to create plan due to server error.",
          },
        ],
      },
      { status: 500 }
    );
  }
}
