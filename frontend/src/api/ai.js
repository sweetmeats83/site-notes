export const aiApi = {
  chat: async (messages, model, onChunk) => {
    const useStream = typeof onChunk === 'function';

    const res = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, model, stream: useStream }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${res.status}`);
    }

    if (useStream) {
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let full = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        // Parse SSE lines
        for (const line of chunk.split('\n')) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6);
          if (data === '[DONE]') return full;
          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta?.content || '';
            if (delta) { full += delta; onChunk(delta, full); }
          } catch (_) {}
        }
      }
      return full;
    }

    const data = await res.json();
    return data.choices?.[0]?.message?.content || '';
  },

  project: async (projectId, prompt, chatMessages) => {
    const body = chatMessages?.length
      ? { projectId, chatMessages }
      : { projectId, prompt };
    const res = await fetch('/api/ai/project', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json(); // { text, firstUserMessage? }
  },

  briefing: async () => {
    const res = await fetch('/api/ai/briefing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    const data = await res.json();
    return data.text || '';
  },

  transcribe: async (audioBlob, fileName = 'recording.webm') => {
    const form = new FormData();
    form.append('audio', audioBlob, fileName);

    const res = await fetch('/api/transcribe', { method: 'POST', body: form });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    const data = await res.json();
    return data.text || '';
  },
};
