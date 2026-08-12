from __future__ import annotations

import shutil
import subprocess
from collections.abc import Callable, Iterable
from dataclasses import dataclass
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

OUTPUT_WIDTH = 1080
OUTPUT_HEIGHT = 1920
OUTPUT_FPS = 30
CLIP_SECONDS = 2.0
ROLE_ORDER = {"before": 0, "process": 1, "detail": 2, "after": 3}
SELECTIONS = {"start", "center", "end"}


@dataclass(frozen=True)
class ClipInput:
    path: Path
    role: str
    selection: str
    caption: str


@dataclass(frozen=True)
class VideoResult:
    duration_sec: float
    width: int
    height: int
    faces_blurred: int


def ordered_clips(clips: Iterable[ClipInput]) -> list[ClipInput]:
    """Keep upload order inside the same role and arrange the story roles."""
    return sorted(clips, key=lambda clip: ROLE_ORDER.get(clip.role, len(ROLE_ORDER)))


def segment_start(duration_sec: float, selection: str) -> float:
    if selection not in SELECTIONS:
        raise ValueError(f"unsupported selection: {selection}")
    remaining = max(0.0, duration_sec - CLIP_SECONDS)
    if selection == "center":
        return remaining / 2
    if selection == "end":
        return remaining
    return 0.0


def center_crop(
    frame: np.ndarray, width: int = OUTPUT_WIDTH, height: int = OUTPUT_HEIGHT
) -> np.ndarray:
    """Resize to fill a 9:16 canvas, then crop the overflowing axis."""
    source_height, source_width = frame.shape[:2]
    if source_width <= 0 or source_height <= 0:
        raise ValueError("empty video frame")
    scale = max(width / source_width, height / source_height)
    resized_width = max(width, round(source_width * scale))
    resized_height = max(height, round(source_height * scale))
    resized = cv2.resize(
        frame, (resized_width, resized_height), interpolation=cv2.INTER_AREA
    )
    left = (resized_width - width) // 2
    top = (resized_height - height) // 2
    return resized[top : top + height, left : left + width]


