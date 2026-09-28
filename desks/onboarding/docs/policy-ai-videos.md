# Policy briefing videos

Each **Policies & Compliance** learning item embeds a short briefing video from
`public/policy-briefings/{itemId}.mp4`.

Flow for members:

1. Watch the briefing video on the card  
2. Open the full policy PDF/DOCX  
3. Mark the item done  
4. Complete the section declaration when all items are done  

## Regenerate videos

```bash
# Needs ffmpeg (script defaults to /tmp/ffmpeg-7.0.2-amd64-static/ffmpeg)
python3 scripts/generate-policy-videos.py
```

Edit slide copy in `scripts/generate-policy-videos.py`, then re-run.

## Paths

| Item | Video |
|------|-------|
| `2-1` Staff handbook | `/policy-briefings/2-1.mp4` |
| `2-2` HR policy | `/policy-briefings/2-2.mp4` |
| `2-3` Uniform | `/policy-briefings/2-3.mp4` |
| `2-4` No cash | `/policy-briefings/2-4.mp4` |
| `2-5` Child protection | `/policy-briefings/2-5.mp4` |
| `2-6` Tech policy | `/policy-briefings/2-6.mp4` |
| `2-7` Data privacy | `/policy-briefings/2-7.mp4` |
| `2-8` Code of conduct | `/policy-briefings/2-8.mp4` |
| `2-18` NDA | `/policy-briefings/2-18.mp4` |

Wiring: `src/lib/policy-briefings.ts` → `PolicyBriefing` panel on `DocumentCard`.
