# Design brief — Pinto design system, mascot, logo

**สำหรับเอาไปออกแบบในระบบอื่น แล้วส่งไฟล์กลับมา**

เอกสารนี้สรุปทุกการตัดสินใจจากการ brainstorm (2026-09-10) ให้ครบในที่เดียว เพื่อให้คนหรือ
เครื่องมืออื่นออกแบบต่อได้โดยไม่ต้องอ่านบทสนทนา — คำอธิบายเป็นภาษาไทย ค่าเทคนิคเป็นอังกฤษ
และมี **prompt ภาษาอังกฤษพร้อมคัดลอก** อยู่ท้ายเอกสาร

---

## 1. Pinto คืออะไร (บริบทที่คนออกแบบต้องรู้)

แดชบอร์ดภาษาไทยสำหรับ**พ่อค้าแม่ค้าออนไลน์ที่ขายข้าม TikTok Shop / Shopee / LINE MyShop**
รวมออเดอร์ แชตลูกค้า สต๊อก การตลาด และกำไร ไว้ที่เดียว เพื่อให้เจ้าของร้านรู้ว่า
"วันนี้ต้องจัดการอะไร" โดยไม่ต้องเปิด back office สามที่

- ผู้ใช้: แม่ค้าไทย ไม่ใช่สายเทคนิค อ่านภาษาไทยเป็นหลัก
- หน้าจอ: 8 หน้า — วันนี้ · สิ่งที่ต้องทำ · ออเดอร์ · ข้อความลูกค้า · สินค้าและสต๊อก · ลูกค้า · การเติบโต · การเงิน
- ตัวตนที่ต้องการ: **น่าเชื่อถือพอที่จะโชว์ตัวเลขเงิน แต่ไม่เย็นชาเหมือนซอฟต์แวร์บัญชี**
- stack: React 19 + Vite (vinext) → Cloudflare Workers, CSS ล้วน (ไม่มี Tailwind), ไอคอน Lucide

⚠️ ระบบมีอยู่จริงและใช้งานได้แล้ว — งานนี้คือ**จัดระเบียบและเติมตัวตนที่ขาด ไม่ใช่ออกแบบใหม่ทั้งหมด**

---

## 2. การตัดสินใจที่ล็อกแล้ว

| # | คำถาม | คำตอบ |
| --- | --- | --- |
| Q1 | ทำยังไงกับสีที่มีอยู่ | **เก็บไว้เป็นฐาน แล้วทำให้เป็นระบบจริง** + เติม mascot / logo / favicon |
| Q2 | สไตล์ mascot | **Soft rounded** — แม่ค้าหญิง น่ารัก เข้าถึงง่าย แต่คุมด้วยจำนวนสีน้อยเลยยังทางการ |
| Q2b | ท่าทาง mascot | **"รับออเดอร์"** — ถือมือถือมีแจ้งเตือน + หนีบกล่องพัสดุ |
| Q3 | ความสัมพันธ์ logo กับ mascot | **mascot + wordmark "pinto" คู่กัน** เป็นโลโก้หลัก · ที่เล็กมากใช้ mascot เดี่ยว |
| Q4 | โทนของระบบ | **Quiet chrome** — การ์ดเหลือแค่เส้นขอบบาง ไม่มีเงา ตัดของประดับทิ้ง |
| Q5 | ตัวห่อของ logo mark | 🔶 **ยังไม่ตอบ** — ดูข้อ 6.3 |

---

## 3. ระบบสี

### 3.1 สีที่ต้องใช้ (มีอยู่ในโค้ดแล้ว ห้ามเปลี่ยนค่า)

