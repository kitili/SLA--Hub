#!/usr/bin/env python3
"""
Generate ~3-minute narrated policy briefing MP4s into public/policy-briefings/.

Content is scraped from official policy PDFs/DOCX (see .tmp/policy-extracts/).
Speech pace ≈ 145 wpm → ~3 minutes ≈ 420–450 spoken words per video.
"""

from __future__ import annotations

import asyncio
import json
import socket
import subprocess
from pathlib import Path

import edge_tts
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "public" / "policy-briefings"
FFMPEG = Path("/tmp/ffmpeg-7.0.2-amd64-static/ffmpeg")
FFPROBE = Path("/tmp/ffmpeg-7.0.2-amd64-static/ffprobe")
VOICE = "en-US-JennyNeural"
# Slightly slower speech helps land near 3 minutes with dense policy content.
SPEECH_RATE = "-15%"
CONTENT_PATH = Path(__file__).with_name("policy-briefings-content.json")
EXPANSIONS_PATH = Path(__file__).with_name("policy-briefing-expansions.json")

# Prefer IPv4 — edge-tts sometimes fails on broken IPv6 routes.
_orig_getaddrinfo = socket.getaddrinfo


def _getaddrinfo_ipv4(host, port, family=0, type=0, proto=0, flags=0):
    return _orig_getaddrinfo(host, port, socket.AF_INET, type, proto, flags)


socket.getaddrinfo = _getaddrinfo_ipv4

BG = (15, 39, 68)
ACCENT = (11, 107, 203)
WHITE = (248, 250, 252)
MUTED = (182, 197, 216)
GOLD = (232, 185, 49)
W, H = 1280, 720
MIN_SLIDE_SECONDS = 3.2
PAD_AFTER_SPEECH = 0.7

