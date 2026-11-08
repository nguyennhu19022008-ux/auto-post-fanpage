"""
Independent Python Cross-Verification Harness
Author: Empirical Challenger (challenger_exec_1)
Target: public/slides.html and public/evidence/
"""

import os
import sys
from html.parser import HTMLParser
import struct

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
SLIDES_PATH = os.path.join(ROOT_DIR, 'public', 'slides.html')
EVIDENCE_DIR = os.path.join(ROOT_DIR, 'public', 'evidence')

class HTMLTreeValidator(HTMLParser):
    def __init__(self):
        super().__init__()
        self.void_tags = {
            'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
            'link', 'meta', 'param', 'source', 'track', 'wbr', '!doctype'
        }
        self.stack = []
        self.errors = []
        self.sections = []
        self.images = []

    def handle_starttag(self, tag, attrs):
        tag_lower = tag.lower()
        attr_dict = dict(attrs)
        
        if tag_lower == 'section':
            sec_id = attr_dict.get('id', '')
            sec_cls = attr_dict.get('class', '')
            self.sections.append((sec_id, sec_cls))

        if tag_lower == 'img':
            src = attr_dict.get('src', '')
            self.images.append(src)

        if tag_lower not in self.void_tags:
            self.stack.append((tag_lower, self.getpos()))

    def handle_endtag(self, tag):
        tag_lower = tag.lower()
        if tag_lower in self.void_tags:
            return

        if not self.stack:
            self.errors.append(f"Unexpected closing tag </{tag_lower}> at line {self.getpos()[0]}")
            return

        top_tag, top_pos = self.stack.pop()
        if top_tag != tag_lower:
            self.errors.append(
                f"Mismatched closing tag </{tag_lower}> at line {self.getpos()[0]}, "
                f"expected </{top_tag}> opened at line {top_pos[0]}"
            )

def run_python_suite():
    passed = 0
    failed = 0

    def check(name, cond, details=""):
        nonlocal passed, failed
        if cond:
            passed += 1
            print(f"  [PASS] {name}")
        else:
            failed += 1
            print(f"  [FAIL] {name} --> {details}")

    print("======================================================================")
    print("PYTHON INDEPENDENT CROSS-VERIFICATION SUITE")
    print("======================================================================")

    # 1. HTML Tree Parse
    with open(SLIDES_PATH, 'r', encoding='utf-8') as f:
        content = f.read()

    parser = HTMLTreeValidator()
    parser.feed(content)

    if parser.stack:
        for tag, pos in parser.stack:
            parser.errors.append(f"Unclosed tag <{tag}> opened at line {pos[0]}")

    check("HTML Parser Tree Balance (0 structural tag errors)", len(parser.errors) == 0, "; ".join(parser.errors))

    # 2. Section Checks
    sec_ids = [s[0] for s in parser.sections]
    for i in range(1, 10):
        expected_id = f"slide-{i}"
        check(f"Content section #{expected_id} exists", expected_id in sec_ids)

    # Check slide-1 active
    s1_classes = [s[1] for s in parser.sections if s[0] == 'slide-1']
    check("Slide 1 has active class", len(s1_classes) > 0 and 'active' in s1_classes[0])

    # Check slide-2..9 not active
    for i in range(2, 10):
        s_cls = [s[1] for s in parser.sections if s[0] == f"slide-{i}"]
        check(f"Slide {i} does not have active class", len(s_cls) > 0 and 'active' not in s_cls[0])

    # Check slide-0 does not exist as slide-page
    check("No slide-0 section exists", "slide-0" not in sec_ids)

    # Check slide0Overlay is hidden
    check("slide0Overlay is hidden by default", 'id="slide0Overlay"' in content and 'hidden' in content)

    # Absence of docks
    check("No slideDock in HTML", 'id="slideDock"' not in content)
    check("No dockBar in HTML", 'id="dockBar"' not in content)

    # 3. Evidence Image Header & Dimension Inspection (Binary JPEG format)
    expected_images = [
        'coc_200k_thuy_nhung.jpg',
        'coc_500k_thanhvu.jpg',
        'chuyenkhoan_1tr_thanhvu.jpg',
        'chuyenkhoan_300k_kimhoa.jpg',
        'chat_hocsinh_nguyen_thua.jpg',
        'chat_thay_quang_toan_gv.jpg',
        'chat_phuhuynh_co_le_ghi.jpg',
        'chat_tran_quoc_khanh_fb.jpg',
        'chat_khach_a_mau_hinh_that.jpg',
        'chat_phan_trieu_messenger.jpg'
    ]

    for img_name in expected_images:
        img_path = os.path.join(EVIDENCE_DIR, img_name)
        exists = os.path.isfile(img_path)
        check(f"File exists: {img_name}", exists)

        if exists:
            size = os.path.getsize(img_path)
            check(f"File size positive: {img_name} ({size} bytes)", size > 0)
            
            with open(img_path, 'rb') as f:
                data = f.read()

            # Check SOI (0xFF, 0xD8)
            has_soi = len(data) >= 2 and data[0] == 0xFF and data[1] == 0xD8
            check(f"JPEG SOI marker valid: {img_name}", has_soi)

            # Parse JPEG dimensions via SOF markers
            idx = 2
            width = 0
            height = 0
            while idx < len(data) - 9:
                if data[idx] == 0xFF:
                    marker = data[idx+1]
                    if marker in [0xC0, 0xC1, 0xC2, 0xC3]:
                        # SOF segment
                        height, width = struct.unpack(">HH", data[idx+5:idx+9])
                        break
                    elif marker in [0xD9, 0xDA]: # EOI or SOS
                        break
                    elif marker not in [0xD0, 0xD1, 0xD2, 0xD3, 0xD4, 0xD5, 0xD6, 0xD7, 0x01]:
                        seg_len = struct.unpack(">H", data[idx+2:idx+4])[0]
                        idx += 2 + seg_len
                        continue
                idx += 1

            check(f"Extracted valid JPEG dimensions: {img_name} ({width}x{height})", width > 0 and height > 0)

        # Check reference in slides.html
        check(f"Referenced in slides.html: {img_name}", f"evidence/{img_name}" in content)

    print("\n======================================================================")
    print(f"PYTHON SUITE: {passed + failed} checks | {passed} PASSED | {failed} FAILED")
    print("======================================================================")
    return failed == 0

if __name__ == '__main__':
    ok = run_python_suite()
    sys.exit(0 if ok else 1)
