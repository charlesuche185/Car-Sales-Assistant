import { Router, type IRouter } from "express";
import { inventory } from "@workspace/car-inventory";

type ChatTurn = {
  role: "user" | "assistant";
  content: string;
};

type ChatRequest = {
  message?: unknown;
  history?: unknown;
};

const router: IRouter = Router();
const allowedActions = new Set([
  "Browse Cars",
  "Cars Under ₦20M",
  "Financing",
  "Book a Test Drive",
  "Talk to Sales",
  "Start Financing Enquiry",
  "Ask about Financing",
]);
const inventoryIds = new Set(inventory.map((vehicle) => vehicle.id));

const systemPrompt = `You are AutoAssist AI, an AI sales assistant for a car dealership demo.
Your job is to help customers find vehicles, compare the sample inventory, answer vehicle questions, qualify serious buyers, and guide customers toward speaking with a salesperson or booking a test drive.
Use ONLY the supplied inventory data. Never invent vehicle information. All inventory is demonstration data.
Keep responses short, friendly, professional, and suitable for a Nigerian car dealership customer.
Never give professional financial advice, claim connection to a real dealership, or expose technical details.
If the inventory cannot answer a question, say that a salesperson can provide more information.
When a customer is ready to buy, offer Talk to Sales or Book a Test Drive.
Remember details from the conversation history, including budget, preferred make, body-style needs, vehicle interest, and financing intent.

Return ONLY valid JSON in this exact shape:
{"text":"short customer-facing answer","vehicleIds":["known-inventory-id"],"actions":["allowed-action"]}
vehicleIds must contain only IDs from the supplied inventory. Use an empty array when no vehicle cards are needed.
actions must contain only these labels: Browse Cars, Cars Under ₦20M, Financing, Book a Test Drive, Talk to Sales, Start Financing Enquiry, Ask about Financing.

SUPPLIED SAMPLE INVENTORY:
${JSON.stringify(inventory)}`;

function isChatTurn(value: unknown): value is ChatTurn {
  if (!value || typeof value !== "object") return false;
  const turn = value as Record<string, unknown>;
  return (
    (turn.role === "user" || turn.role === "assistant") &&
    typeof turn.content === "string" &&
    turn.content.trim().length > 0
  );
}

function fallbackPayload() {
  return { mode: "demo" as const };
}

function sanitizePayload(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const payload = value as Record<string, unknown>;
  if (typeof payload.text !== "string" || !payload.text.trim()) return null;

  const vehicleIds = Array.isArray(payload.vehicleIds)
    ? payload.vehicleIds.filter(
        (id): id is string => typeof id === "string" && inventoryIds.has(id),
      )
    : [];
  const actions = Array.isArray(payload.actions)
    ? payload.actions.filter(
        (action): action is string =>
          typeof action === "string" && allowedActions.has(action),
      )
    : [];

  return {
    mode: "ai" as const,
    text: payload.text.trim(),
    vehicleIds,
    actions,
  };
}

router.post("/ai/chat", async (req, res) => {
  const body = req.body as ChatRequest;
  const message = typeof body.message === "string" ? body.message.trim() : "";
  const history = Array.isArray(body.history)
    ? body.history.filter(isChatTurn).slice(-12)
    : [];

  if (!message) {
    res.status(400).json({ error: "Message is required." });
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    res.json(fallbackPayload());
    return;
  }

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
        max_completion_tokens: 700,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          ...history.map((turn) => ({ role: turn.role, content: turn.content })),
          { role: "user", content: message },
        ],
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      res.json(fallbackPayload());
      return;
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: unknown } }>;
    };
    const content = data.choices?.[0]?.message?.content;
    if (typeof content !== "string") {
      res.json(fallbackPayload());
      return;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      res.json(fallbackPayload());
      return;
    }

    const sanitized = sanitizePayload(parsed);
    res.json(sanitized ?? fallbackPayload());
  } catch {
    res.json(fallbackPayload());
  }
});

export default router;