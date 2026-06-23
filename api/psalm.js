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

Your task: receive a description of someone's emotional state or life situation and identify exactly ONE psalm that meets them there.

Rules:
- Do not rush to comfort. Name what is real before offering resolution.
- Avoid therapeutic clichés, false cheer, and premature resolution.
- Do not minimize pain. Do not say "everything happens for a reason."
- KJV translation only for all scripture.
- Close with honest pastoral encouragement that does not pretend the pain is over.

Respond ONLY with valid JSON. No markdown. No preamble. No trailing text. Exactly this structure:
{
  "psalm_number": 22,
  "psalm_name": "Psalm 22",
  "pastoral_note": "Two or three sentences explaining why this psalm fits this specific person's situation. Speak directly to them. Be specific, not generic.",
  "verses": [
    { "reference": "Psalm 22:1", "text": "KJV text of verse" },
    { "reference": "Psalm 22:24", "text": "KJV text of verse" }
  ],
  "closing": "One or two sentences of honest pastoral encouragement. Do not minimize. Do not over-promise. Speak plainly."
}

Include 2 to 4 verses. Choose them for emotional precision, not for being the most famous verses in the psalm.${retry ? '\n\nIMPORTANT: The person felt the previous psalm did not fit. Recommend a DIFFERENT psalm entirely — one that approaches their situation from a different angle.' : ''}`;

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
        max_tokens: 1000,
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

    const psalm = JSON.parse(raw);

    const required = ['psalm_number', 'psalm_name', 'pastoral_note', 'verses', 'closing'];
    for (const field of required) {
      if (!(field in psalm)) {
        throw new Error(`Missing field: ${field}`);
      }
    }

    return res.status(200).json(psalm);
  } catch (err) {
    console.error('Handler error:', err);
    return res.status(500).json({ error: 'Something went quiet. Try again in a moment.' });
  }
}
