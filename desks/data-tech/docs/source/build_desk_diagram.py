#!/usr/bin/env python3
"""Build the Silverleaf Desk Excalidraw file and PNG system map."""

from __future__ import annotations

import json
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
OUT_EXCAL = Path(__file__).with_name("silverleaf-desk.excalidraw")
OUT_PNG = ROOT / "public" / "silverleaf-desk-diagram.png"

# Implemented / partial / missing
GREEN = ("#2b8a3e", "#d3f9d8")
AMBER = ("#e67700", "#fff3bf")
RED = ("#c92a2a", "#ffe3e3")
NAVY = ("#1c3d5a", "#dbe4ff")
GRAY = ("#495057", "#f1f3f5")
TEAL = ("#0b7285", "#e3fafc")
VIOLET = ("#5f3dc4", "#f3d9fa")

W, H = 1760, 1180
SCALE = 2


def nid(prefix: str) -> str:
    return f"{prefix}{random.randint(100000, 999999)}"


def status_colors(status: str) -> tuple[str, str]:
    return {"done": GREEN, "partial": AMBER, "missing": RED, "flow": NAVY, "auto": TEAL, "desk": VIOLET}.get(
        status, GRAY
    )


ZONES = [
    {"x": 24, "y": 72, "w": 1712, "h": 118, "title": "Who uses it", "fill": "#f8f9fa", "stroke": "#ced4da"},
    {"x": 24, "y": 206, "w": 560, "h": 520, "title": "Daily 1–5  (staff)", "fill": "#e7f5ff", "stroke": "#74c0fc"},
    {"x": 600, "y": 206, "w": 560, "h": 520, "title": "Automation  (nobody checks by hand)", "fill": "#e6fcf5", "stroke": "#63e6be"},
    {"x": 1176, "y": 206, "w": 560, "h": 520, "title": "Admin  (from the original board)", "fill": "#fff9db", "stroke": "#ffd43b"},
    {"x": 24, "y": 742, "w": 1712, "h": 360, "title": "Project manager desk in this Data & Tech app  (added after the original drawing)", "fill": "#f3f0ff", "stroke": "#b197fc"},
]

