"""작품의 저장된 프롬프트, 로어북, 캐릭터 MD를 하나로 조립한다.

사용: python assemble_work.py 작품ID --platform 알플레이
      python assemble_work.py 작품ID --platform 알플레이 --output 작품.md
"""

import argparse
from datetime import datetime
import json
from pathlib import Path
import re
import sys
import unicodedata
from data_paths import DATA_DIR


def read_text(file):
    raw = file.read_bytes()
    try:
        return raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        return raw.decode("cp949")


def read_json(file, fallback=None):
    return json.loads(read_text(file)) if file.exists() else fallback


def safe_id(value):
    value = unicodedata.normalize("NFKC", str(value or "")).strip().lower()
    return re.sub(r"-+", "-", "".join(
        char if unicodedata.category(char)[0] in "LN" else "-"
        for char in value
    )).strip("-") or "default"


def contained(root, *parts):
    result = root.joinpath(*parts).resolve()
    if not result.is_relative_to(root.resolve()):
        raise ValueError("작품 폴더 밖의 파일은 읽을 수 없습니다.")
    return result


def field_text(directory, field, metadata):
    file = contained(directory, f"{field}.md")
    return read_text(file) if file.exists() else str(metadata.get(field) or "")


def heading(value):
    return " ".join(str(value).splitlines()).strip()


def collection_sections(directory, character=False):
    """JSON 본문과 MD 사이드카를 중복 없이 읽으며 MD 단독 항목도 포함한다."""
    sections = []
    used = set()
    for file in sorted(directory.glob("*.json")):
        metadata = read_json(contained(directory, file.name))
        if not isinstance(metadata, dict):
            raise ValueError(f"올바르지 않은 항목: {file.name}")
        body_name = file.with_suffix(".md").name
        if not character:
            body_name = metadata.get("bodyFile") or body_name
        body_file = contained(directory, body_name)
        if body_file.exists():
            body = read_text(body_file)
            used.add(body_file)
        elif not character and (metadata.get("bodyFile") or metadata.get("bodyStorage") == "sidecar-md-v1"):
            raise ValueError(f"로어북 본문 파일이 없습니다: {body_name}")
        else:
            body = str(metadata.get("prompt" if character else "body") or "")
        title = metadata.get("name" if character else "title") or file.stem
        section = f"### {heading(title)}\n\n"
        if not character and metadata.get("triggers"):
            section += "트리거: " + ", ".join(map(str, metadata["triggers"])) + "\n\n"
        sections.append(section + body)
    for file in sorted(directory.glob("*.md")):
        file = contained(directory, file.name)
        if file not in used:
            sections.append(f"### {heading(file.stem)}\n\n{read_text(file)}")
    return sections


def assemble_work(data_dir, work_id, platform="알플레이"):
    data_dir = Path(data_dir).resolve()
    work_dir = contained(data_dir, "works", work_id)
    platform_dir = contained(work_dir, platform)
    if not platform_dir.is_dir():
        raise ValueError("선택한 작품·플랫폼 폴더가 없습니다.")
    works = read_json(data_dir / "works.json", [])
    name = next((work.get("name", work_id) for work in works if work.get("id") == work_id), work_id)
    prompts = read_json(contained(platform_dir, "prompts.json"), {})
    prompt_dir = contained(platform_dir, "prompts")
    sections = [
        f"# {heading(name)} ({heading(platform)})",
        "## 메인 프롬프트\n\n<!-- 공통 프롬 -->\n\n" + field_text(prompt_dir, "mainPrompt", prompts),
    ]
    for index, version in enumerate(prompts.get("versions", [])):
        title = version.get("name") or version.get("id") or "시작상황"
        version_dir = contained(prompt_dir, safe_id(version.get("id")))
        sections.append(f"## {heading(title)}\n\n<!-- 각 설정 -->")
        background = dict(version)
        if "worldStory" not in background:
            background["worldStory"] = field_text(prompt_dir, "worldStory", prompts)
        sections.append("### 월드스토리\n\n" + field_text(version_dir, "worldStory", background))
        additional = field_text(version_dir, "additionalPrompt", version)
        if additional:
            sections.append("### 기존 추가 지침\n\n" + additional)
        starter_message = field_text(version_dir, "starterMessage", version)
        starter_prompt = field_text(version_dir, "starterPrompt", version)
        node_type = version.get("nodeType")
        is_start = node_type == "start" if node_type in ("start", "normal") else bool(
            starter_message or starter_prompt or index == 0
        )
        if is_start:
            sections.append("### 시작프롬\n\n" + starter_prompt)
            sections.append("### 시작메시지\n\n" + starter_message)
    sections.append("## 공통 로어북")
    sections.extend(collection_sections(contained(platform_dir, "lorebook")))
    sections.append("## 캐릭터 md")
    sections.extend(collection_sections(contained(platform_dir, "characters"), character=True))
    return "\n\n".join(sections) + "\n"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("work_id")
    parser.add_argument("--platform", default="알플레이")
    parser.add_argument("--data-dir", type=Path, default=DATA_DIR)
    parser.add_argument("--output", type=Path)
    parser.add_argument("--stdout", action="store_true", help="파일 대신 UTF-8 표준 출력으로 반환")
    args = parser.parse_args()
    try:
        document = assemble_work(args.data_dir, args.work_id, args.platform)
        if args.stdout:
            sys.stdout.buffer.write(document.encode("utf-8"))
        else:
            output = args.output or args.data_dir / "exports" / (
                f"{safe_id(args.work_id)}_{safe_id(args.platform)}_전체_{datetime.now():%Y%m%d_%H%M%S_%f}.md"
            )
            output.parent.mkdir(parents=True, exist_ok=True)
            # 같은 이름의 기존 파일은 덮어쓰지 않는다.
            with output.open("x", encoding="utf-8", newline="\n") as stream:
                stream.write(document)
            print(str(output.resolve()))
    except (OSError, ValueError, TypeError, AttributeError) as error:
        sys.stderr.buffer.write(f"MD 조립 실패: {error}\n".encode("utf-8"))
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