class CpuFaceBlurrer:
    """OpenCV Haar detection only; this class never initializes CUDA."""

    def __init__(self) -> None:
        cascade_path = (
            Path(cv2.data.haarcascades) / "haarcascade_frontalface_default.xml"
        )
        self._cascade = cv2.CascadeClassifier(str(cascade_path))
        if self._cascade.empty():
            raise RuntimeError("OpenCV face detector could not be loaded")

    def detect(self, frame: np.ndarray) -> list[tuple[int, int, int, int]]:
        preview_width = 480
        scale = min(1.0, preview_width / frame.shape[1])
        preview = cv2.resize(
            frame, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA
        )
        gray = cv2.cvtColor(preview, cv2.COLOR_BGR2GRAY)
        faces = self._cascade.detectMultiScale(
            gray,
            scaleFactor=1.1,
            minNeighbors=5,
            minSize=(32, 32),
        )
        inverse = 1 / scale
        return [tuple(round(value * inverse) for value in face) for face in faces]

    @staticmethod
    def apply(
        frame: np.ndarray, faces: Iterable[tuple[int, int, int, int]]
    ) -> np.ndarray:
        height, width = frame.shape[:2]
        for x, y, face_width, face_height in faces:
            margin_x = round(face_width * 0.16)
            margin_y = round(face_height * 0.2)
            x1 = max(0, x - margin_x)
            y1 = max(0, y - margin_y)
            x2 = min(width, x + face_width + margin_x)
            y2 = min(height, y + face_height + margin_y)
            region = frame[y1:y2, x1:x2]
            if region.size:
                kernel = max(31, (min(region.shape[:2]) // 4) | 1)
                frame[y1:y2, x1:x2] = cv2.GaussianBlur(region, (kernel, kernel), 0)
        return frame


def _font_path() -> Path | None:
    repo_root = Path(__file__).resolve().parents[4]
    candidates = (
        repo_root / "frontend" / "src" / "fonts" / "PretendardVariable.woff2",
        Path("/usr/share/fonts/truetype/nanum/NanumGothicBold.ttf"),
        Path("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"),
    )
    return next((path for path in candidates if path.exists()), None)


def _caption_overlay(caption: str) -> tuple[np.ndarray, np.ndarray] | None:
    caption = caption.strip()
    if not caption:
        return None
    canvas = Image.new("RGBA", (OUTPUT_WIDTH, OUTPUT_HEIGHT), (0, 0, 0, 0))
    draw = ImageDraw.Draw(canvas)
    font_path = _font_path()
    font = (
        ImageFont.truetype(str(font_path), 52)
        if font_path
        else ImageFont.load_default()
    )

    lines: list[str] = []
    current = ""
    for character in caption[:80]:
        candidate = current + character
        if draw.textlength(candidate, font=font) > OUTPUT_WIDTH - 180 and current:
            lines.append(current)
            current = character
        else:
            current = candidate
    if current:
        lines.append(current)

    line_height = 68
    box_height = line_height * len(lines) + 48
    top = round(OUTPUT_HEIGHT * 0.76) - box_height // 2
    draw.rounded_rectangle(
        (64, top, OUTPUT_WIDTH - 64, top + box_height),
        radius=28,
        fill=(0, 0, 0, 170),
    )
    for index, line in enumerate(lines):
        bbox = draw.textbbox((0, 0), line, font=font)
        text_width = bbox[2] - bbox[0]
        draw.text(
            ((OUTPUT_WIDTH - text_width) / 2, top + 24 + index * line_height),
            line,
            font=font,
            fill=(255, 255, 255, 255),
        )

    rgba = np.asarray(canvas)
    return rgba[:, :, :3][:, :, ::-1], rgba[:, :, 3:4].astype(np.float32) / 255


def _apply_caption(
    frame: np.ndarray, overlay: tuple[np.ndarray, np.ndarray] | None
) -> np.ndarray:
    if overlay is None:
        return frame
    color, alpha = overlay
    return (frame * (1 - alpha) + color * alpha).astype(np.uint8)


def _duration(capture: cv2.VideoCapture) -> float:
    fps = capture.get(cv2.CAP_PROP_FPS)
    frames = capture.get(cv2.CAP_PROP_FRAME_COUNT)
    if fps <= 0 or frames <= 0:
        raise ValueError("video duration could not be read")
    return frames / fps


def process_shorts(
    clips: Iterable[ClipInput],
    output_path: Path,
    *,
    blur_faces: bool = True,
    progress: Callable[[int], None] | None = None,
) -> VideoResult:
    """Create one silent H.264 9:16 video using only CPU processing."""
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        raise RuntimeError("ffmpeg is not installed")

    clips = ordered_clips(clips)
    if not clips:
        raise ValueError("at least one clip is required")
    output_path.parent.mkdir(parents=True, exist_ok=True)
    command = [
        ffmpeg,
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-f",
        "rawvideo",
        "-pix_fmt",
        "bgr24",
        "-s",
        f"{OUTPUT_WIDTH}x{OUTPUT_HEIGHT}",
        "-r",
        str(OUTPUT_FPS),
        "-i",
        "-",
        "-an",
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        "23",
        "-pix_fmt",
        "yuv420p",
        "-movflags",
        "+faststart",
        str(output_path),
    ]
    encoder = subprocess.Popen(command, stdin=subprocess.PIPE, stderr=subprocess.PIPE)
    blurrer = CpuFaceBlurrer() if blur_faces else None
    total_frames = 0
    faces_blurred = 0
    try:
        assert encoder.stdin is not None
        for clip_index, clip in enumerate(clips):
            capture = cv2.VideoCapture(str(clip.path))
            try:
                duration = _duration(capture)
                segment_duration = min(CLIP_SECONDS, duration)
                start = segment_start(duration, clip.selection)
                frame_count = max(1, round(segment_duration * OUTPUT_FPS))
                caption = _caption_overlay(clip.caption)
                faces: list[tuple[int, int, int, int]] = []
                for index in range(frame_count):
                    capture.set(
                        cv2.CAP_PROP_POS_MSEC, (start + index / OUTPUT_FPS) * 1000
                    )
                    ok, frame = capture.read()
                    if not ok:
                        break
                    frame = center_crop(frame)
                    if blurrer:
                        faces = blurrer.detect(frame)
                        faces_blurred += len(faces)
                        frame = blurrer.apply(frame, faces)
                    frame = _apply_caption(frame, caption)
                    encoder.stdin.write(frame.tobytes())
                    total_frames += 1
            finally:
                capture.release()
            if progress:
                progress(round((clip_index + 1) / len(clips) * 95))
        encoder.stdin.close()
        stderr = (
            encoder.stderr.read().decode("utf-8", errors="replace")
            if encoder.stderr
            else ""
        )
        return_code = encoder.wait()
        if return_code != 0:
            raise RuntimeError(f"ffmpeg failed: {stderr.strip()}")
        if total_frames == 0:
            raise ValueError("no readable video frames")
    except Exception:
        if encoder.stdin and not encoder.stdin.closed:
            encoder.stdin.close()
        encoder.kill()
        output_path.unlink(missing_ok=True)
        raise

    if progress:
        progress(100)
    return VideoResult(
        duration_sec=round(total_frames / OUTPUT_FPS, 3),
        width=OUTPUT_WIDTH,
        height=OUTPUT_HEIGHT,
        faces_blurred=faces_blurred,
    )