BOXES = [
    # People row
    {
        "id": "staff",
        "x": 48,
        "y": 104,
        "w": 280,
        "h": 68,
        "status": "done",
        "title": "Staff in every department",
        "lines": "Onboarding · Uniforms · Marketing · Ops\nData & Tech · HR · Academic · Finance · Facilities",
    },
    {
        "id": "login",
        "x": 372,
        "y": 104,
        "w": 240,
        "h": 68,
        "status": "done",
        "title": "Login by email",
        "lines": "Email + password, or OTP.\nEach person gets their own desk.",
    },
    {
        "id": "personal",
        "x": 656,
        "y": 104,
        "w": 280,
        "h": 68,
        "status": "done",
        "title": "Personal 1–5",
        "lines": "Slots come from what they typed\n(and can tap tasks from their board).",
    },
    {
        "id": "dept-desk",
        "x": 980,
        "y": 104,
        "w": 280,
        "h": 68,
        "status": "done",
        "title": "Department desk",
        "lines": "Teammates see today's 1–5s,\nclose-out, and feedback.",
    },
    {
        "id": "snapshot",
        "x": 1304,
        "y": 104,
        "w": 400,
        "h": 68,
        "status": "done",
        "title": "Weekly academy snapshot",
        "lines": "One page: 1–5s + sprint % + Thursday pulse.\nUsed as the weekly update.",
    },
    # Staff 1-5
    {
        "id": "form",
        "x": 48,
        "y": 248,
        "w": 512,
        "h": 216,
        "status": "partial",
        "title": "Morning form  (original blue box)",
        "lines": "1–3  What I will do today  (at least one)   DONE\n4    Blockers                                 PARTIAL\n     (in the database, not on the Today form)\n5    Comments on yesterday                    PARTIAL\nToday's date is used automatically            PARTIAL\n     (no date picker — staff can only file today)\nYesterday's tasks shown; older days locked    DONE\nSkip today with a reason                      DONE\nToday's 1–5 stays editable until close        DONE",
    },
    {
        "id": "progress",
        "x": 48,
        "y": 480,
        "w": 512,
        "h": 100,
        "status": "partial",
        "title": "Mark yesterday + close the day",
        "lines": "Morning: completed / in progress / abandoned / not started   DONE\nEvening: tick what finished (else stays in progress)          DONE\nAdmin cannot add/rename those progress phases                 MISSING",
    },
    {
        "id": "history",
        "x": 48,
        "y": 596,
        "w": 512,
        "h": 106,
        "status": "done",
        "title": "History + feedback",
        "lines": "Earlier days listed on the form (read-only for staff).\nAnyone on the desk can leave feedback on a 1–5.",
    },
    # Automation
    {
        "id": "cron",
        "x": 624,
        "y": 248,
        "w": 512,
        "h": 150,
        "status": "done",
        "title": "9:30 a.m. Nairobi cron",
        "lines": "Job runs at 9:31. Marks on time / late / missed.\nEmails an admin digest. Nobody polls the board.\nSame deadline for Thursday departmental pulses.",
    },
    {
        "id": "calendar",
        "x": 624,
        "y": 414,
        "w": 512,
        "h": 132,
        "status": "done",
        "title": "Calendar rules",
        "lines": "Skip weekends and public holidays (admin marks them).\nAdmin can add a weekend/holiday as an extra work day.\nSkipped with no reason → counted as missed.",
    },
    {
        "id": "pulse",
        "x": 624,
        "y": 562,
        "w": 512,
        "h": 142,
        "status": "done",
        "title": "Thursday departmental pulse",
        "lines": "Each department files wins / risks / help needed\nbefore the same 9:30 a.m. deadline.\nMissed departments are flagged automatically.",
    },
    # Admin
    {
        "id": "admin-view",
        "x": 1200,
        "y": 248,
        "w": 512,
        "h": 118,
        "status": "partial",
        "title": "See everyone's 1–5s + trend",
        "lines": "Board grouped by department for today          DONE\nTrend of a user over time                       MISSING\nGraph of accomplishments                        MISSING",
    },
    {
        "id": "admin-summary",
        "x": 1200,
        "y": 382,
        "w": 512,
        "h": 100,
        "status": "partial",
        "title": "Daily / weekly / monthly summary",
        "lines": "Daily board + weekly snapshot                  DONE\nMonthly 1–5 summary                             MISSING",
    },
    {
        "id": "admin-logs",
        "x": 1200,
        "y": 498,
        "w": 248,
        "h": 88,
        "status": "partial",
        "title": "Have logs",
        "lines": "User/tool audit exists.\nNo 1–5 activity log UI.",
    },
    {
        "id": "admin-users",
        "x": 1464,
        "y": 498,
        "w": 248,
        "h": 88,
        "status": "partial",
        "title": "Add users",
        "lines": "One by one: name + email  DONE\nExcel / CSV batch          MISSING",
    },
    {
        "id": "admin-deadline",
        "x": 1200,
        "y": 602,
        "w": 512,
        "h": 102,
        "status": "partial",
        "title": "Submission threshold",
        "lines": "9:30 a.m. auto-close and late marking          DONE\nAdmin cannot change the time or pick\nclose vs late by hand                           MISSING",
    },
    # Project manager
    {
        "id": "projects",
        "x": 48,
        "y": 784,
        "w": 320,
        "h": 132,
        "status": "done",
        "title": "Projects per department",
        "lines": "Each Silverleaf department owns\nproject boards (ClickUp-style).\nLead, status, and desk rollup.",
    },
    {
        "id": "phases",
        "x": 400,
        "y": 784,
        "w": 280,
        "h": 132,
        "status": "done",
        "title": "Phases",
        "lines": "Foundation → Operations, etc.\nDates and goals on each phase.",
    },
    {
        "id": "sprints",
        "x": 712,
        "y": 784,
        "w": 320,
        "h": 132,
        "status": "done",
        "title": "Sprints + capacity",
        "lines": "Sprint board, points, assignees,\ncomments, checklists, attachments.",
    },
    {
        "id": "tickets",
        "x": 1064,
        "y": 784,
        "w": 300,
        "h": 132,
        "status": "done",
        "title": "Tickets + tech tools",
        "lines": "Staff tickets can convert to\nproject tasks. Tool checkout\nstays in Data & Tech.",
    },
    {
        "id": "weekly",
        "x": 1396,
        "y": 784,
        "w": 316,
        "h": 132,
        "status": "done",
        "title": "Weekly snapshot",
        "lines": "Department 1–5s, sprint %,\nand pulse notes on one page.",
    },
    {
        "id": "still-out",
        "x": 48,
        "y": 936,
        "w": 1664,
        "h": 148,
        "status": "missing",
        "title": "Still not in the system  (from the original picture)",
        "lines": "1. Charts / trend of a person's 1–5s over time     2. Graphical accomplishments     3. 1–5 activity log screen\n4. Monthly 1–5 summary     5. Excel batch user import     6. Admin-managed progress phases\n7. Admin-configurable deadline (hardcoded 9:30)     8. Date picker for another day     9. Free-text comments on yesterday",
    },
]

