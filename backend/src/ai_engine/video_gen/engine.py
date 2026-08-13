from __future__ import annotations

import shutil
import subprocess
import tempfile
from bisect import bisect_left
from collections.abc import Callable, Generator, Iterable
from dataclasses import dataclass
from pathlib import Path
from typing import BinaryIO

import cv2
import numpy as np

OUTPUT_WIDTH = 1080
OUTPUT_HEIGHT = 1920
OUTPUT_FPS = 30
CLIP_SECONDS = 2.0
MIN_CLIPS = 2
MAX_CLIPS = 8
MAX_DECODE_DIMENSION = 1920
FACE_PROXY_WIDTH = 640
FACE_SAMPLE_INTERVAL = 5
YUNET_THRESHOLD = 0.60
YUNET_MODEL_PATH = (
    Path(__file__).resolve().parent / "models" / "face_detection_yunet_2023mar.onnx"
)
SELFIE_SEGMENTER_MODEL_PATH = (
    Path(__file__).resolve().parent / "models" / "selfie_multiclass_256x256.tflite"
)
FACE_SKIN_CLASS = 3
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


@dataclass(frozen=True)
class NormalizedFaceBox:
    """Face box in uncropped source coordinates normalized to 0..1."""

    x: float
    y: float
    width: float
    height: float


@dataclass(frozen=True)
class FaceDetection:
    box: NormalizedFaceBox
    score: float


@dataclass(frozen=True)
class FaceTrack:
    """One primary-face coordinate per output frame after interpolation."""

    boxes: tuple[NormalizedFaceBox | None, ...]
    sampled_frames: int
    detected_samples: int


@dataclass(frozen=True)
class RenderGeometry:
    resized_width: int
    resized_height: int
    crop_x: tuple[int, ...]
    crop_y: tuple[int, ...]
    blur_x: tuple[int, ...]
    blur_y: tuple[int, ...]
    blur_width: int
    blur_height: int
    face_present: tuple[bool, ...]


@dataclass(frozen=True)
class ClipPlan:
    clip: ClipInput
    start_sec: float
    segment_duration_sec: float
    frame_count: int
    source_width: int
    source_height: int
    track: FaceTrack
    geometry: RenderGeometry


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


class YuNetFaceDetector:
    """CPU-only YuNet detector backed by the model shipped with the service."""

    def __init__(self, model_path: Path = YUNET_MODEL_PATH) -> None:
        if not model_path.is_file():
            raise RuntimeError(f"YuNet model not found: {model_path}")
        temporary_model: Path | None = None
        detector_path = model_path
        try:
            if not str(model_path).isascii():
                with tempfile.NamedTemporaryFile(suffix=".onnx", delete=False) as temp:
                    temp.write(model_path.read_bytes())
                    temporary_model = Path(temp.name)
                detector_path = temporary_model
            self._detector = cv2.FaceDetectorYN_create(
                str(detector_path), "", (320, 320), 0.6, 0.3, 5000
            )
        finally:
            if temporary_model:
                temporary_model.unlink(missing_ok=True)

    def detect(self, frame: np.ndarray) -> list[FaceDetection]:
        frame_height, frame_width = frame.shape[:2]
        if frame_width <= 0 or frame_height <= 0:
            raise ValueError("empty face detection frame")
        self._detector.setInputSize((frame_width, frame_height))
        _, faces = self._detector.detect(frame)
        if faces is None:
            return []

        result = []
        for face in faces:
            score = float(face[-1])
            if score < YUNET_THRESHOLD:
                continue
            x, y, width, height = (float(value) for value in face[:4])
            x1 = max(0.0, min(float(frame_width), x))
            y1 = max(0.0, min(float(frame_height), y))
            x2 = max(x1, min(float(frame_width), x + width))
            y2 = max(y1, min(float(frame_height), y + height))
            if x2 <= x1 or y2 <= y1:
                continue
            result.append(
                FaceDetection(
                    box=NormalizedFaceBox(
                        x=x1 / frame_width,
                        y=y1 / frame_height,
                        width=(x2 - x1) / frame_width,
                        height=(y2 - y1) / frame_height,
                    ),
                    score=score,
                )
            )
        return result