# Each briefing: intro + many chapters + close. Spoken text drives duration.
# Display title can differ slightly from TTS (TTS uses spaced acronyms).
BRIEFINGS = [
    {
        "id": "2-1",
        "title": "Staff handbook",
        "intro": (
            "This is your three-minute briefing on the Silverleaf Employee Handbook, "
            "the code of conduct for terms and conditions of service. It applies to every "
            "staff member. The full handbook remains the official authority — this video "
            "highlights the major points you must know from day one."
        ),
        "chapters": [
            ("Who it covers", "The handbook sets organisation rules, office policies, and employment information for Silverleaf Academy Limited. Managers may issue supplementary instructions, but Silverleaf interprets and applies the handbook."),
            ("Ethical conduct", "Silverleaf expects ethical conduct in all dealings. You must follow the letter and spirit of laws and regulations. Violations can lead to discipline, up to termination."),
            ("Your daily duty", "Maintain good conduct, attendance, performance, and cooperation. You are responsible for understanding this handbook and staying up to date with Silverleaf policies."),
            ("Managers' role", "Managers must communicate these principles, lead by example, give clear guidance, and make advice freely available."),
            ("Written employment only", "Every role starts with a written job offer and contract. Silverleaf does not recognise verbal employment promises. Probation begins after you sign."),
            ("Hours and attendance", "Know your hours of work, attendance expectations, and health and safety duties. Reliable attendance protects learners and teammates."),
            ("Pay and benefits", "Salary payments, benefits, advances, loans, overtime, leave, and travel reimbursement follow handbook rules — not informal campus shortcuts."),
            ("Leaving Silverleaf", "Retirement, termination, and resignation have defined processes, including how benefits are treated when employment ends."),
            ("Conduct and confidentiality", "Misconduct is judged on facts. Confidentiality and harassment rules protect staff, families, and Silverleaf's reputation."),
            ("Growth at work", "Performance management and professional learning are part of your journey. Use them to improve, not only when something goes wrong."),
        ],
        "close": "Open the full Staff Handbook next, skim the sections that match your role, then mark this learning item done.",
    },
    {
        "id": "2-2",
        "title": "HR policy manual",
        "intro": (
            "This three-minute briefing covers the Silverleaf Academy Human Resource Policy Manual for twenty twenty-six. "
            "It sets fair, consistent employment terms across campuses, aligned with Tanzanian labour law, "
            "Silverleaf values, child safeguarding, and staff wellbeing."
        ),
        "chapters": [
            ("Compliance", "Every employee must read, understand, comply with, and promote this manual. Failure to comply may be misconduct and can lead to disciplinary action."),
            ("Code of conduct", "Show professionalism and integrity. Treat colleagues, parents, and students with respect. Keep confidentiality. Avoid discrimination, harassment, and bullying. Protect assets and reputation."),
            ("Hiring is merit-based", "Recruitment is transparent: workforce planning, advertising, screening, interviews, references, qualification checks, child safeguarding screening, then offer. Appointments are based on merit and organisational need."),
            ("Onboarding pack", "You should receive a signed contract, job description, staff code of conduct, child protection code, technology policy, and orientation checklist."),
            ("Personal files", "Employee personal files are confidential. Keep your details accurate so payroll and statutory records stay correct."),
            ("Payroll", "Payroll and consultancy payments follow official processes. Do not invent local payment arrangements."),
            ("Time and leave", "Working hours, attendance, and leave are managed through official systems. Request leave the proper way."),
            ("Performance", "Performance management and professional development support growth. Engage honestly in reviews and learning."),
            ("Safeguarding and tech", "Child protection and safeguarding sit alongside technology use and data protection. H R rules reinforce, not replace, those policies."),
            ("Discipline and exit", "Disciplinary, grievance, separation, and exit processes exist so issues are handled fairly. Conflict of interest must be declared. Health, safety, and wellbeing matter at work."),
        ],
        "close": "Open the full H R Policy Manual, note who you contact for people questions, then mark this item done.",
    },
    {
        "id": "2-3",
        "title": "Uniform policy",
        "intro": (
            "This three-minute briefing covers Silverleaf's staff uniform policy. "
            "The goal is clear identification: staff who serve customers, learners, and partners "
            "must be recognisable as Silverleaf while on duty."
        ),
        "chapters": [
            ("Who must wear uniform", "Employees in service and delivery roles must wear the company-designated uniform whenever working and representing Silverleaf Academy."),
            ("Staff I D always", "All employees must wear their official staff identification badge at all times on school premises."),
            ("Issuance", "New employees receive two uniforms on hire, sign for them on receipt, and understand uniforms remain Silverleaf property."),
            ("Return on exit", "Uniforms must be returned on termination or when requested. Treat them as school assets, not personal clothing."),
            ("Weekday schedule", "Follow the official Monday to Friday shirt schedule: Monday white, Tuesday blue, Wednesday white, then the scheduled shirts for Thursday and Friday."),
            ("How to wear it", "Wear the correct shirt with the approved trousers or skirt combination specified in the policy. Keep dress neat and professional."),
            ("Why it exists", "Uniform and badge rules build trust with families, help security recognise authorised adults, and present one Silverleaf brand."),
            ("Ask before changing", "Do not invent your own dress code. If you need an exception, ask your campus lead before wearing something else."),
            ("Daily check", "Before you start each day: correct shirt colour, tidy appearance, and badge visible."),
            ("Representing Silverleaf", "Whenever you meet parents, learners, or partners on duty, you are the face of the Academy — dress accordingly."),
        ],
        "close": "Open the full Uniform Policy, confirm what you will wear on day one, then mark this item done.",
    },
    {
        "id": "2-4",
        "title": "No cash policy",
        "intro": (
            "This three-minute briefing is Silverleaf Academy's no-cash policy reminder to all staff. "
            "The school runs a strictly no-cash system so the public can trust our accounting."
        ),
        "chapters": [
            ("The hard rule", "Employees may not accept any kind of cash from parents, students, vendors, or any other stakeholder."),
            ("Why it matters", "Accurate, reliable accounting protects public trust in Silverleaf. Cash creates risk of loss, disputes, and misuse."),
            ("Signs are posted", "Signs around the building advise the public of the no-cash policy. Point people to those signs if needed."),
            ("If offered cash", "Politely refuse. Explain that Silverleaf does not accept cash and guide them to the official payment channel."),
            ("No exceptions for convenience", "Do not hold cash temporarily as a favour. Temporary holding still breaks the policy."),
            ("Vendors too", "The rule covers vendors and other stakeholders, not only school fees from parents."),
            ("Report pressure", "If anyone pressures you to take cash, report it to your manager or finance contact immediately."),
            ("Protect yourself", "Following this policy protects you personally as much as it protects the school."),
            ("Official channels only", "All money for school business must move through approved official payment routes."),
            ("Be consistent", "Every campus and every role follows the same no-cash rule — no local shortcuts."),
        ],
        "close": "Open the No Cash Policy reminder, practise how you will refuse a cash offer, then mark this item done.",
    },
    {
        "id": "2-5",
        "title": "Child protection policy",
        "intro": (
            "This three-minute briefing covers child protection expectations at Silverleaf Academy. "
            "Every adult shares responsibility for a safe, positive environment for pupils."
        ),
        "chapters": [
            ("Equal respect", "Treat all children equally, with respect and dignity. Prioritise each child's welfare."),
            ("Feedback and behaviour", "Give constructive feedback, not harsh criticism. Use only Silverleaf-mandated behaviour management techniques."),
            ("Trust and modelling", "Build balanced, trusting relationships. Be an excellent role model — do not smoke or drink while responsible for children."),
            ("Physical boundaries", "Keep a safe, appropriate distance. Use physical force only as reasonable restraint, with minimum force for the shortest time."),
            ("Open environments", "Work in open environments. Avoid private or unobserved situations. No secrets with children."),
            ("One-to-one meetings", "Hold confidential one-to-one meetings in a room with an open door or visual access, or with another adult nearby."),
            ("Transport and media", "Get parental consent before transporting a child in your car. Collect photos or media only through approved procedures."),
            ("Unknown adults", "Question any adult on premises who is not in uniform or badged and escorted."),
            ("Never do this", "Never hit or abuse a child, form sexual or exploitative relationships, use inappropriate language, or place a child at risk."),
            ("Report concerns", "If you see or hear something worrying, report through the official safeguarding route. Do not investigate alone, and never promise secrecy."),
        ],
        "close": "Open the full Child Protection Policy, note your reporting route, then mark this item done.",
    },
    {
        "id": "2-6",
        "title": "ICT use policy",
        "intro": (
            "This three-minute briefing covers the Silverleaf Academy Technology Policy from January twenty twenty-five. "
            "It sets acceptable use of I C T resources for staff, students, and other users."
        ),
        "chapters": [
            ("Purpose", "Technology must be used responsibly and ethically to support education and school operations."),
            ("What counts as resources", "Devices include laptops, tablets, phones, printers, and school SIM cards. Network means LAN, Wi-Fi, and internet. Software includes licensed tools like Canva, PowerSchool, and ClassDojo."),
            ("Acceptable use", "Use school technology for educational and company-support purposes. Personal use must be minimal and must not interfere with school work."),
            ("Account security", "You are accountable for your accounts. Keep passwords secure. Sharing accounts is prohibited."),
            ("Respectful digital talk", "All digital communication must be professional. Bullying, harassment, or inappropriate language is forbidden."),
            ("Software installs", "Only authorised personnel may install software on school devices. Do not install unapproved apps."),
            ("Data protection", "Handle sensitive information securely. Do not bypass security or access restricted systems."),
            ("Internet with care", "Internet use supports research and learning. Learners access the internet only under teacher supervision."),
            ("Training matters", "Professional development keeps staff skilled. Ask for support when a tool is unclear — do not invent unsafe workarounds."),
            ("Report incidents", "Report lost devices, phishing, or suspected breaches to I T immediately so systems stay safe."),
        ],
        "close": "Open the full Tech Policy, secure your passwords, then mark this learning item done.",
    },
    {
        "id": "2-7",
        "title": "Data privacy policy",
        "intro": (
            "This three-minute briefing covers Silverleaf's Data Protection and Confidentiality Policy. "
            "The Academy protects privacy, confidentiality, integrity, and security of information about "
            "employees, students, parents, and partners."
        ),
        "chapters": [
            ("Who it binds", "This policy applies to employees, directors, consultants, interns, volunteers, temporary staff, and third parties acting for Silverleaf."),
            ("Where data lives", "It covers electronic systems, paper records, email, audio and video, photos, cloud storage, mobiles, and removable drives."),
            ("Types of information", "Organisational data includes budgets and plans. Personal data includes names and contacts. Sensitive data includes payroll, medical, safeguarding, and disciplinary records."),
            ("Core principles", "Collect lawfully and fairly, only what is needed, for clear purposes. Keep it accurate, protect it, retain it only as long as necessary, and dispose of it securely."),
            ("Why we collect", "Silverleaf collects data for employment, payroll, admissions, academics, safeguarding, performance, leave, emergencies, and parent communication."),
            ("Need to know", "Share personal data only when your role requires it, and only with people who need to know."),
            ("No public gossip", "Do not discuss learner or staff private details in corridors, WhatsApp groups, or social media."),
            ("Approved systems", "Store files in approved systems — not on open USBs or personal email."),
            ("Photos need permission", "Images and videos of learners need the right permissions before sharing."),
            ("Report mistakes fast", "If data is exposed by accident, report it immediately. Silence makes harm worse."),
        ],
        "close": "Open the full Data Protection and Confidentiality Policy, then mark this item done.",
    },
    {
        "id": "2-8",
        "title": "Staff Code of Conduct",
        "intro": (
            "This three-minute briefing is the Child Protection Staff Code of Conduct — the practical behaviours "
            "that keep adult–learner relationships safe at Silverleaf."
        ),
        "chapters": [
            ("Must-do basics", "Treat children equally and with dignity. Prioritise welfare. Use mandated behaviour techniques and constructive feedback."),
            ("Be a role model", "Do not smoke or drink while responsible for children. Build trust without favouritism."),
            ("Physical contact", "Know limits of physical contact. Use restraint only when necessary, with minimum force for the shortest time."),
            ("Stay calm and record", "In incidents, stay calm, get colleague support, and write the incident down immediately afterwards."),
            ("First aid and comfort", "Give emergency first aid when needed, document it, and escalate so caregivers are informed. Comfort distressed children appropriately."),
            ("Visibility", "Work in open spaces. Prefer rooms with visual access for one-to-ones. Avoid secrets."),
            ("Transport and media", "Parental consent is required before transporting a child. Media collection follows procedure only."),
            ("Challenge unknowns", "Ask about unbadged or unescorted adults on site."),
            ("Hard prohibitions", "Never assault a child, form sexual or exploitative relationships, use provocative language or behaviour, or take part in unsafe practices."),
            ("Speak up", "If another adult's behaviour worries you, report it. Protecting children comes first."),
        ],
        "close": "Open the full Staff Code of Conduct, compare it to your daily routines, then mark this item done.",
    },
    {
        "id": "2-18",
        "title": "Confidentiality / NDA",
        "intro": (
            "This three-minute briefing covers Silverleaf's Non-Disclosure and Confidentiality Agreement. "
            "You must not misuse confidential information during your time at Silverleaf or afterwards."
        ),
        "chapters": [
            ("The prohibition", "You must not use, disclose, share, or make accessible confidential information to any person unless authorised or required for supervised learning."),
            ("What is confidential", "Confidential information includes business and financial affairs of Silverleaf, customers, employees, affiliates, suppliers, students, and parents."),
            ("Business methods", "It includes prices, fees, product development, marketing, advertising, budgets, and financial information."),
            ("People data", "Information about parents, teachers, students, and employees is confidential."),
            ("Agreements and plans", "Details of company agreements, future projects, promotions, publicity plans, and business plans are confidential."),
            ("Harm test", "Any information that could adversely affect Silverleaf's business or interests is confidential."),
            ("After you leave", "Confidentiality continues after internship, placement, or employment ends."),
            ("Requests from outsiders", "If someone asks for confidential information, do not comment — refer them to management immediately."),
            ("Consequences", "Unauthorised disclosure is serious. It can end your placement or employment and may lead to legal action for loss and damages."),
            ("Default rule", "When unsure whether something is confidential, treat it as confidential and ask before sharing."),
        ],
        "close": "Open the full Non-Disclosure agreement, mark this item done, then complete your policy declaration.",
    },
]