ARROWS = [
    ("staff", "login", "adds"),
    ("login", "personal", "files"),
    ("personal", "dept-desk", "shows on"),
    ("dept-desk", "snapshot", "rolls up"),
    ("form", "cron", "before 9:30"),
    ("cron", "admin-view", "digest"),
    ("projects", "phases", ""),
    ("phases", "sprints", ""),
    ("sprints", "tickets", ""),
    ("tickets", "weekly", ""),
]


def wrap_estimate(text: str, font, max_width: int) -> list[str]:
    lines: list[str] = []
    for raw in text.split("\n"):
        words = raw.split(" ")
        cur = ""
        for word in words:
            trial = word if not cur else f"{cur} {word}"
            if font.getlength(trial) <= max_width:
                cur = trial
            else:
                if cur:
                    lines.append(cur)
                cur = word
        lines.append(cur)
    return lines


def draw_png() -> None:
    img = Image.new("RGB", (W * SCALE, H * SCALE), "#ffffff")
    d = ImageDraw.Draw(img)
    font_title = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 15 * SCALE)
    font_h1 = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 22 * SCALE)
    font_h2 = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 13 * SCALE)
    font_body = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 12 * SCALE)
    font_small = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 11 * SCALE)

    def R(x: float, y: float, w: float, h: float) -> tuple[int, int, int, int]:
        return (int(x * SCALE), int(y * SCALE), int((x + w) * SCALE), int((y + h) * SCALE))

    d.rounded_rectangle(R(24, 16, 1712, 44), radius=8 * SCALE, fill="#1c3d5a")
    d.text((40 * SCALE, 26 * SCALE), "Silverleaf Data & Tech  —  1–5s picture + project manager desk  (not Uniforms)", font=font_h1, fill="#ffffff")

    for zone in ZONES:
        d.rounded_rectangle(R(zone["x"], zone["y"], zone["w"], zone["h"]), radius=12 * SCALE, fill=zone["fill"], outline=zone["stroke"], width=2 * SCALE)
        d.text(((zone["x"] + 14) * SCALE, (zone["y"] + 10) * SCALE), zone["title"], font=font_h2, fill="#343a40")

    centers: dict[str, tuple[float, float, float, float, float, float]] = {}
    for box in BOXES:
        stroke, fill = status_colors(box["status"])
        d.rounded_rectangle(R(box["x"], box["y"], box["w"], box["h"]), radius=10 * SCALE, fill=fill, outline=stroke, width=2 * SCALE)
        d.text(((box["x"] + 12) * SCALE, (box["y"] + 8) * SCALE), box["title"], font=font_title, fill="#212529")
        y = box["y"] + 32
        for line in box["lines"].split("\n"):
            d.text(((box["x"] + 12) * SCALE, y * SCALE), line, font=font_body, fill="#343a40")
            y += 16
        centers[box["id"]] = (box["x"], box["y"], box["w"], box["h"], box["x"] + box["w"] / 2, box["y"] + box["h"] / 2)

    for src, dst, label in ARROWS:
        ax, ay, aw, ah, acx, acy = centers[src]
        bx, by, bw, bh, bcx, bcy = centers[dst]
        if abs(bcx - acx) >= abs(bcy - acy):
            x1 = ax + aw if bcx > acx else ax
            y1 = acy
            x2 = bx if bcx > acx else bx + bw
            y2 = bcy
        else:
            x1 = acx
            y1 = ay + ah if bcy > acy else ay
            x2 = bcx
            y2 = by if bcy > acy else by + bh
        d.line([(x1 * SCALE, y1 * SCALE), (x2 * SCALE, y2 * SCALE)], fill="#495057", width=2 * SCALE)
        # arrow head
        if abs(x2 - x1) >= abs(y2 - y1):
            direction = 1 if x2 > x1 else -1
            d.polygon(
                [
                    (x2 * SCALE, y2 * SCALE),
                    ((x2 - 8 * direction) * SCALE, (y2 - 5) * SCALE),
                    ((x2 - 8 * direction) * SCALE, (y2 + 5) * SCALE),
                ],
                fill="#495057",
            )
        else:
            direction = 1 if y2 > y1 else -1
            d.polygon(
                [
                    (x2 * SCALE, y2 * SCALE),
                    ((x2 - 5) * SCALE, (y2 - 8 * direction) * SCALE),
                    ((x2 + 5) * SCALE, (y2 - 8 * direction) * SCALE),
                ],
                fill="#495057",
            )
        if label:
            mx, my = (x1 + x2) / 2, (y1 + y2) / 2
            tw = font_small.getlength(label)
            d.rectangle([((mx * SCALE) - tw / 2 - 6, (my - 8) * SCALE), ((mx * SCALE) + tw / 2 + 6, (my + 8) * SCALE)], fill="#ffffff")
            d.text((mx * SCALE - tw / 2, (my - 7) * SCALE), label, font=font_small, fill="#495057")

    # legend
    legend_y = 1110
    d.text((48 * SCALE, legend_y * SCALE), "Colour = build status vs the original 1–5s picture", font=font_small, fill="#868e96")
    legend = [("Implemented", GREEN[1], GREEN[0]), ("Partial", AMBER[1], AMBER[0]), ("Not yet", RED[1], RED[0])]
    x = 400
    for name, fill, stroke in legend:
        d.rounded_rectangle(R(x, legend_y - 4, 18, 18), radius=4 * SCALE, fill=fill, outline=stroke, width=2 * SCALE)
        d.text(((x + 26) * SCALE, legend_y * SCALE), name, font=font_small, fill="#343a40")
        x += 120
    d.text((800 * SCALE, legend_y * SCALE), "Data & Tech file — not the Uniforms tracker drawing.", font=font_small, fill="#868e96")

    img.save(OUT_PNG, "PNG", optimize=True)
    print(f"wrote {OUT_PNG} ({OUT_PNG.stat().st_size} bytes)")