| บทบาท | HEX | ใช้ตรงไหน |
| --- | --- | --- |
| Brand orange | `#C85410` | ปุ่มหลัก, ตัวเลขเน้น, จุดบน i, โบว์ผม mascot |
| Brand orange dark | `#9E3F08` | hover, เงาของผ้ากันเปื้อน |
| Brand orange soft | `#FBEFE7` | พื้นหลังอ่อน, พื้นรองไอคอน |
| Canvas beige | `#F5F0EC` | พื้นหลังทั้งแอป |
| Surface white | `#FFFFFF` | การ์ด/แผง |
| Ink | `#211D1B` | ตัวหนังสือหลัก, ผม mascot |
| Muted | `#766F6B` | ตัวหนังสือรอง |
| Soft | `#A29A95` | ป้ายกำกับ, ตัวหนังสือจาง |
| Line | `#EBE4DF` | เส้นขอบทั้งหมด |
| Success | `#658B39` บน `#EDF4E7` | ตัวเลขบวก, สถานะปกติ |
| Warning | `#9A6A24` บน `#FFF2DD` | ต้องตรวจสอบ |
| Danger | `#A94C3F` บน `#F9EBE8` | เสี่ยง/ผิดปกติ |

### 3.2 สิ่งที่ต้องแก้ในโค้ด (งานฝั่งผม ไม่ใช่ของคนออกแบบ)

- ตัวแปร CSS ชื่อ `--green` ปัจจุบันเก็บค่า **สีส้ม** `#C85410` → ต้องเปลี่ยนชื่อเป็น `--brand`
- มี `:root` สองชุดใน `app/globals.css` — ชุดแรกเป็นระบบสีเขียวของ template เดิม ชุดที่สองเขียนทับเป็นส้ม → ลบชุดแรกทิ้ง
- ผลลัพธ์: token ชุดเดียว ชื่อตรงกับสิ่งที่มันเป็น

### 3.3 กฎการใช้สีส้ม (สำคัญที่สุดของโทน Quiet chrome)

> **สีส้มใช้ได้ประมาณ 4 จุดต่อหนึ่งหน้าจอเท่านั้น** — ปุ่มหลัก, ตัวเลขที่ต้องการให้มอง, แท่งกราฟ, โลโก้
> ถ้าเกินกว่านั้น หน้าจอจะกลับไป "ดัง" และเสียความ minimal ที่เลือกไว้

---

## 4. โทน Quiet chrome — กฎรูปทรง

| องค์ประกอบ | ค่า | หมายเหตุ |
| --- | --- | --- |
| Card radius | `8px` | เดิมมนกว่านี้มาก |
| Button radius | `7px` | ไม่ใช่แคปซูล |
| Card border | `1px solid #EBE4DF` | |
| Card shadow | **ไม่มี** | ตัดทิ้งทั้งระบบ |
| Card background | `#FFFFFF` บนพื้น `#F5F0EC` | |
| ตัวเลขใหญ่ | `font-weight: 600` | ไม่ใช่ 700–800 |
| ป้ายกำกับ | `9px`, uppercase, `letter-spacing: .08em`, สี `#A29A95` | |
| ตัวเลขเปลี่ยนแปลง | ข้อความเปล่า เช่น `+12.4%` | **ไม่ใส่ pill/ป้ายพื้นหลัง** |
| ปุ่มรอง | ข้อความเปล่า ไม่มีขอบไม่มีพื้น | |
| แท่งกราฟ | radius `2px 2px 0 0` | |

**หลักคิด:** ทางการเพราะ*โครงสร้างและระเบียบ* ไม่ใช่เพราะ*ความเย็นชา* — ความอบอุ่นมาจากสี
ความน่าเชื่อถือมาจากการจัดวาง

**ทำไมยังเก็บ "การ์ด" ไว้:** หน้า Today และ Stock มี 5–6 แผงพร้อมกันบนจอเดียว
ถ้าเอากล่องออกหมด ผู้ใช้จะแยกไม่ออกว่าอะไรอยู่กลุ่มไหน — กล่องที่นี่ทำหน้าที่ *จัดกลุ่ม* ไม่ใช่ *ตกแต่ง*

---

## 5. ตัวอักษรและระยะ

