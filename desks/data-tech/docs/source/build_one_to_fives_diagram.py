#!/usr/bin/env python3
"""Excalidraw of the original 1–5s whiteboard, plus what we added to 1–5s."""

from __future__ import annotations

import json
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
OUT_EXCAL = HERE / "one-to-fives.excalidraw"
OUT_PNG = ROOT / "public" / "one-to-fives.png"

GREEN = ("#2b8a3e", "#d3f9d8")
AMBER = ("#e67700", "#fff3bf")
RED = ("#c92a2a", "#ffe3e3")
BLUE = ("#1c7ed6", "#d0ebff")
NAVY = "#1c3d5a"
INK = "#212529"

W, H = 1580, 1080
SCALE = 2


def nid(prefix: str) -> str:
    return f"{prefix}{random.randint(100000, 999999)}"


def status_colors(status: str) -> tuple[str, str]:
    return {"done": GREEN, "partial": AMBER, "missing": RED, "spec": BLUE}.get(status, ("#495057", "#f1f3f5"))


BOXES = [
    {
        "id": "users",
        "x": 48,
        "y": 220,
        "w": 140,
        "h": 56,
        "status": "done",
        "title": "Users",
        "lines": "",
    },
    {
        "id": "admin",
        "x": 620,
        "y": 40,
        "w": 140,
        "h": 56,
        "status": "done",
        "title": "Admin",
        "lines": "",
    },
    {
        "id": "core",
        "x": 420,
        "y": 200,
        "w": 280,
        "h": 88,
        "status": "done",
        "title": "Adds 1 to 5’s",
        "lines": "One form per person, per day.",
    },
    {
        "id": "admin-box",
        "x": 860,
        "y": 40,
        "w": 680,
        "h": 228,
        "status": "partial",
        "title": "Admin",
        "lines": (
            "1. View every user’s 1–5s                         DONE\n"
            "    See trend over time                            MISSING\n"
            "2. Graphs of users and accomplishments             MISSING\n"
            "3. Have logs                                       PARTIAL\n"
            "4. Mark public holidays                            DONE\n"
            "5. Daily / weekly / monthly summary                PARTIAL\n"
            "    (daily board + weekly page; no monthly)"
        ),
    },
    {
        "id": "user-box",
        "x": 48,
        "y": 360,
        "w": 500,
        "h": 250,
        "status": "partial",
        "title": "Person filling a 1–5",
        "lines": (
            "1. Login by email                                  DONE\n"
            "2. Fill in the form                                DONE\n"
            "3. View previous tasks (uneditable)                DONE\n"
            "4. Mark completed / in progress /\n"
            "    abandoned / not started                        PARTIAL\n"
            "    (end of day is tick-done vs still going)"
        ),
    },
    {
        "id": "spec",
        "x": 580,
        "y": 360,
        "w": 960,
        "h": 430,
        "status": "spec",
        "title": "The 1–5 form",
        "lines": (
            "1.  Login by email                                              DONE\n"
            "2.  Five slots: 1–3 today (at least one), 4 blockers, 5 yesterday comments\n"
            "                                                                PARTIAL  (1–3 on the form)\n"
            "3.  Today’s date by default                                     PARTIAL  (no date picker)\n"
            "4.  Shows previous tasks                                        DONE\n"
            "5.  Mark completed / in progress / abandoned / not started      PARTIAL\n"
            "    (admin cannot rename those phases)\n"
            "6.  Skip holidays the admin marked                              DONE\n"
            "7.  Skip weekends; admin can add an extra 1–5 day               DONE\n"
            "8.  Admin adds people one by one (name + email) or Excel        PARTIAL  (no Excel)\n"
            "9.  Track skipped dates with no reason                          DONE\n"
            "10. Reason required when someone skips                          DONE\n"
            "11. Admin sets cutoff and chooses close vs late                 PARTIAL\n"
            "    (fixed 9:30 a.m.; cron marks late / missed)\n"
            "12. Tasks stay editable                                         PARTIAL  (today yes, past locked)"
        ),
    },
    {
        "id": "added",
        "x": 48,
        "y": 820,
        "w": 1492,
        "h": 168,
        "status": "done",
        "title": "Also in 1–5s",
        "lines": (
            "Feedback thread on a person’s 1–5.     End-of-day close (tick what finished).\n"
            "9:30 a.m. auto-close — late and missed, plus an email digest.     Skip today with a why.\n"
            "Empty slots can be filled from that person’s own work.     1–5s show on their department desk,\n"
            "not only on a personal page.     Thursday pulse (wins / risks / help) for the desk."
        ),
    },
]

ARROWS = [
    ("users", "core", "Adds"),
    ("admin", "core", "Do"),
    ("admin", "admin-box", "Do"),
    ("core", "user-box", "Do"),
]