class MediaPipeFaceSkinSegmenter:
    """CPU MediaPipe segmenter that returns only the face-skin class."""

    def __init__(self, model_path: Path = SELFIE_SEGMENTER_MODEL_PATH) -> None:
        if not model_path.is_file():
            raise RuntimeError(f"MediaPipe segmenter model not found: {model_path}")
        try:
            import mediapipe as mp
        except ImportError as error:
            raise RuntimeError("mediapipe is not installed") from error

        self._mp = mp
        self._temporary_model: Path | None = None
        segmenter_path = model_path
        if not str(model_path).isascii():
            with tempfile.NamedTemporaryFile(suffix=".tflite", delete=False) as temp:
                temp.write(model_path.read_bytes())
                self._temporary_model = Path(temp.name)
            segmenter_path = self._temporary_model
        options = mp.tasks.vision.ImageSegmenterOptions(
            base_options=mp.tasks.BaseOptions(model_asset_path=str(segmenter_path)),
            running_mode=mp.tasks.vision.RunningMode.IMAGE,
            output_category_mask=True,
            output_confidence_masks=False,
        )
        try:
            self._segmenter = mp.tasks.vision.ImageSegmenter.create_from_options(
                options
            )
        except BaseException:
            if self._temporary_model:
                self._temporary_model.unlink(missing_ok=True)
            raise

    def segment(self, frame: np.ndarray) -> np.ndarray:
        rgb = np.ascontiguousarray(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
        image = self._mp.Image(
            image_format=self._mp.ImageFormat.SRGB,
            data=rgb,
        )
        result = self._segmenter.segment(image)
        if result.category_mask is None:
            raise RuntimeError("MediaPipe did not return a category mask")
        categories = np.squeeze(result.category_mask.numpy_view())
        return np.where(categories == FACE_SKIN_CLASS, 255, 0).astype(np.uint8)

    def close(self) -> None:
        try:
            self._segmenter.close()
        finally:
            if self._temporary_model:
                self._temporary_model.unlink(missing_ok=True)


def _font_path() -> Path | None:
    repo_root = Path(__file__).resolve().parents[4]
    candidates = (
        Path("/usr/share/fonts/truetype/nanum/NanumGothicBold.ttf"),
        Path("C:/Windows/Fonts/malgunbd.ttf"),
        repo_root / "frontend" / "src" / "fonts" / "PretendardVariable.woff2",
        Path("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"),
    )
    return next((path for path in candidates if path.exists()), None)


def _wrap_caption(caption: str, line_length: int = 17) -> str:
    caption = " ".join(caption.strip().split())[:80]
    lines: list[str] = []
    current = ""
    for word in caption.split(" "):
        candidate = f"{current} {word}".strip()
        if current and len(candidate) > line_length:
            lines.append(current)
            current = word
        else:
            current = candidate
        while len(current) > line_length:
            lines.append(current[:line_length])
            current = current[line_length:]
    if current:
        lines.append(current)
    return "\n".join(lines)


def _filter_path(path: Path) -> str:
    return str(path).replace("\\", "/").replace(":", r"\:").replace("'", r"\'")


def _caption_filter(caption_path: Path) -> str:
    font_path = _font_path()
    if font_path is None:
        raise RuntimeError("a caption font could not be found")
    return (
        f"drawtext=fontfile='{_filter_path(font_path)}':"
        f"textfile='{_filter_path(caption_path)}':expansion=none:"
        "fontcolor=white:fontsize=52:line_spacing=16:"
        "box=1:boxcolor=black@0.67:boxborderw=24:"
        "x=(w-text_w)/2:y=h*0.76-(text_h/2):fix_bounds=1"
    )


def _duration(capture: cv2.VideoCapture) -> float:
    fps = capture.get(cv2.CAP_PROP_FPS)
    frames = capture.get(cv2.CAP_PROP_FRAME_COUNT)
    if fps <= 0 or frames <= 0:
        raise ValueError("video duration could not be read")
    return frames / fps


def _decoder_command(
    ffmpeg: str,
    path: Path,
    start_sec: float,
    duration_sec: float,
    frame_count: int,
    width: int,
    height: int,
) -> list[str]:
    return [
        ffmpeg,
        "-hide_banner",
        "-loglevel",
        "error",
        "-ss",
        f"{start_sec:.6f}",
        "-i",
        str(path),
        "-t",
        f"{duration_sec:.6f}",
        "-an",
        "-vf",
        f"fps={OUTPUT_FPS},scale={width}:{height}",
        "-frames:v",
        str(frame_count),
        "-f",
        "rawvideo",
        "-pix_fmt",
        "bgr24",
        "pipe:1",
    ]


def _scaled_dimensions(
    width: int, height: int, max_dimension: int = MAX_DECODE_DIMENSION
) -> tuple[int, int]:
    if width <= 0 or height <= 0 or max_dimension <= 0:
        raise ValueError("video dimensions must be positive")
    if max(width, height) <= max_dimension:
        return width, height
    scale = max_dimension / max(width, height)
    scaled_width = max(2, round(width * scale / 2) * 2)
    scaled_height = max(2, round(height * scale / 2) * 2)
    return scaled_width, scaled_height


def _read_exact(stream: BinaryIO, size: int) -> bytes:
    data = bytearray(size)
    view = memoryview(data)
    offset = 0
    while offset < size:
        count = stream.readinto(view[offset:])
        if not count:
            break
        offset += count
    return bytes(view[:offset])


def _face_sample_indexes(
    frame_count: int, interval: int = FACE_SAMPLE_INTERVAL
) -> list[int]:
    if frame_count <= 0 or interval <= 0:
        raise ValueError("frame count and sample interval must be positive")
    return sorted(set(range(0, frame_count, interval)) | {frame_count - 1})


def _face_proxy_dimensions(width: int, height: int) -> tuple[int, int]:
    if width <= 0 or height <= 0:
        raise ValueError("video dimensions must be positive")
    proxy_height = max(2, round(height * FACE_PROXY_WIDTH / width / 2) * 2)
    return FACE_PROXY_WIDTH, proxy_height


def _sampled_proxy_command(
    ffmpeg: str,
    path: Path,
    start_sec: float,
    duration_sec: float,
    frame_count: int,
    width: int,
    height: int,
    interval: int = FACE_SAMPLE_INTERVAL,
) -> tuple[list[str], list[int], tuple[int, int]]:
    indexes = _face_sample_indexes(frame_count, interval)
    proxy_width, proxy_height = _face_proxy_dimensions(width, height)
    select = f"select=not(mod(n\\,{interval}))+eq(n\\,{frame_count - 1})"
    command = [
        ffmpeg,
        "-hide_banner",
        "-loglevel",
        "error",
        "-ss",
        f"{start_sec:.6f}",
        "-i",
        str(path),
        "-t",
        f"{duration_sec + 1 / OUTPUT_FPS:.6f}",
        "-an",
        "-vf",
        f"fps={OUTPUT_FPS},{select},scale={proxy_width}:{proxy_height}",
        "-fps_mode",
        "passthrough",
        "-frames:v",
        str(len(indexes)),
        "-f",
        "rawvideo",
        "-pix_fmt",
        "bgr24",
        "pipe:1",
    ]
    return command, indexes, (proxy_width, proxy_height)


def _sampled_proxy_frames(
    ffmpeg: str,
    path: Path,
    start_sec: float,
    duration_sec: float,
    frame_count: int,
    width: int,
    height: int,
    interval: int = FACE_SAMPLE_INTERVAL,
) -> Generator[tuple[int, np.ndarray], None, None]:
    command, indexes, (proxy_width, proxy_height) = _sampled_proxy_command(
        ffmpeg,
        path,
        start_sec,
        duration_sec,
        frame_count,
        width,
        height,
        interval,
    )
    decoder = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    frame_size = proxy_width * proxy_height * 3
    try:
        assert decoder.stdout is not None
        for sample_number, frame_index in enumerate(indexes):
            raw = _read_exact(decoder.stdout, frame_size)
            if len(raw) != frame_size:
                raise ValueError(
                    "video ended before face samples were decoded "
                    f"({sample_number}/{len(indexes)} samples)"
                )
            yield (
                frame_index,
                np.frombuffer(raw, dtype=np.uint8).reshape(
                    (proxy_height, proxy_width, 3)
                ),
            )

        extra = decoder.stdout.read(1)
        stderr = (
            decoder.stderr.read().decode("utf-8", errors="replace")
            if decoder.stderr
            else ""
        )
        return_code = decoder.wait()
        if return_code != 0:
            raise RuntimeError(f"ffmpeg face sampling failed: {stderr.strip()}")
        if extra:
            raise RuntimeError("ffmpeg decoded more face samples than requested")
    except BaseException:
        decoder.kill()
        decoder.wait()
        raise
    finally:
        if decoder.stdout:
            decoder.stdout.close()
        if decoder.stderr:
            decoder.stderr.close()


def _interpolate_face_boxes(
    sampled: dict[int, NormalizedFaceBox | None], frame_count: int
) -> tuple[NormalizedFaceBox | None, ...]:
    detected = sorted(index for index, box in sampled.items() if box is not None)
    if not detected:
        return (None,) * frame_count

    result: list[NormalizedFaceBox | None] = []
    for frame_index in range(frame_count):
        insertion = bisect_left(detected, frame_index)
        left_index = detected[max(0, insertion - 1)]
        right_index = detected[min(insertion, len(detected) - 1)]
        if insertion < len(detected) and detected[insertion] == frame_index:
            left_index = right_index = frame_index

        left = sampled[left_index]
        right = sampled[right_index]
        assert left is not None and right is not None
        if left_index == right_index:
            result.append(left)
            continue

        ratio = (frame_index - left_index) / (right_index - left_index)
        result.append(
            NormalizedFaceBox(
                x=left.x + (right.x - left.x) * ratio,
                y=left.y + (right.y - left.y) * ratio,
                width=left.width + (right.width - left.width) * ratio,
                height=left.height + (right.height - left.height) * ratio,
            )
        )
    return tuple(result)


def _track_primary_face(
    ffmpeg: str,
    path: Path,
    start_sec: float,
    duration_sec: float,
    frame_count: int,
    width: int,
    height: int,
    detector: YuNetFaceDetector,
) -> FaceTrack:
    sampled: dict[int, NormalizedFaceBox | None] = {}
    for frame_index, frame in _sampled_proxy_frames(
        ffmpeg, path, start_sec, duration_sec, frame_count, width, height
    ):
        detections = detector.detect(frame)
        primary = max(
            detections,
            key=lambda detection: detection.box.width * detection.box.height,
            default=None,
        )
        sampled[frame_index] = primary.box if primary else None

    expected_samples = len(_face_sample_indexes(frame_count))
    if len(sampled) != expected_samples:
        raise RuntimeError(
            f"face sampler returned {len(sampled)} frames, expected {expected_samples}"
        )
    return FaceTrack(
        boxes=_interpolate_face_boxes(sampled, frame_count),
        sampled_frames=len(sampled),
        detected_samples=sum(box is not None for box in sampled.values()),
    )


def _even_dimension(value: float) -> int:
    rounded = max(2, round(value))
    return rounded if rounded % 2 == 0 else rounded + 1


def _render_dimensions(width: int, height: int) -> tuple[int, int]:
    if width <= 0 or height <= 0:
        raise ValueError("video dimensions must be positive")
    scale = max(OUTPUT_WIDTH / width, OUTPUT_HEIGHT / height)
    return _even_dimension(width * scale), _even_dimension(height * scale)


def _median_smooth(values: list[float], radius: int = 2) -> list[float]:
    result = []
    for index in range(len(values)):
        window = values[max(0, index - radius) : index + radius + 1]
        result.append(float(np.median(window)))
    return result


def _quantize_position(value: float, maximum: int) -> int:
    clamped = max(0, min(maximum, round(value)))
    return min(maximum, clamped // 2 * 2)


def _render_geometry(
    track: FaceTrack, source_width: int, source_height: int
) -> RenderGeometry:
    resized_width, resized_height = _render_dimensions(source_width, source_height)
    max_crop_x = resized_width - OUTPUT_WIDTH
    max_crop_y = resized_height - OUTPUT_HEIGHT
    center_crop_x = max_crop_x // 2
    center_crop_y = max_crop_y // 2

    detected = [box for box in track.boxes if box is not None]
    if not detected:
        frame_count = len(track.boxes)
        return RenderGeometry(
            resized_width=resized_width,
            resized_height=resized_height,
            crop_x=(center_crop_x,) * frame_count,
            crop_y=(center_crop_y,) * frame_count,
            blur_x=(0,) * frame_count,
            blur_y=(0,) * frame_count,
            blur_width=2,
            blur_height=2,
            face_present=(False,) * frame_count,
        )

    face_centers_x = [
        (box.x + box.width / 2) * resized_width
        for box in track.boxes
        if box is not None
    ]
    face_centers_y = [
        (box.y + box.height / 2) * resized_height
        for box in track.boxes
        if box is not None
    ]
    smoothed_x = iter(_median_smooth(face_centers_x))
    smoothed_y = iter(_median_smooth(face_centers_y))
    crop_x: list[int] = []
    crop_y: list[int] = []
    for box in track.boxes:
        if box is None:
            crop_x.append(center_crop_x)
            crop_y.append(center_crop_y)
            continue
        crop_x.append(
            _quantize_position(next(smoothed_x) - OUTPUT_WIDTH / 2, max_crop_x)
        )
        crop_y.append(
            _quantize_position(next(smoothed_y) - OUTPUT_HEIGHT / 2, max_crop_y)
        )

    face_rects: list[tuple[float, float, float, float] | None] = []
    for box, left, top in zip(track.boxes, crop_x, crop_y, strict=True):
        if box is None:
            face_rects.append(None)
            continue
        x1 = box.x * resized_width - left
        y1 = box.y * resized_height - top
        x2 = (box.x + box.width) * resized_width - left
        y2 = (box.y + box.height) * resized_height - top
        margin_x = (x2 - x1) * 0.16
        margin_y = (y2 - y1) * 0.20
        face_rects.append(
            (
                max(0.0, x1 - margin_x),
                max(0.0, y1 - margin_y),
                min(float(OUTPUT_WIDTH), x2 + margin_x),
                min(float(OUTPUT_HEIGHT), y2 + margin_y),
            )
        )

    present_rects = [rect for rect in face_rects if rect is not None]
    blur_width = min(
        OUTPUT_WIDTH,
        _even_dimension(max(rect[2] - rect[0] for rect in present_rects)),
    )
    blur_height = min(
        OUTPUT_HEIGHT,
        _even_dimension(max(rect[3] - rect[1] for rect in present_rects)),
    )
    blur_x: list[int] = []
    blur_y: list[int] = []
    for rect in face_rects:
        if rect is None:
            blur_x.append(0)
            blur_y.append(0)
            continue
        center_x = (rect[0] + rect[2]) / 2
        center_y = (rect[1] + rect[3]) / 2
        blur_x.append(
            _quantize_position(center_x - blur_width / 2, OUTPUT_WIDTH - blur_width)
        )
        blur_y.append(
            _quantize_position(center_y - blur_height / 2, OUTPUT_HEIGHT - blur_height)
        )

    return RenderGeometry(
        resized_width=resized_width,
        resized_height=resized_height,
        crop_x=tuple(crop_x),
        crop_y=tuple(crop_y),
        blur_x=tuple(blur_x),
        blur_y=tuple(blur_y),
        blur_width=blur_width,
        blur_height=blur_height,
        face_present=tuple(rect is not None for rect in face_rects),
    )


def _pad_face_track(track: FaceTrack, frame_count: int) -> FaceTrack:
    if frame_count < len(track.boxes):
        raise ValueError("face track cannot be shortened")
    if not track.boxes:
        raise ValueError("face track must contain at least one frame")
    return FaceTrack(
        boxes=track.boxes + (track.boxes[-1],) * (frame_count - len(track.boxes)),
        sampled_frames=track.sampled_frames,
        detected_samples=track.detected_samples,
    )


def _compress_runs(values: Iterable[int]) -> list[tuple[int, int, int]]:
    values = list(values)
    if not values:
        raise ValueError("at least one frame value is required")
    runs: list[tuple[int, int, int]] = []
    start = 0
    current = values[0]
    for index, value in enumerate(values[1:], start=1):
        if value == current:
            continue
        runs.append((start, index - 1, current))
        start = index
        current = value
    runs.append((start, len(values) - 1, current))
    return runs


def _frame_expression(values: Iterable[int]) -> str:
    runs = _compress_runs(values)
    expression = str(runs[-1][2])
    for start, end, value in reversed(runs[:-1]):
        expression = f"if(between(n,{start},{end}),{value},{expression})"
    return expression


def _enable_expression(values: Iterable[bool]) -> str:
    enabled = [
        f"between(n,{start},{end})"
        for start, end, value in _compress_runs(int(item) for item in values)
        if value
    ]
    return "+".join(enabled) if enabled else "0"


def _nearest_sampled_masks(
    sampled: dict[int, np.ndarray], frame_count: int
) -> tuple[np.ndarray, ...]:
    if not sampled:
        raise ValueError("at least one sampled mask is required")
    indexes = sorted(sampled)
    result: list[np.ndarray] = []
    for frame_index in range(frame_count):
        insertion = bisect_left(indexes, frame_index)
        left = indexes[max(0, insertion - 1)]
        right = indexes[min(insertion, len(indexes) - 1)]
        nearest = right if abs(right - frame_index) < abs(frame_index - left) else left
        result.append(sampled[nearest])
    return tuple(result)


def _render_face_skin_mask(
    proxy_mask: np.ndarray,
    geometry: RenderGeometry,
    frame_index: int,
) -> np.ndarray:
    proxy_height, proxy_width = proxy_mask.shape[:2]
    transform = np.array(
        [
            [geometry.resized_width / proxy_width, 0, -geometry.crop_x[frame_index]],
            [0, geometry.resized_height / proxy_height, -geometry.crop_y[frame_index]],
        ],
        dtype=np.float32,
    )
    canvas = cv2.warpAffine(
        proxy_mask,
        transform,
        (OUTPUT_WIDTH, OUTPUT_HEIGHT),
        flags=cv2.INTER_NEAREST,
        borderMode=cv2.BORDER_CONSTANT,
        borderValue=0,
    )
    restricted = np.zeros_like(canvas)
    if geometry.face_present[frame_index]:
        x = geometry.blur_x[frame_index]
        y = geometry.blur_y[frame_index]
        restricted[
            y : y + geometry.blur_height,
            x : x + geometry.blur_width,
        ] = canvas[
            y : y + geometry.blur_height,
            x : x + geometry.blur_width,
        ]
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (31, 31))
    dilated = cv2.dilate(restricted, kernel, iterations=1)
    return cv2.GaussianBlur(dilated, (21, 21), 0)


def _write_face_skin_mask_video(
    ffmpeg: str,
    plan: ClipPlan,
    output_path: Path,
    segmenter: MediaPipeFaceSkinSegmenter,
) -> None:
    source_frame_count = max(1, round(plan.segment_duration_sec * OUTPUT_FPS))
    sampled: dict[int, np.ndarray] = {}
    for frame_index, frame in _sampled_proxy_frames(
        ffmpeg,
        plan.clip.path,
        plan.start_sec,
        plan.segment_duration_sec,
        source_frame_count,
        plan.source_width,
        plan.source_height,
    ):
        sampled[frame_index] = _render_face_skin_mask(
            segmenter.segment(frame), plan.geometry, frame_index
        )
    masks = _nearest_sampled_masks(sampled, plan.frame_count)
    command = [
        ffmpeg,
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-f",
        "rawvideo",
        "-pix_fmt",
        "gray",
        "-s",
        f"{OUTPUT_WIDTH}x{OUTPUT_HEIGHT}",
        "-r",
        str(OUTPUT_FPS),
        "-i",
        "pipe:0",
        "-an",
        "-frames:v",
        str(plan.frame_count),
        "-c:v",
        "ffv1",
        "-pix_fmt",
        "gray",
        str(output_path),
    ]
    encoder = subprocess.Popen(command, stdin=subprocess.PIPE, stderr=subprocess.PIPE)
    try:
        assert encoder.stdin is not None
        for mask in masks:
            encoder.stdin.write(mask.tobytes())
        encoder.stdin.close()
        stderr = (
            encoder.stderr.read().decode("utf-8", errors="replace")
            if encoder.stderr
            else ""
        )
        return_code = encoder.wait()
        if return_code != 0:
            raise RuntimeError(f"ffmpeg mask encoding failed: {stderr.strip()}")
    except BaseException:
        encoder.kill()
        encoder.wait()
        raise
    finally:
        if encoder.stdin and not encoder.stdin.closed:
            encoder.stdin.close()
        if encoder.stderr:
            encoder.stderr.close()


def _clip_filter(
    index: int,
    plan: ClipPlan,
    blur_faces: bool,
    caption_path: Path | None = None,
    mask_input_index: int | None = None,
) -> list[str]:
    geometry = plan.geometry
    decoded_frames = max(1, round(plan.segment_duration_sec * OUTPUT_FPS))
    pad_frames = max(0, plan.frame_count - decoded_frames)
    padding = f",tpad=stop_mode=clone:stop={plan.frame_count}" if pad_frames > 0 else ""
    prefix = (
        f"[{index}:v]fps={OUTPUT_FPS},"
        f"scale={geometry.resized_width}:{geometry.resized_height},"
        f"crop={OUTPUT_WIDTH}:{OUTPUT_HEIGHT}:"
        f"x='{_frame_expression(geometry.crop_x)}':"
        f"y='{_frame_expression(geometry.crop_y)}',"
        f"setsar=1{padding},trim=end_frame={plan.frame_count},setpts=PTS-STARTPTS"
    )
    output_label = f"caption{index}" if caption_path else f"out{index}"
    chains: list[str]
    if not blur_faces or not any(geometry.face_present):
        chains = [f"{prefix}[{output_label}]"]
    else:
        x_expression = _frame_expression(geometry.blur_x)
        y_expression = _frame_expression(geometry.blur_y)
        enabled = _enable_expression(geometry.face_present)
        chains = [
            f"{prefix},split=2[base{index}][face{index}]",
            (
                f"[face{index}]crop={geometry.blur_width}:{geometry.blur_height}:"
                f"x='{x_expression}':y='{y_expression}',"
                "boxblur=luma_radius='min(w,h)/12':luma_power=2:"
                "chroma_radius='min(cw,ch)/12':chroma_power=2"
                f"[blur{index}]"
            ),
        ]
        blur_label = f"blur{index}"
        if mask_input_index is not None:
            chains.extend(
                [
                    (
                        f"[{mask_input_index}:v]fps={OUTPUT_FPS},"
                        f"crop={geometry.blur_width}:{geometry.blur_height}:"
                        f"x='{x_expression}':y='{y_expression}',format=gray,"
                        f"trim=end_frame={plan.frame_count},setpts=PTS-STARTPTS"
                        f"[mask{index}]"
                    ),
                    f"[blur{index}][mask{index}]alphamerge[segblur{index}]",
                ]
            )
            blur_label = f"segblur{index}"
        chains.append(
            f"[base{index}][{blur_label}]overlay=x='{x_expression}':"
            f"y='{y_expression}':enable='{enabled}':shortest=1[{output_label}]"
        )
    if caption_path:
        chains.append(f"[caption{index}]{_caption_filter(caption_path)}[out{index}]")
    return chains


def _filter_graph(
    plans: list[ClipPlan],
    blur_faces: bool,
    caption_paths: list[Path | None] | None = None,
    mask_input_indexes: list[int | None] | None = None,
) -> str:
    if not plans:
        raise ValueError("at least one clip plan is required")
    if caption_paths is None:
        caption_paths = [None] * len(plans)
    if len(caption_paths) != len(plans):
        raise ValueError("one caption path is required for each clip plan")
    if mask_input_indexes is None:
        mask_input_indexes = [None] * len(plans)
    if len(mask_input_indexes) != len(plans):
        raise ValueError("one mask input index is required for each clip plan")
    chains: list[str] = []
    outputs = []
    for index, (plan, caption_path, mask_input_index) in enumerate(
        zip(plans, caption_paths, mask_input_indexes, strict=True)
    ):
        chains.extend(
            _clip_filter(index, plan, blur_faces, caption_path, mask_input_index)
        )
        outputs.append(f"[out{index}]")
    chains.append(
        "".join(outputs)
        + f"concat=n={len(outputs)}:v=1:a=0,fps={OUTPUT_FPS},"
        + "tpad=stop_mode=clone:stop=1,"
        + f"trim=end_frame={sum(plan.frame_count for plan in plans)},"
        + "setpts=PTS-STARTPTS[video]"
    )
    return ";\n".join(chains)


def _graph_decoder_command(
    ffmpeg: str,
    plans: list[ClipPlan],
    blur_faces: bool,
    caption_paths: list[Path | None] | None = None,
) -> list[str]:
    command = [ffmpeg, "-hide_banner", "-loglevel", "error"]
    for plan in plans:
        command.extend(
            [
                "-ss",
                f"{plan.start_sec:.6f}",
                "-t",
                f"{plan.segment_duration_sec:.6f}",
                "-i",
                str(plan.clip.path),
            ]
        )
    command.extend(
        [
            "-filter_complex",
            _filter_graph(plans, blur_faces, caption_paths),
            "-map",
            "[video]",
            "-an",
            "-frames:v",
            str(sum(plan.frame_count for plan in plans)),
            "-f",
            "rawvideo",
            "-pix_fmt",
            "bgr24",
            "pipe:1",
        ]
    )
    return command


def _write_caption_files(plans: list[ClipPlan], output_path: Path) -> list[Path | None]:
    paths: list[Path | None] = []
    for index, plan in enumerate(plans):
        caption = _wrap_caption(plan.clip.caption)
        if not caption:
            paths.append(None)
            continue
        path = output_path.parent / f".{output_path.stem}-caption-{index}.txt"
        path.write_text(caption, encoding="utf-8")
        paths.append(path)
    return paths


def _render_command(
    ffmpeg: str,
    plans: list[ClipPlan],
    blur_faces: bool,
    caption_paths: list[Path | None],
    output_path: Path,
    mask_paths: list[Path | None] | None = None,
) -> list[str]:
    command = [ffmpeg, "-hide_banner", "-loglevel", "error", "-y"]
    for plan in plans:
        command.extend(
            [
                "-ss",
                f"{plan.start_sec:.6f}",
                "-t",
                f"{plan.segment_duration_sec:.6f}",
                "-i",
                str(plan.clip.path),
            ]
        )
    if mask_paths is None:
        mask_paths = [None] * len(plans)
    if len(mask_paths) != len(plans):
        raise ValueError("one mask path is required for each clip plan")
    mask_input_indexes: list[int | None] = []
    next_input_index = len(plans)
    for mask_path in mask_paths:
        if mask_path is None:
            mask_input_indexes.append(None)
            continue
        command.extend(["-i", str(mask_path)])
        mask_input_indexes.append(next_input_index)
        next_input_index += 1
    command.extend(
        [
            "-filter_complex",
            _filter_graph(plans, blur_faces, caption_paths, mask_input_indexes),
            "-map",
            "[video]",
            "-an",
            "-frames:v",
            str(sum(plan.frame_count for plan in plans)),
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
    )
    return command


def _graph_frames(
    ffmpeg: str, plans: list[ClipPlan], blur_faces: bool
) -> Generator[np.ndarray, None, None]:
    command = _graph_decoder_command(ffmpeg, plans, blur_faces)
    decoder = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    frame_size = OUTPUT_WIDTH * OUTPUT_HEIGHT * 3
    frame_count = sum(plan.frame_count for plan in plans)
    try:
        assert decoder.stdout is not None
        for index in range(frame_count):
            raw = _read_exact(decoder.stdout, frame_size)
            if len(raw) != frame_size:
                raise ValueError(
                    "video graph ended before all frames were decoded "
                    f"({index}/{frame_count} frames)"
                )
            yield np.frombuffer(raw, dtype=np.uint8).reshape(
                (OUTPUT_HEIGHT, OUTPUT_WIDTH, 3)
            )

        extra = decoder.stdout.read(1)
        stderr = (
            decoder.stderr.read().decode("utf-8", errors="replace")
            if decoder.stderr
            else ""
        )
        return_code = decoder.wait()
        if return_code != 0:
            raise RuntimeError(f"ffmpeg graph decode failed: {stderr.strip()}")
        if extra:
            raise RuntimeError("ffmpeg graph decoded more frames than requested")
    except BaseException:
        decoder.kill()
        decoder.wait()
        raise
    finally:
        if decoder.stdout:
            decoder.stdout.close()
        if decoder.stderr:
            decoder.stderr.close()


def _decoded_frames(
    ffmpeg: str,
    path: Path,
    start_sec: float,
    duration_sec: float,
    frame_count: int,
    width: int,
    height: int,
) -> Generator[np.ndarray, None, None]:
    decoded_width, decoded_height = _scaled_dimensions(width, height)
    command = _decoder_command(
        ffmpeg,
        path,
        start_sec,
        duration_sec,
        frame_count,
        decoded_width,
        decoded_height,
    )
    decoder = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    frame_size = decoded_width * decoded_height * 3
    try:
        assert decoder.stdout is not None
        for index in range(frame_count):
            raw = _read_exact(decoder.stdout, frame_size)
            if len(raw) != frame_size:
                raise ValueError(
                    "video ended before the requested segment was decoded "
                    f"({index}/{frame_count} frames)"
                )
            yield np.frombuffer(raw, dtype=np.uint8).reshape(
                (decoded_height, decoded_width, 3)
            )

        extra = decoder.stdout.read(1)
        stderr = (
            decoder.stderr.read().decode("utf-8", errors="replace")
            if decoder.stderr
            else ""
        )
        return_code = decoder.wait()
        if return_code != 0:
            raise RuntimeError(f"ffmpeg decode failed: {stderr.strip()}")
        if extra:
            raise RuntimeError("ffmpeg decoded more frames than requested")
    except BaseException:
        decoder.kill()
        decoder.wait()
        raise
    finally:
        if decoder.stdout:
            decoder.stdout.close()
        if decoder.stderr:
            decoder.stderr.close()


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
    if not MIN_CLIPS <= len(clips) <= MAX_CLIPS:
        raise ValueError(f"between {MIN_CLIPS} and {MAX_CLIPS} clips are required")
    output_path.parent.mkdir(parents=True, exist_ok=True)

    detector = YuNetFaceDetector()
    plans: list[ClipPlan] = []
    for clip_index, clip in enumerate(clips):
        capture = cv2.VideoCapture(str(clip.path))
        try:
            duration = _duration(capture)
            source_width = round(capture.get(cv2.CAP_PROP_FRAME_WIDTH))
            source_height = round(capture.get(cv2.CAP_PROP_FRAME_HEIGHT))
            if source_width <= 0 or source_height <= 0:
                raise ValueError("video dimensions could not be read")
            segment_duration = min(CLIP_SECONDS, duration)
            start = segment_start(duration, clip.selection)
            source_frame_count = max(1, round(segment_duration * OUTPUT_FPS))
        finally:
            capture.release()

        track = _track_primary_face(
            ffmpeg,
            clip.path,
            start,
            segment_duration,
            source_frame_count,
            source_width,
            source_height,
            detector,
        )
        track = _pad_face_track(track, round(CLIP_SECONDS * OUTPUT_FPS))
        plans.append(
            ClipPlan(
                clip=clip,
                start_sec=start,
                segment_duration_sec=segment_duration,
                frame_count=round(CLIP_SECONDS * OUTPUT_FPS),
                source_width=source_width,
                source_height=source_height,
                track=track,
                geometry=_render_geometry(track, source_width, source_height),
            )
        )
        if progress:
            progress(round((clip_index + 1) / len(clips) * 40))

    caption_paths: list[Path | None] = []
    mask_paths: list[Path | None] = []
    segmenter: MediaPipeFaceSkinSegmenter | None = None
    try:
        caption_paths = _write_caption_files(plans, output_path)
        mask_paths = [None] * len(plans)
        if blur_faces and any(any(plan.geometry.face_present) for plan in plans):
            segmenter = MediaPipeFaceSkinSegmenter()
            for index, plan in enumerate(plans):
                if not any(plan.geometry.face_present):
                    continue
                mask_path = output_path.parent / f".{output_path.stem}-mask-{index}.mkv"
                _write_face_skin_mask_video(ffmpeg, plan, mask_path, segmenter)
                mask_paths[index] = mask_path
        command = _render_command(
            ffmpeg, plans, blur_faces, caption_paths, output_path, mask_paths
        )
        completed = subprocess.run(command, capture_output=True, text=True, check=False)
        if completed.returncode != 0:
            raise RuntimeError(f"ffmpeg failed: {completed.stderr.strip()}")
        if progress:
            progress(95)
    except Exception:
        output_path.unlink(missing_ok=True)
        raise
    finally:
        if segmenter is not None:
            segmenter.close()
        for caption_path in caption_paths:
            if caption_path:
                caption_path.unlink(missing_ok=True)
        for mask_path in mask_paths:
            if mask_path:
                mask_path.unlink(missing_ok=True)

    if progress:
        progress(100)
    total_frames = sum(plan.frame_count for plan in plans)
    return VideoResult(
        duration_sec=round(total_frames / OUTPUT_FPS, 3),
        width=OUTPUT_WIDTH,
        height=OUTPUT_HEIGHT,
        faces_blurred=(
            sum(sum(plan.geometry.face_present) for plan in plans) if blur_faces else 0
        ),
    )