def build_excalidraw() -> None:
    random.seed(15)
    elements: list[dict] = []

    def base(**extra):
        el = {
            "id": nid("e"),
            "angle": 0,
            "fillStyle": "solid",
            "strokeWidth": 1,
            "strokeStyle": "solid",
            "roughness": 1,
            "opacity": 100,
            "groupIds": [],
            "frameId": None,
            "seed": random.randint(1, 999999),
            "version": 1,
            "versionNonce": random.randint(1, 999999),
            "isDeleted": False,
            "boundElements": [],
            "updated": 1,
            "link": None,
            "locked": False,
            "backgroundColor": "transparent",
            "roundness": {"type": 3},
        }
        el.update(extra)
        return el

    def add_rect(x, y, w, h, stroke, fill, opacity=100):
        el = base(type="rectangle", x=x, y=y, width=w, height=h, strokeColor=stroke, backgroundColor=fill, opacity=opacity, strokeWidth=2)
        elements.append(el)
        return el

    def add_text(x, y, w, h, text, size, color="#343a40", align="left", container=None, bold=False):
        el = base(
            type="text",
            x=x,
            y=y,
            width=w,
            height=h,
            strokeColor=color,
            text=text,
            originalText=text,
            fontSize=size,
            fontFamily=1 if not bold else 1,
            textAlign=align,
            verticalAlign="top",
            containerId=container,
            lineHeight=1.25,
            roundness=None,
            strokeWidth=1,
        )
        elements.append(el)
        return el

    def add_labeled_box(x, y, w, h, title, body, stroke, fill):
        rect = add_rect(x, y, w, h, stroke, fill)
        title_el = add_text(x + 10, y + 8, w - 20, 22, title, 16, "#212529")
        body_el = add_text(x + 10, y + 34, w - 20, h - 44, body, 14, "#343a40")
        rect["boundElements"] = [{"type": "text", "id": title_el["id"]}, {"type": "text", "id": body_el["id"]}]
        return rect

    title = add_rect(24, 16, 1712, 44, "#1c3d5a", "#1c3d5a")
    ttxt = add_text(36, 24, 1688, 28, "Silverleaf Data & Tech  —  1–5s picture + project manager desk  (not Uniforms)", 20, "#ffffff", "center")
    title["boundElements"] = [{"type": "text", "id": ttxt["id"]}]
    ttxt["containerId"] = title["id"]
    ttxt["verticalAlign"] = "middle"

    for zone in ZONES:
        add_rect(zone["x"], zone["y"], zone["w"], zone["h"], zone["stroke"], zone["fill"], opacity=55)
        add_text(zone["x"] + 14, zone["y"] + 10, zone["w"] - 28, 22, zone["title"], 16, "#343a40")

    rects: dict[str, dict] = {}
    for box in BOXES:
        stroke, fill = status_colors(box["status"])
        rects[box["id"]] = add_labeled_box(box["x"], box["y"], box["w"], box["h"], box["title"], box["lines"], stroke, fill)

    for src, dst, label in ARROWS:
        a, b = rects[src], rects[dst]
        ax, ay, aw, ah = a["x"], a["y"], a["width"], a["height"]
        bx, by, bw, bh = b["x"], b["y"], b["width"], b["height"]
        acx, acy = ax + aw / 2, ay + ah / 2
        bcx, bcy = bx + bw / 2, by + bh / 2
        if abs(bcx - acx) >= abs(bcy - acy):
            x1 = ax + aw if bcx > acx else ax
            y1 = acy
            x2 = bx if bcx > acx else bx + bw
            y2 = bcy
        else:
            x1 = acx
            y1 = ay + ah if bcy > acy else ay
            x2 = bcx
            y2 = by if bcy > acy else by + bh
        arrow = base(
            type="arrow",
            x=x1,
            y=y1,
            width=x2 - x1,
            height=y2 - y1,
            strokeColor="#495057",
            strokeWidth=2,
            roundness={"type": 2},
            startBinding={"elementId": a["id"], "focus": 0, "gap": 4},
            endBinding={"elementId": b["id"], "focus": 0, "gap": 4},
            lastCommittedPoint=None,
            startArrowhead=None,
            endArrowhead="arrow",
            points=[[0, 0], [x2 - x1, y2 - y1]],
        )
        elements.append(arrow)
        a.setdefault("boundElements", []).append({"id": arrow["id"], "type": "arrow"})
        b.setdefault("boundElements", []).append({"id": arrow["id"], "type": "arrow"})
        if label:
            add_text((x1 + x2) / 2 - 40, (y1 + y2) / 2 - 10, 80, 18, label, 12, "#495057", "center")

    add_text(48, 1110, 520, 18, "Green = in the app   Amber = partial   Red = not yet", 14, "#868e96")
    add_text(580, 1110, 1140, 18, "This file is Data & Tech. Do not open silverleaf-uniform-system.excalidraw — that is the Uniforms tracker.", 14, "#868e96")

    doc = {
        "type": "excalidraw",
        "version": 2,
        "source": "https://excalidraw.com",
        "elements": elements,
        "appState": {
            "gridSize": None,
            "viewBackgroundColor": "#ffffff",
        },
        "files": {},
    }
    OUT_EXCAL.write_text(json.dumps(doc, indent=2))
    print(f"wrote {OUT_EXCAL} ({len(elements)} elements)")


if __name__ == "__main__":
    build_excalidraw()
    draw_png()
    named = Path(__file__).with_name("silverleaf-data-and-tech.excalidraw")
    named.write_text(OUT_EXCAL.read_text())
    (ROOT / "public" / "silverleaf-desk.excalidraw").write_text(OUT_EXCAL.read_text())
    (ROOT / "public" / "silverleaf-data-and-tech.excalidraw").write_text(OUT_EXCAL.read_text())
    print(f"copied {named}")