- **ฟอนต์:** Noto Sans Thai (weights 400/500/600/700) — โหลดผ่าน `next/font/google` อยู่แล้ว
- **Base:** 15px / line-height 1.55
- **ห้ามใช้ตัวหนังสือเล็กกว่า 10px** (ยกเว้นป้ายกำกับ uppercase ที่ 9px ซึ่งมี letter-spacing ช่วย)
- **สเกลระยะ:** 4 / 8 / 12 / 16 / 20 / 24 / 32 px
- **ไอคอน:** Lucide, ขนาด 18–21px, `strokeWidth` ≈ 1.9

**Breakpoints ที่ต้องตรวจทุกครั้ง:** 1440 · 1024 · 760 · 390 px

---

## 6. Mascot

### 6.1 ตัวละคร

**"แม่ค้าออนไลน์ชาวไทย"** — ผู้หญิง ดูอายุ 25–35 มั่นใจ เป็นมิตร กำลังทำงานอยู่
ไม่ใช่นางแบบ ไม่ใช่ตัวการ์ตูนเด็ก — เป็นคนที่ผู้ใช้จริงรู้สึกว่า "เหมือนเรา"

**ท่าทางที่เลือก — "รับออเดอร์":**
- มือขวาถือ**มือถือ** หน้าจอมีรายการสั้นๆ
- แขนซ้าย**หนีบกล่องพัสดุ**สีน้ำตาลกระดาษ มีเทปกาวสีส้มคาด
- **ป้ายแจ้งเตือน "ออเดอร์ใหม่ / +3 รายการ"** ลอยอยู่**ข้างมือถือ** มีหางชี้ลงมาที่เครื่อง

> ⚠️ **ข้อผิดพลาดที่ต้องเลี่ยง (แก้มาแล้วรอบหนึ่ง):**
> ป้ายแจ้งเตือน **ห้ามทับหน้า mascot เด็ดขาด** — ต้องอยู่ด้านข้าง มีพื้นที่ว่างคั่น
> ให้ขยาย canvas ออกด้านข้างแทนการเบียดป้ายเข้าหาตัว

### 6.2 รายละเอียดที่ทำให้ "มีมิติ" (โจทย์ที่เกรพขอมาโดยเฉพาะ)

**สี:**
| ส่วน | HEX |
| --- | --- |
| ผม | `#211D1B` |
| ผมชั้นสว่าง (วอลุ่ม) | `#3B312C` |
| ผิว | `#F4D8C3` |
| ผิวส่วนเงา (ใต้คาง/คอ) | `#E9C7AE` |
| เสื้อ | `#F7EFE8` |
| เสื้อด้านเงา | `#E9DCD2` |
| ผ้ากันเปื้อน | `#C85410` |
| ผ้ากันเปื้อนด้านเงา | `#9E3F08` |
| ผ้ากันเปื้อนไฮไลต์/รอยพับ | `#EC8A4E` |
| กล่องพัสดุ | `#DCBB92` / ด้านเงา `#C9A479` |

**สิ่งที่ต้องมี:**
1. **แสงเงามีทิศทางเดียว** — สมมติแสงมาจากซ้ายบน ทุกชิ้น (เสื้อ ผ้ากันเปื้อน กล่อง) มีด้านสว่าง/ด้านมืดสอดคล้องกัน
2. **เงาใต้คาง** ทาบลงบนคอ — จุดเดียวนี้ทำให้หัวไม่ "ลอย"
3. **ผ้ากันเปื้อนมีรอยพับ** อย่างน้อยหนึ่งเส้น
4. **ผมมีชั้นสว่าง** ไม่ใช่ก้อนดำแบน
5. **เงาตกที่พื้น** เป็นวงรีจางใต้ตัว
6. **คิ้ว** — สำคัญมาก หน้ามีอารมณ์ทันทีเมื่อมีคิ้ว
7. **ปอยผมข้างแก้ม** สองข้าง
8. **โบว์รัดมวยสีส้ม** `#C85410` — เป็น**จุดจำหลัก**ของตัวละคร ต้องมีทุกเวอร์ชัน
9. แก้มแดงจางๆ opacity ~28%
10. ไฮไลต์จุดขาวเล็กในตา

