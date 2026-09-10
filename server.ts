import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "5mb" }));

// Lazy Gemini client helper
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  if (!aiClient && process.env.GEMINI_API_KEY) {
    aiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", mode: process.env.NODE_ENV });
});

// AI Evaluation and Sound Engineering Mentorship endpoint
app.post("/api/ai-evaluate", async (req, res) => {
  try {
    const {
      studentName,
      environment, // 'recording_studio' | 'live_stage'
      instruments,
      placedGear,
      connections,
      mixerChannels,
      score,
      rubricFeedback,
    } = req.body;

    const ai = getGeminiClient();
    if (!ai) {
      // Graceful fallback if no API key is set
      return res.json({
        success: true,
        isAiGenerated: false,
        feedback: {
          mentorSummary:
            score >= 90
              ? "Exceptional audio engineering layout! Your signal chain and microphone placement adhere strictly to professional recording standards."
              : score >= 75
              ? "Good foundation! You have selected great instruments and key mic lines, but review a few signal chain details like phantom power and mic stand height."
              : "Keep refining your studio plot! Ensure you have at least 4 instruments fully wired with appropriate cables, amps/DIs, and correct microphone types.",
          strengths: [
            `Selected ${instruments?.length || 0} musical sources matching the assignment requirement.`,
            `Configured ${connections?.length || 0} audio connections on the floor plot.`,
            `Mapped inputs to the ${environment === "recording_studio" ? "Studio Audio Interface" : "Live Stage Mixer"}.`,
          ],
          improvementTips: [
            "Double-check condenser mics have +48V phantom power engaged on their assigned mixer channels.",
            "Verify vocal mics have pop filters in the studio, or dynamic mics like SM58 for live stage use.",
            "Ensure electric guitars and basses run through amps or active DI boxes before reaching the interface.",
          ],
          audioPhysicsNote:
            environment === "recording_studio"
              ? "In a studio recording session, Large Diaphragm Condensers (C214/AT2020) capture rich vocal nuances and transients, while cardioid dynamic mics (SM57) handle high SPL at amplifier grilles without clipping."
              : "In a live stage setting, dynamic cardioid/supercardioid microphones (like SM58) provide superior off-axis feedback rejection against loud stage wedges and PA bleed compared to sensitive condensers.",
        },
      });
    }

    const prompt = `You are a veteran Chief Audio Recording Engineer and Music Production Professor evaluating a student's music studio / stage setup assignment.
Analyze the following student work:

Student Name: ${studentName || "Student Producer"}
Session Environment: ${environment === "recording_studio" ? "Digital Recording Studio (Isolation, High-Fidelity Capture)" : "Live Music Stage / Concert Venue (SPL Resistance, Feedback Rejection, Monitor Wedges)"}
Calculated Automated Score: ${score}/100

Selected Sources / Instruments (${instruments?.length || 0}):
${JSON.stringify(instruments, null, 2)}

Placed Gear & Microphones:
${JSON.stringify(placedGear, null, 2)}

Audio Cable Routing (1/4" and XLR lines):
${JSON.stringify(connections, null, 2)}

Mixer / Audio Interface Channel Configuration:
${JSON.stringify(mixerChannels, null, 2)}

Automated Diagnostic Findings:
${JSON.stringify(rubricFeedback, null, 2)}

Provide personalized, encouraging, and educationally rigorous feedback in JSON format. Explain the real-world audio engineering physics (e.g. dynamic vs condenser mics, SPL handling, impedance matching, +48V Phantom Power, pop filter plosive rejection, stage monitor bleed and feedback loops, mic stand boom height).

Return strictly JSON matching this structure:
{
  "mentorSummary": "A 2-3 sentence personalized greeting and holistic assessment of their setup.",
  "strengths": ["string", "string", "string"],
  "improvementTips": ["string", "string"],
  "audioPhysicsNote": "An insightful 2-3 sentence technical explanation of the physics of their mic/gear choices for this environment.",
  "gradeVerdict": "Distinction" | "Proficient" | "Developing" | "Needs Revision"
}`;

    const response = await ai.models.generateContent({
      model: "gemini-3.7-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    });

    const parsed = JSON.parse(response.text || "{}");
    return res.json({
      success: true,
      isAiGenerated: true,
      feedback: parsed,
    });
  } catch (error: any) {
    console.error("AI Evaluation error:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to generate AI feedback",
    });
  }
});

// Vite middleware & Static serving
async function setupServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`StudioPlot Server running on http://localhost:${PORT}`);
  });
}

setupServer();