def draw_png() -> None:
    img = Image.new("RGB", (W * SCALE, H * SCALE), "#ffffff")
    d = ImageDraw.Draw(img)
    font_h1 = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 22 * SCALE)
    font_title = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 15 * SCALE)
    font_body = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 13 * SCALE)
    font_small = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 12 * SCALE)

    def R(x, y, w, h):
        return (int(x * SCALE), int(y * SCALE), int((x + w) * SCALE), int((y + h) * SCALE))

    d.rounded_rectangle(R(24, 16, 1532, 48), radius=8 * SCALE, fill=NAVY)
    d.text((40 * SCALE, 26 * SCALE), "Daily 1–5s", font=font_h1, fill="#ffffff")

    centers: dict[str, tuple[float, float, float, float, float, float]] = {}
    for box in BOXES:
        stroke, fill = status_colors(box["status"])
        d.rounded_rectangle(R(box["x"], box["y"], box["w"], box["h"]), radius=12 * SCALE, fill=fill, outline=stroke, width=2 * SCALE)
        d.text(((box["x"] + 14) * SCALE, (box["y"] + 10) * SCALE), box["title"], font=font_title, fill=INK)
        y = box["y"] + 34
        for line in box["lines"].split("\n"):
            if line:
                d.text(((box["x"] + 14) * SCALE, y * SCALE), line, font=font_body, fill="#343a40")
            y += 17
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
        mx, my = (x1 + x2) / 2, (y1 + y2) / 2
        tw = font_small.getlength(label)
        d.rectangle(
            [((mx * SCALE) - tw / 2 - 6, (my - 9) * SCALE), ((mx * SCALE) + tw / 2 + 6, (my + 9) * SCALE)],
            fill="#ffffff",
        )
        d.text((mx * SCALE - tw / 2, (my - 8) * SCALE), label, font=font_small, fill="#495057")

    legend_y = 1010
    d.text((48 * SCALE, legend_y * SCALE), "Green = in the 1–5s    Amber = partial    Red = not in 1–5s yet    Blue = form spec", font=font_small, fill="#868e96")
    d.text((48 * SCALE, (legend_y + 22) * SCALE), "Open docs/source/one-to-fives.excalidraw  →  excalidraw.com  →  Open / Ctrl+O", font=font_small, fill="#868e96")

    img.save(OUT_PNG, "PNG", optimize=True)
    print(f"wrote {OUT_PNG}")


def build_excalidraw() -> None:
    random.seed(21)
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

    def add_rect(x, y, w, h, stroke, fill):
        el = base(type="rectangle", x=x, y=y, width=w, height=h, strokeColor=stroke, backgroundColor=fill, strokeWidth=2)
        elements.append(el)
        return el

    def add_text(x, y, w, h, text, size, color="#343a40", align="left", container=None):
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
            fontFamily=1,
            textAlign=align,
            verticalAlign="top",
            containerId=container,
            lineHeight=1.25,
            roundness=None,
        )
        elements.append(el)
        return el

    banner = add_rect(24, 16, 1532, 48, NAVY, NAVY)
    title = add_text(36, 26, 1508, 28, "Daily 1–5s", 20, "#ffffff", "center")
    banner["boundElements"] = [{"type": "text", "id": title["id"]}]
    title["containerId"] = banner["id"]
    title["verticalAlign"] = "middle"

    rects: dict[str, dict] = {}
    for box in BOXES:
        stroke, fill = status_colors(box["status"])
        rect = add_rect(box["x"], box["y"], box["w"], box["h"], stroke, fill)
        title_el = add_text(box["x"] + 12, box["y"] + 10, box["w"] - 24, 22, box["title"], 16, INK)
        body = box["lines"].strip()
        bound = [{"type": "text", "id": title_el["id"]}]
        if body:
            body_el = add_text(box["x"] + 12, box["y"] + 36, box["w"] - 24, box["h"] - 48, body, 14)
            bound.append({"type": "text", "id": body_el["id"]})
        rect["boundElements"] = bound
        rects[box["id"]] = rect

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
        add_text((x1 + x2) / 2 - 28, (y1 + y2) / 2 - 10, 56, 18, label, 14, "#495057", "center")

    add_text(48, 1010, 1480, 18, "Green = in the 1–5s    Amber = partial    Red = not in 1–5s yet    Blue = form spec", 14, "#868e96")
    add_text(48, 1034, 1480, 18, "Drag this file onto a blank excalidraw.com canvas  (Open / Ctrl+O)", 14, "#868e96")

    doc = {
        "type": "excalidraw",
        "version": 2,
        "source": "https://excalidraw.com",
        "elements": elements,
        "appState": {"gridSize": None, "viewBackgroundColor": "#ffffff"},
        "files": {},
    }
    OUT_EXCAL.write_text(json.dumps(doc, indent=2))
    (ROOT / "public" / "one-to-fives.excalidraw").write_text(OUT_EXCAL.read_text())
    print(f"wrote {OUT_EXCAL} ({len(elements)} elements)")


if __name__ == "__main__":
    build_excalidraw()
    draw_png()