### 6.3 เวอร์ชันตามขนาด (สำคัญ)

| เวอร์ชัน | ใช้ที่ | รายละเอียด |
| --- | --- | --- |
| **Full** | หน้า login, empty state, การ์ดแนะนำ | ครึ่งตัว + มือถือ + กล่อง + ป้ายแจ้งเตือน |
| **Bust** | ภาพประกอบขนาดกลาง | ครึ่งตัว + มือถือ + กล่อง **ไม่มีป้ายแจ้งเตือน** |
| **Head** | โลโก้, favicon, ไอคอน LINE | เฉพาะหัว + มวย + โบว์ส้ม |

> ที่ 20–40px ตัวเต็มกลายเป็นก้อนเบลอ — **หัวอย่างเดียวจำได้ทันที** นี่คือเหตุผลที่ต้องมี 3 เวอร์ชัน

---

## 7. Logo

### 7.1 องค์ประกอบ

```
[ mark = หัว mascot ]  p ı n t o
                          ↑ จุดสีส้ม #C85410
```

- **Wordmark "pinto"** — ตัวพิมพ์เล็กทั้งหมด, weight 600, `letter-spacing: -0.025em`
- **จุดบนตัว i เป็นสีส้ม** — เป็นส้มจุดเดียวในโลโก้ ล้อกับโบว์รัดมวยของ mascot
- **ไม่มี "Commerce Center"** ในโลโก้หลัก (ใช้เป็นบรรทัดเล็กใต้ sidebar แยกต่างหากได้)
- ระยะระหว่าง mark กับ wordmark ≈ 11px ที่ mark ขนาด 38px

### 7.2 🔶 คำถามเดียวที่ยังไม่ได้ตอบ — เลือกหนึ่ง

| | แบบ | ข้อดี | ข้อเสีย |
| --- | --- | --- | --- |
| **1** | **ไม่มีกล่อง** — หัวลอยข้างชื่อ | minimal ที่สุด · ผมถ่าน + ตัวอักษรถ่าน ดูเป็นชิ้นเดียว | LINE บังคับวงกลม ต้องมีพื้นส้มอ่อนรองให้ตอนทำไอคอน |
| **2** | **วงกลมเส้นบาง** `1.5px #211D1B` | รูปทรงเดียวกับไอคอน LINE พอดี — โลโก้ในแอปกับใน LINE เป็นสิ่งเดียวกัน | ที่ 20px เส้นขอบเริ่มกินพื้นที่ |
| **3** | **กล่องส้มอ่อน** `#FBE9DC` radius 9px | เป็น "ไอคอนแอป" ที่คุ้นตา หาตำแหน่งง่าย | minimal น้อยกว่า · กล่องเหลี่ยมกับหัวกลมแย่งกันเป็นรูปทรงหลัก |

**คำแนะนำของผม: แบบ 1** — สอดคล้องกับ Quiet chrome ที่สุด

---

## 8. สิ่งที่ต้องส่งกลับมา

### 8.1 ไฟล์ (SVG เป็นหลัก)

| ไฟล์ | รูปแบบ | ขนาด/หมายเหตุ |
| --- | --- | --- |
| `mascot-full.svg` | SVG | ครึ่งตัว + ป้ายแจ้งเตือน · viewBox กว้างพอให้ป้ายไม่ทับหน้า |
| `mascot-bust.svg` | SVG | ครึ่งตัว ไม่มีป้าย · viewBox สี่เหลี่ยมจัตุรัส |
| `mascot-head.svg` | SVG | เฉพาะหัว · viewBox สี่เหลี่ยมจัตุรัส · ต้องอ่านออกที่ 20px |
| `logo-lockup.svg` | SVG | mark + wordmark แนวนอน |
| `logo-mark.svg` | SVG | mark เดี่ยว |
| `favicon.svg` | SVG | หัว · ทดสอบที่ 16px และ 20px จริง |
| `line-channel-icon.png` | **PNG** | สี่เหลี่ยมจัตุรัส **1024×1024** · LINE จะครอบเป็นวงกลม → เนื้อหาสำคัญต้องอยู่ในวงกลมกลางภาพ |
| `og-image.png` | PNG | **1200×630** (มีไฟล์เดิม `public/og-v2.png` ให้แทนที่) |