def font(size: int):
    for path in (
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ):
        if Path(path).exists():
            try:
                return ImageFont.truetype(path, size=size)
            except OSError:
                continue
    return ImageFont.load_default()


FONT_TITLE = font(48)
FONT_BODY = font(32)
FONT_SMALL = font(26)
FONT_BADGE = font(22)


def wrap(draw: ImageDraw.ImageDraw, text: str, fnt, max_width: int) -> list[str]:
    words = text.split()
    lines: list[str] = []
    current = ""
    for word in words:
        trial = f"{current} {word}".strip()
        if draw.textlength(trial, font=fnt) <= max_width:
            current = trial
        else:
            if current:
                lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines or [text]


def base_slide():
    img = Image.new("RGB", (W, H), BG)
    draw = ImageDraw.Draw(img)
    draw.rectangle((0, 0, W, 12), fill=ACCENT)
    draw.rectangle((0, H - 12, W, H), fill=GOLD)
    draw.text((56, 36), "SILVERLEAF ACADEMY", fill=MUTED, font=FONT_BADGE)
    draw.text((56, 68), "Policy briefing · ~3 minutes", fill=ACCENT, font=FONT_BADGE)
    return img, draw


def save_slide(img: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, "PNG")


def make_slides(briefing: dict, slide_dir: Path) -> list[tuple[Path, str]]:
    slides: list[tuple[Path, str]] = []
    title = briefing["title"]

    img, draw = base_slide()
    draw.text((56, 140), title, fill=WHITE, font=FONT_TITLE)
    y = 220
    for line in wrap(draw, briefing["intro"], FONT_BODY, W - 112)[:8]:
        draw.text((56, y), line, fill=MUTED, font=FONT_BODY)
        y += 42
    draw.text((56, H - 90), "Turn sound on — this briefing is narrated.", fill=GOLD, font=FONT_SMALL)
    path = slide_dir / "00-intro.png"
    save_slide(img, path)
    slides.append((path, briefing["intro"]))

    total = len(briefing["chapters"])
    for i, (label, spoken) in enumerate(briefing["chapters"], start=1):
        img, draw = base_slide()
        draw.text((56, 130), f"{i} / {total}", fill=ACCENT, font=FONT_BADGE)
        draw.text((56, 168), label, fill=WHITE, font=FONT_TITLE)
        y = 250
        for line in wrap(draw, spoken, FONT_BODY, W - 112)[:7]:
            draw.text((56, y), line, fill=MUTED, font=FONT_BODY)
            y += 42
        path = slide_dir / f"{i:02d}-{label[:20].replace(' ', '-')}.png"
        save_slide(img, path)
        slides.append((path, f"{label}. {spoken}"))

    img, draw = base_slide()
    draw.text((56, 200), "Next step", fill=ACCENT, font=FONT_BADGE)
    y = 260
    for line in wrap(draw, briefing["close"], FONT_BODY, W - 112):
        draw.text((56, y), line, fill=WHITE, font=FONT_BODY)
        y += 44
    draw.text(
        (56, H - 90),
        "Silverleaf Staff Onboarding · Policies & Compliance",
        fill=MUTED,
        font=FONT_SMALL,
    )
    path = slide_dir / "99-close.png"
    save_slide(img, path)
    slides.append((path, briefing["close"]))
    return slides


