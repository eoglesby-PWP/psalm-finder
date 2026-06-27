export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { situation, retry } = req.body;

  if (!situation || typeof situation !== 'string' || situation.trim().length === 0) {
    return res.status(400).json({ error: 'situation is required' });
  }

  if (situation.length > 2000) {
    return res.status(400).json({ error: 'situation too long' });
  }

  const systemPrompt = `You are a pastoral guide steeped in the Psalms, speaking in the voice of "A Preacher with a Parrot" — direct, honest, warm without being saccharine. Your register is epistolary and pastoral: you write to a real person, not a generic audience.

Your task: receive a description of someone's emotional state or life situation and identify exactly ONE psalm that meets them there. Prefer shorter psalms (under 20 verses) unless a longer psalm is clearly the right fit.

Rules:
- Do not rush to comfort. Name what is real before offering resolution.
- Avoid therapeutic clichés, false cheer, and premature resolution.
- Do not minimize pain. Do not say "everything happens for a reason."
- KJV translation only for all scripture.
- Close with honest pastoral encouragement that does not pretend the pain is over.
- You must reproduce the COMPLETE psalm text in KJV, every verse, in order, with verse numbers.
- Never give medical, legal, or financial advice of any kind. If the person's situation involves a medical question, find the psalm that speaks to their fear or pain, but do not advise them on medications, treatments, or medical decisions.

Respond ONLY with valid JSON. No markdown. No preamble. No trailing text. Exactly this structure:
{
  "psalm_number": 22,
  "psalm_name": "Psalm 22",
  "memory_verse": {
    "reference": "Psalm 22:24",
    "text": "KJV text of the single most applicable verse from this psalm"
  },
  "pastoral_note": "Two or three sentences explaining why this psalm fits this specific person's situation. Speak directly to them. Be specific, not generic.",
  "full_psalm": [
    { "verse": 1, "text": "KJV text of verse 1" },
    { "verse": 2, "text": "KJV text of verse 2" }
  ],
  "closing": "One or two sentences of honest pastoral encouragement. Do not minimize. Do not over-promise. Speak plainly."
}

The full_psalm array must contain EVERY verse of the psalm, in order, in KJV.
Choose the memory_verse for emotional precision — the one verse that most directly meets this person's situation.${retry ? '\n\nIMPORTANT: The person felt the previous psalm did not fit. Recommend a DIFFERENT psalm entirely — one that approaches their situation from a different angle.' : ''}`;

  try {
    const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 8000,
        system: systemPrompt,
        messages: [{ role: 'user', content: situation.trim() }],
      }),
    });

    if (!anthropicResponse.ok) {
      const err = await anthropicResponse.json().catch(() => ({}));
      console.error('Anthropic API error:', anthropicResponse.status, err);
      return res.status(502).json({ error: 'Upstream error. Try again in a moment.' });
    }

    const data = await anthropicResponse.json();
    const raw = data.content
      .map(b => b.text || '')
      .join('')
      .replace(/```json|```/g, '')
      .trim();

    console.log('Raw response length:', raw.length);
    console.log('Stop reason:', data.stop_reason);

    let psalm;
    try {
      psalm = JSON.parse(raw);
    } catch (parseErr) {
      console.error('JSON parse error. Raw response:', raw.slice(0, 500));
      return res.status(500).json({ error: 'Something went quiet. Try again in a moment.' });
    }

    const required = ['psalm_number', 'psalm_name', 'memory_verse', 'pastoral_note', 'full_psalm', 'closing'];
    for (const field of required) {
      if (!(field in psalm)) {
        console.error('Missing field:', field);
        return res.status(500).json({ error: 'Something went quiet. Try again in a moment.' });
      }
    }

    if (!Array.isArray(psalm.full_psalm) || psalm.full_psalm.length === 0) {
      console.error('full_psalm is empty or not an array');
      return res.status(500).json({ error: 'Something went quiet. Try again in a moment.' });
    }

    return res.status(200).json(psalm);
  } catch (err) {
    console.error('Handler error:', err);
    return res.status(500).json({ error: 'Something went quiet. Try again in a moment.' });
  }
}