**ข้อจำกัดของฟอร์ม LINE (เห็นจากหน้าจอจริง):** ไฟล์ต้องเป็น PNG / JPG / JPEG / GIF / BMP
และ **ไม่เกิน 3 MB**

### 8.2 ข้อกำหนดทางเทคนิคของ SVG

- ใช้ `fill` เป็น HEX ตรงๆ ไม่ต้องใช้ CSS variable (ไฟล์จะถูก inline เข้า React component)
- **ห้ามใช้ฟอนต์ใน SVG** — ถ้ามีตัวหนังสือ (เช่นป้าย "ออเดอร์ใหม่") ให้ทำเป็น path
  ไม่งั้นจะเพี้ยนบนเครื่องที่ไม่มีฟอนต์นั้น
- ไม่ต้องใส่ `width`/`height` ที่ root — ให้มีแต่ `viewBox` เพื่อให้ปรับขนาดได้อิสระ
- ตั้ง `id` ไม่ให้ชนกัน หรือไม่ใช้ `id` เลย (จะมีหลาย SVG อยู่ในหน้าเดียวกัน)
- ทำให้ไฟล์เล็กที่สุดเท่าที่ทำได้ (SVGO)

### 8.3 เช็คก่อนส่งกลับ

- [ ] ป้ายแจ้งเตือน**ไม่ทับหน้า** mascot
- [ ] เวอร์ชัน head อ่านออกที่ **20px** (ย่อดูจริง อย่าเดา)
- [ ] แสงเงาทิศเดียวกันทั้งภาพ
- [ ] โบว์ส้มอยู่ครบทั้ง 3 เวอร์ชัน
- [ ] ไม่มีสีนอกจากพาเลตต์ในข้อ 3.1 และ 6.2
- [ ] ไอคอน LINE: เนื้อหาสำคัญอยู่ในวงกลมกลางภาพ
- [ ] SVG ไม่มีการอ้างอิงฟอนต์

---

## 9. Prompt พร้อมคัดลอก (ภาษาอังกฤษ)

> คัดลอกทั้งบล็อกนี้ไปวางในเครื่องมือออกแบบ/AI อื่นได้เลย