async def synthesize(text: str, out_mp3: Path) -> None:
    last_error: Exception | None = None
    for attempt in range(1, 5):
        try:
            await edge_tts.Communicate(text, VOICE, rate=SPEECH_RATE).save(str(out_mp3))
            return
        except Exception as exc:
            last_error = exc
            await asyncio.sleep(1.5 * attempt)
    assert last_error is not None
    raise last_error


def media_duration(path: Path) -> float:
    result = subprocess.run(
        [
            str(FFPROBE),
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "default=noprint_wrappers=1:nokey=1",
            str(path),
        ],
        check=True,
        capture_output=True,
        text=True,
    )
    return float(result.stdout.strip())


def encode_segment(png: Path, mp3: Path, out_mp4: Path, duration: float) -> None:
    subprocess.run(
        [
            str(FFMPEG),
            "-y",
            "-loop",
            "1",
            "-i",
            str(png),
            "-i",
            str(mp3),
            "-c:v",
            "libx264",
            "-tune",
            "stillimage",
            "-c:a",
            "aac",
            "-b:a",
            "128k",
            "-pix_fmt",
            "yuv420p",
            "-t",
            f"{duration:.2f}",
            "-shortest",
            "-movflags",
            "+faststart",
            str(out_mp4),
        ],
        check=True,
        capture_output=True,
    )


