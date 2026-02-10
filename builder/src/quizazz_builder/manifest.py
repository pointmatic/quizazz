# Copyright (c) 2026 Pointmatic
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""Build a navigation tree from validated quiz files and directory hierarchy."""

from __future__ import annotations

from pathlib import Path, PurePosixPath

from quizazz_builder.compiler import question_id
from quizazz_builder.models import Question, QuizFile, SubtopicGroup


def _slugify(text: str) -> str:
    """Convert a subtopic name to a URL-safe slug."""
    return text.strip().lower().replace(" ", "-")


def _topic_id(relative_path: Path) -> str:
    """Derive a topic ID from a relative file path (without extension)."""
    return str(PurePosixPath(relative_path.with_suffix("")))


def _build_topic_node(
    relative_path: Path, quiz_file: QuizFile
) -> dict:
    """Build a topic node (and subtopic children) from a single QuizFile."""
    topic = _topic_id(relative_path)
    all_question_ids: list[str] = []
    children: list[dict] = []

    for item in quiz_file.questions:
        if isinstance(item, SubtopicGroup):
            sub_qids = [question_id(q.question) for q in item.questions]
            all_question_ids.extend(sub_qids)
            children.append(
                {
                    "type": "subtopic",
                    "id": f"{topic}/{_slugify(item.subtopic)}",
                    "label": item.subtopic,
                    "description": "",
                    "questionIds": sub_qids,
                    "children": [],
                }
            )
        else:
            all_question_ids.append(question_id(item.question))

    node: dict = {
        "type": "topic",
        "id": topic,
        "label": quiz_file.menu_name,
        "description": quiz_file.menu_description,
        "questionIds": all_question_ids,
        "children": children,
    }
    return node


def _insert_into_tree(
    tree: list[dict], parts: list[str], topic_node: dict
) -> None:
    """Insert a topic node into the tree, creating directory nodes as needed.

    *parts* is the list of directory segments leading to the topic file.
    For a file at the root (no directory), *parts* is empty and the topic
    node is appended directly to *tree*.
    """
    if not parts:
        tree.append(topic_node)
        return

    dir_name = parts[0]
    dir_id = "/".join(parts[: 1])

    # Find or create the directory node for this segment.
    existing = None
    for node in tree:
        if node["type"] == "directory" and node["id"] == dir_id:
            existing = node
            break

    if existing is None:
        existing = {
            "type": "directory",
            "id": dir_id,
            "label": dir_name,
            "description": "",
            "questionIds": [],
            "children": [],
        }
        tree.append(existing)

    _insert_into_tree(existing["children"], parts[1:], topic_node)


def _aggregate_question_ids(tree: list[dict]) -> None:
    """Walk the tree bottom-up and aggregate questionIds into directory nodes."""
    for node in tree:
        if node["type"] == "directory":
            _aggregate_question_ids(node["children"])
            aggregated: list[str] = []
            for child in node["children"]:
                aggregated.extend(child["questionIds"])
            node["questionIds"] = aggregated


def build_navigation_tree(
    validated_files: list[tuple[Path, QuizFile]],
) -> list[dict]:
    """Build a navigation tree from validated quiz files.

    Each file becomes a topic node.  Subtopic groups within a file become
    subtopic child nodes.  Directory structure is reflected as directory
    nodes that aggregate their children's question IDs.

    Args:
        validated_files: List of (relative_path, QuizFile) tuples as
            returned by :func:`validate_quiz_directory`.

    Returns:
        A list of top-level tree nodes (topic, directory, or subtopic dicts).
    """
    tree: list[dict] = []

    for relative_path, quiz_file in validated_files:
        topic_node = _build_topic_node(relative_path, quiz_file)
        dir_parts = list(relative_path.parent.parts)
        # Filter out "." which Path(".").parts returns for root-level files
        dir_parts = [p for p in dir_parts if p != "."]
        _insert_into_tree(tree, dir_parts, topic_node)

    _aggregate_question_ids(tree)

    return tree