```
Design a small brand system for "Pinto", a Thai seller-operations dashboard for
merchants selling across TikTok Shop, Shopee and LINE MyShop. Users are Thai small
shop owners, non-technical. The product must feel trustworthy enough to display
money, but warm — not like accounting software.

PALETTE (fixed, do not change these values)
  brand orange      #C85410
  orange dark       #9E3F08
  orange soft       #FBEFE7
  canvas beige      #F5F0EC
  surface white     #FFFFFF
  ink               #211D1B
  muted text        #766F6B
  soft text         #A29A95
  hairline          #EBE4DF
  success           #658B39 on #EDF4E7
  warning           #9A6A24 on #FFF2DD
  danger            #A94C3F on #F9EBE8

VISUAL TONE — "quiet chrome"
  Cards on a beige canvas, white fill, 1px #EBE4DF border, 8px radius, NO shadows.
  Buttons 7px radius, not pills. Large numbers at weight 600, not 700+.
  Change figures as plain text (+12.4%), never in a coloured pill.
  Secondary actions are plain text, no border, no fill.
  Labels 9px uppercase, letter-spacing .08em, colour #A29A95.
  Spacing scale 4/8/12/16/20/24/32. Base text 15px, never below 10px.
  Typeface: Noto Sans Thai. Icons: Lucide style, 18–21px, ~1.9 stroke.
  CRITICAL: orange may appear at most ~4 times per screen. Restraint is the point.

MASCOT — a Thai female online merchant, 25–35, confident and friendly, mid-work.
Soft rounded vector style, cute and approachable but disciplined by a small palette
so it still reads professional. Not a child character, not a fashion model.

  Pose "receiving an order": right hand holds a phone showing a short list;
  left arm tucks a kraft parcel box (orange tape stripe) against her side;
  a notification chip reading "ออเดอร์ใหม่ / +3 รายการ" floats BESIDE the phone
  with a tail pointing down at it.

  HARD CONSTRAINT: the notification must never overlap her face. Widen the canvas
  rather than pushing the chip inward.

  Depth requirements (this is the main ask — a flat version was rejected):
    - single light source from upper-left; shirt, apron and box all shade consistently
    - a cast shadow under the chin onto the neck, so the head does not float
    - at least one fold line on the apron
    - a lighter hair layer for volume, not a flat black mass
    - a soft elliptical ground shadow
    - eyebrows (the face is expressionless without them)
    - two side hair strands by the cheeks
    - an ORANGE hair-tie ring #C85410 around the bun — this is the character's
      signature mark and must appear in every version
    - faint blush ~28% opacity, small white catchlights in the eyes

  Mascot colours: hair #211D1B, hair highlight #3B312C, skin #F4D8C3,
  skin shadow #E9C7AE, shirt #F7EFE8, shirt shade #E9DCD2, apron #C85410,
  apron shade #9E3F08, apron highlight #EC8A4E, parcel #DCBB92 / #C9A479.

  Deliver THREE crops:
    full  — bust + phone + parcel + notification chip (for login / empty states)
    bust  — bust + phone + parcel, NO chip (medium illustrations)
    head  — head + bun + orange tie only (logo, favicon, LINE icon).
            Must stay legible at 20px — actually shrink it and check.

LOGO — mascot head as the mark, lockup horizontally with the wordmark "pinto":
  all lowercase, weight 600, letter-spacing -0.025em, ink #211D1B,
  and the dot over the "i" in ORANGE #C85410 — the only orange in the wordmark,
  echoing her hair tie. No tagline in the primary lockup.
  Mark container: [CHOOSE ONE — no container / thin 1.5px #211D1B circle /
  soft #FBE9DC rounded square]. Recommended: no container.

DELIVERABLES
  SVG: mascot-full, mascot-bust, mascot-head, logo-lockup, logo-mark, favicon
  PNG: line-channel-icon 1024×1024 square (LINE crops to a circle — keep the
       subject inside the central circle), og-image 1200×630

SVG RULES
  Plain HEX fills, no CSS variables. No font references — convert any text to paths.
  viewBox only, no width/height on the root. Avoid id collisions. Optimise with SVGO.
```

---

## 10. เมื่อได้ไฟล์กลับมา ผมจะทำอะไรต่อ

1. ใส่ไฟล์ลง `public/` และสร้าง React component สำหรับ mascot/logo
2. แทน `app/components/AppSidebar.tsx` ที่ตอนนี้ใช้ไอคอน `Store` ของ Lucide ในกล่องส้ม
3. แทน `app/login/page.tsx` — เพิ่ม mascot เวอร์ชัน full
4. แทน `public/favicon.svg` (ปัจจุบันเป็นไอคอน**สีฟ้า**ของ template เดิม ไม่เกี่ยวกับ Pinto)
5. จัดระเบียบ `app/globals.css` — เปลี่ยนชื่อ `--green` → `--brand`, ลบ `:root` ชุดเก่า
6. ปรับ radius/shadow/weight ทั้งระบบตามข้อ 4
7. อัปโหลด `line-channel-icon.png` เข้า LINE Developers Console

**สิ่งที่รอจากเกรพคู่ขนานกัน:** LINE Login channel (Channel ID + secret + callback URL)
สำหรับ PIN-0014