def concat_segments(segments: list[Path], out_mp4: Path) -> None:
    list_file = out_mp4.with_suffix(".txt")
    list_file.write_text(
        "".join(f"file '{seg.resolve()}'\n" for seg in segments),
        encoding="utf-8",
    )
    subprocess.run(
        [
            str(FFMPEG),
            "-y",
            "-f",
            "concat",
            "-safe",
            "0",
            "-i",
            str(list_file),
            "-c",
            "copy",
            str(out_mp4),
        ],
        check=True,
        capture_output=True,
    )
    list_file.unlink(missing_ok=True)


async def build_one(briefing: dict, work: Path) -> Path:
    slide_dir = work / briefing["id"]
    slide_dir.mkdir(parents=True, exist_ok=True)
    for old in slide_dir.glob("*"):
        old.unlink()

    pairs = make_slides(briefing, slide_dir)
    segments: list[Path] = []
    for index, (png, spoken) in enumerate(pairs):
        mp3 = slide_dir / f"{index:02d}.mp3"
        await synthesize(spoken, mp3)
        duration = max(MIN_SLIDE_SECONDS, media_duration(mp3) + PAD_AFTER_SPEECH)
        seg = slide_dir / f"{index:02d}.mp4"
        encode_segment(png, mp3, seg, duration)
        segments.append(seg)

    out = OUT_DIR / f"{briefing['id']}.mp4"
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    concat_segments(segments, out)
    return out


async def main_async() -> None:
    if not FFMPEG.exists() or not FFPROBE.exists():
        raise SystemExit(f"ffmpeg/ffprobe not found under {FFMPEG.parent}")

    if CONTENT_PATH.exists():
        raw = json.loads(CONTENT_PATH.read_text(encoding="utf-8"))
        briefings = [
            {
                "id": item["id"],
                "title": item["title"],
                "intro": item["intro"],
                "close": item["close"],
                "chapters": [tuple(pair) for pair in item["chapters"]],
            }
            for item in raw
        ]
    else:
        briefings = BRIEFINGS

    work = ROOT / ".tmp" / "policy-video-slides"
    work.mkdir(parents=True, exist_ok=True)
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    for briefing in briefings:
        words = len(briefing["intro"].split()) + len(briefing["close"].split())
        words += sum(len(s.split()) + len(l.split()) for l, s in briefing["chapters"])
        print(
            f"building {briefing['id']} "
            f"(~{words} words, {len(briefing['chapters'])} chapters)…"
        )
        out = await build_one(briefing, work)
        dur = media_duration(out)
        print(f"  wrote {out.relative_to(ROOT)} ({out.stat().st_size // 1024} KB, {dur:.1f}s)")


def main() -> None:
    asyncio.run(main_async())


if __name__ == "__main__":
    main()
