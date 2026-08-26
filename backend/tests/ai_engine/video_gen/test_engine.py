import hashlib
import shutil
import subprocess
from io import BytesIO
from pathlib import Path
from types import SimpleNamespace

import cv2
import numpy as np
import pytest

from src.ai_engine.video_gen import engine as video_engine
from src.ai_engine.video_gen.engine import (
    YUNET_MODEL_PATH,
    YUNET_THRESHOLD,
    ClipInput,
    ClipPlan,
    FaceDetection,
    FaceTrack,
    NormalizedFaceBox,
    YuNetFaceDetector,
    _audio_filter_chains,
    _caption_filter,
    _decoder_command,
    _face_sample_indexes,
    _filter_graph,
    _frame_expression,
    _graph_decoder_command,
    _interpolate_face_boxes,
    _nearest_sampled_masks,
    _pad_face_track,
    _read_exact,
    _render_command,
    _render_face_skin_mask,
    _render_geometry,
    _sampled_proxy_command,
    _sampled_proxy_frames,
    _scaled_dimensions,
    _track_primary_face,
    _validate_clip_durations,
    _wrap_caption,
    _write_caption_files,
    center_crop,
    ordered_clips,
    process_shorts,
    segment_start,
)


def test_segment_start_uses_two_second_window():
    assert segment_start(8.0, "start") == 0
    assert segment_start(8.0, "center") == 3
    assert segment_start(8.0, "end") == 6
    assert segment_start(1.5, "end") == 0


def test_segment_start_aligns_end_window_to_source_frame_boundary():
    assert segment_start(
        5.005,
        "end",
        source_fps=30000 / 1001,
        source_frames=150,
    ) == pytest.approx(3.003)
    assert segment_start(
        5.005,
        "end",
        source_fps=24000 / 1001,
        source_frames=120,
    ) == pytest.approx(3.003)


def test_ordered_clips_preserves_upload_order_inside_role(tmp_path):
    clips = [
        ClipInput(tmp_path / "after.mp4", "after", "center", ""),
        ClipInput(tmp_path / "process-1.mp4", "process", "center", ""),
        ClipInput(tmp_path / "before.mp4", "before", "center", ""),
        ClipInput(tmp_path / "process-2.mp4", "process", "center", ""),
    ]
    assert [clip.path.name for clip in ordered_clips(clips)] == [
        "before.mp4",
        "process-1.mp4",
        "process-2.mp4",
        "after.mp4",
    ]


def test_ordered_clips_uses_explicit_order_only_when_all_clips_set_it(tmp_path):
    clips = [
        ClipInput(tmp_path / "before.mp4", "before", "center", "", clip_order=2),
        ClipInput(tmp_path / "after.mp4", "after", "center", "", clip_order=0),
        ClipInput(tmp_path / "detail.mp4", "detail", "center", "", clip_order=1),
    ]
    assert [clip.path.name for clip in ordered_clips(clips)] == [
        "after.mp4",
        "detail.mp4",
        "before.mp4",
    ]
    with pytest.raises(ValueError, match="every clip"):
        ordered_clips([clips[0], ClipInput(tmp_path / "plain.mp4", "after", "end", "")])


def test_engine_clip_duration_guard_accepts_boundaries_and_defaults(tmp_path):
    five_second_clips = [
        ClipInput(
            tmp_path / f"clip-{index}.mp4",
            "process",
            "center",
            "",
            start_sec=0.0,
            end_sec=5.0,
        )
        for index in range(6)
    ]
    _validate_clip_durations(five_second_clips)
    _validate_clip_durations(
        [
            ClipInput(tmp_path / f"default-{index}.mp4", "process", "center", "")
            for index in range(8)
        ]
    )
    _validate_clip_durations(
        [
            ClipInput(
                tmp_path / "decimal-boundary.mp4",
                "before",
                "center",
                "",
                start_sec=3.3,
                end_sec=8.3,
            ),
            ClipInput(tmp_path / "decimal-after.mp4", "after", "center", ""),
        ]
    )
    _validate_clip_durations(
        [
            ClipInput(
                tmp_path / f"decimal-total-{index}.mp4",
                "process",
                "center",
                "",
                start_sec=0.0,
                end_sec=duration,
            )
            for index, duration in enumerate((0.5, 0.6, 4.7, 4.8, 4.8, 4.8, 4.8, 5.0))
        ]
    )

    with pytest.raises(ValueError, match="clip duration"):
        _validate_clip_durations(
            [
                ClipInput(
                    tmp_path / "too-long.mp4",
                    "before",
                    "center",
                    "",
                    start_sec=0.0,
                    end_sec=5.001,
                ),
                ClipInput(tmp_path / "after.mp4", "after", "center", ""),
            ]
        )

    with pytest.raises(ValueError, match="total clip duration"):
        _validate_clip_durations(
            [
                ClipInput(
                    tmp_path / f"total-{index}.mp4",
                    "process",
                    "center",
                    "",
                    start_sec=0.0,
                    end_sec=4.3,
                )
                for index in range(7)
            ]
        )
    with pytest.raises(ValueError, match="total clip duration"):
        _validate_clip_durations(
            [
                ClipInput(
                    tmp_path / f"decimal-over-{index}.mp4",
                    "process",
                    "center",
                    "",
                    start_sec=0.0,
                    end_sec=duration,
                )
                for index, duration in enumerate(
                    (4.0, 4.0, 4.0, 4.0, 4.0, 4.0, 3.0, 3.001)
                )
            ]
        )


def test_center_crop_returns_vertical_canvas():
    landscape = np.zeros((720, 1280, 3), dtype=np.uint8)
    portrait = np.zeros((1280, 720, 3), dtype=np.uint8)
    assert center_crop(landscape).shape == (1920, 1080, 3)
    assert center_crop(portrait).shape == (1920, 1080, 3)


def test_decoder_command_seeks_once_and_normalizes_to_output_fps(tmp_path):
    path = tmp_path / "source.mp4"
    command = _decoder_command("ffmpeg", path, 3.25, 2.0, 60, 1920, 1012)

    assert command.count("-ss") == 1
    assert command[command.index("-ss") + 1] == "3.250000"
    assert command[command.index("-t") + 1] == "2.000000"
    assert command[command.index("-vf") + 1] == "fps=30,scale=1920:1012"
    assert command[command.index("-frames:v") + 1] == "60"
    assert command[-1] == "pipe:1"


def test_read_exact_returns_available_bytes_when_stream_ends():
    assert _read_exact(BytesIO(b"abcdef"), 4) == b"abcd"
    assert _read_exact(BytesIO(b"abc"), 5) == b"abc"


def test_scaled_dimensions_limits_long_side_and_preserves_small_inputs():
    assert _scaled_dimensions(4096, 2160) == (1920, 1012)
    assert _scaled_dimensions(2160, 4096) == (1012, 1920)
    assert _scaled_dimensions(1280, 720) == (1280, 720)


def test_yunet_model_is_shipped_with_the_video_engine():
    assert YUNET_MODEL_PATH.is_file()
    assert YUNET_MODEL_PATH.stat().st_size == 232_589


def test_yunet_product_threshold_keeps_edge_faces_detectable():
    assert YUNET_THRESHOLD == 0.60


def test_yunet_detector_loads_from_unicode_repository_path():
    assert YuNetFaceDetector() is not None


def test_face_sample_indexes_include_the_final_frame():
    assert _face_sample_indexes(60) == [
        0,
        5,
        10,
        15,
        20,
        25,
        30,
        35,
        40,
        45,
        50,
        55,
        59,
    ]
    assert _face_sample_indexes(3) == [0, 2]


def test_sampled_proxy_command_decodes_only_n5_samples(tmp_path):
    command, indexes, dimensions = _sampled_proxy_command(
        "ffmpeg", tmp_path / "source.mp4", 3.25, 2.0, 60, 4096, 2160
    )

    assert indexes == _face_sample_indexes(60)
    assert dimensions == (640, 338)
    assert command[command.index("-t") + 1] == "2.033333"
    assert command[command.index("-frames:v") + 1] == "13"
    assert command[command.index("-fps_mode") + 1] == "passthrough"
    assert (
        command[command.index("-vf") + 1]
        == "fps=30,select=not(mod(n\\,5))+eq(n\\,59),scale=640:338"
    )


def test_sampled_proxy_decodes_final_sample_from_half_frame_center(tmp_path):
    ffmpeg = shutil.which("ffmpeg")
    if ffmpeg is None:
        pytest.skip("ffmpeg is not installed")

    source = tmp_path / "half-frame-center.mov"
    subprocess.run(
        [
            ffmpeg,
            "-hide_banner",
            "-loglevel",
            "error",
            "-f",
            "lavfi",
            "-i",
            "testsrc2=s=64x64:r=30",
            "-frames:v",
            "141",
            "-c:v",
            "libx264",
            "-pix_fmt",
            "yuv420p",
            str(source),
        ],
        check=True,
    )

    frames = list(
        _sampled_proxy_frames(
            ffmpeg,
            source,
            start_sec=1.35,
            duration_sec=2.0,
            frame_count=60,
            width=64,
            height=64,
        )
    )

    assert [frame_index for frame_index, _ in frames] == _face_sample_indexes(60)
    assert len({hashlib.sha256(frame.tobytes()).digest() for _, frame in frames}) == 13


def test_sampled_proxy_preserves_integer_start_passthrough_frame_hashes(tmp_path):
    ffmpeg = shutil.which("ffmpeg")
    if ffmpeg is None:
        pytest.skip("ffmpeg is not installed")

    source = tmp_path / "integer-frame-center.mov"
    subprocess.run(
        [
            ffmpeg,
            "-hide_banner",
            "-loglevel",
            "error",
            "-f",
            "lavfi",
            "-i",
            "testsrc2=s=64x64:r=30",
            "-frames:v",
            "150",
            "-c:v",
            "libx264",
            "-pix_fmt",
            "yuv420p",
            str(source),
        ],
        check=True,
    )

    command, indexes, (width, height) = _sampled_proxy_command(
        ffmpeg,
        source,
        start_sec=1.0,
        duration_sec=2.0,
        frame_count=60,
        width=64,
        height=64,
    )
    baseline_command = command.copy()
    baseline_command[baseline_command.index("-t") + 1] = "2.000000"
    baseline = subprocess.run(baseline_command, capture_output=True, check=True).stdout
    frame_size = width * height * 3
    baseline_hashes = [
        hashlib.sha256(baseline[offset : offset + frame_size]).digest()
        for offset in range(0, len(baseline), frame_size)
    ]

    current_frames = list(
        _sampled_proxy_frames(
            ffmpeg,
            source,
            start_sec=1.0,
            duration_sec=2.0,
            frame_count=60,
            width=64,
            height=64,
        )
    )
    current_hashes = [
        hashlib.sha256(frame.tobytes()).digest() for _, frame in current_frames
    ]

    assert len(baseline_hashes) == len(indexes) == 13
    assert current_hashes == baseline_hashes


@pytest.mark.parametrize(
    ("rate", "source_frames"),
    [("30000/1001", 150), ("24000/1001", 120)],
)
def test_sampled_proxy_decodes_end_window_without_reading_past_source(
    tmp_path, rate, source_frames
):
    ffmpeg = shutil.which("ffmpeg")
    if ffmpeg is None:
        pytest.skip("ffmpeg is not installed")

    source = tmp_path / f"end-{rate.replace('/', '-')}.mov"
    subprocess.run(
        [
            ffmpeg,
            "-hide_banner",
            "-loglevel",
            "error",
            "-f",
            "lavfi",
            "-i",
            f"testsrc2=s=64x64:r={rate}",
            "-frames:v",
            str(source_frames),
            "-c:v",
            "libx264",
            "-pix_fmt",
            "yuv420p",
            str(source),
        ],
        check=True,
    )

    capture = cv2.VideoCapture(str(source))
    try:
        duration = video_engine._duration(capture)
        source_fps = capture.get(cv2.CAP_PROP_FPS)
        source_frame_count = round(capture.get(cv2.CAP_PROP_FRAME_COUNT))
    finally:
        capture.release()

    frames = list(
        _sampled_proxy_frames(
            ffmpeg,
            source,
            start_sec=segment_start(
                duration,
                "end",
                source_fps=source_fps,
                source_frames=source_frame_count,
            ),
            duration_sec=2.0,
            frame_count=60,
            width=64,
            height=64,
        )
    )

    assert [frame_index for frame_index, _ in frames] == _face_sample_indexes(60)
    assert len({hashlib.sha256(frame.tobytes()).digest() for _, frame in frames}) == 13


def test_face_box_interpolation_uses_nearest_detection_across_sampled_miss():
    start = NormalizedFaceBox(0.1, 0.2, 0.2, 0.3)
    end = NormalizedFaceBox(0.3, 0.4, 0.4, 0.5)

    boxes = _interpolate_face_boxes({0: start, 5: None, 10: end}, 11)

    assert boxes[0] == start
    assert boxes[5] is not None
    assert (boxes[5].x, boxes[5].y, boxes[5].width, boxes[5].height) == pytest.approx(
        (0.2, 0.3, 0.3, 0.4)
    )
    assert boxes[10] == end
    assert _interpolate_face_boxes({0: None, 5: None}, 6) == (None,) * 6


def test_track_primary_face_selects_largest_detection_and_interpolates(
    monkeypatch, tmp_path
):
    frames = [
        (0, np.full((8, 8, 3), 0, dtype=np.uint8)),
        (5, np.full((8, 8, 3), 5, dtype=np.uint8)),
        (9, np.full((8, 8, 3), 9, dtype=np.uint8)),
    ]

    def fake_proxy_frames(*_args, **_kwargs):
        yield from frames

    class FakeDetector:
        def detect(self, frame):
            marker = int(frame[0, 0, 0])
            if marker == 5:
                return []
            base = marker / 100
            return [
                FaceDetection(NormalizedFaceBox(base, 0.1, 0.1, 0.1), 0.9),
                FaceDetection(NormalizedFaceBox(base, 0.2, 0.3, 0.3), 0.8),
            ]

    monkeypatch.setattr(video_engine, "_sampled_proxy_frames", fake_proxy_frames)
    track = _track_primary_face(
        "ffmpeg", Path(tmp_path / "source.mp4"), 0.0, 1.0, 10, 100, 50, FakeDetector()
    )

    assert track.sampled_frames == 3
    assert track.detected_samples == 2
    assert len(track.boxes) == 10
    assert track.boxes[0] == NormalizedFaceBox(0.0, 0.2, 0.3, 0.3)
    assert track.boxes[5] == NormalizedFaceBox(0.05, 0.2, 0.3, 0.3)
    assert track.boxes[9] == NormalizedFaceBox(0.09, 0.2, 0.3, 0.3)


def test_render_geometry_anchors_wide_crop_to_detected_face():
    box = NormalizedFaceBox(0.8, 0.2, 0.2, 0.5)
    track = FaceTrack((box,) * 4, sampled_frames=2, detected_samples=2)

    geometry = _render_geometry(track, 4096, 2160)

    assert (geometry.resized_width, geometry.resized_height) == (3642, 1920)
    assert geometry.crop_x == (2562,) * 4
    assert geometry.crop_y == (0,) * 4
    assert all(geometry.face_present)
    assert geometry.blur_width > 2
    assert geometry.blur_height > 2


def test_render_geometry_uses_center_crop_when_no_face_is_detected():
    track = FaceTrack((None,) * 3, sampled_frames=2, detected_samples=0)

    geometry = _render_geometry(track, 4096, 2160)

    assert geometry.crop_x == (1281,) * 3
    assert geometry.crop_y == (0,) * 3
    assert geometry.face_present == (False,) * 3


def test_frame_expression_compresses_repeated_positions():
    assert _frame_expression((10, 10, 20, 20, 30)) == (
        "if(between(n,0,1),10,if(between(n,2,3),20,30))"
    )


def test_graph_decoder_supports_variable_clip_count_and_total_frames(tmp_path):
    plans = []
    for index, segment_duration in enumerate((2.0, 1.0)):
        frame_count = 60
        clip = ClipInput(tmp_path / f"source-{index}.mp4", "process", "center", "")
        track = FaceTrack((None,) * frame_count, 2, 0)
        plans.append(
            ClipPlan(
                clip=clip,
                start_sec=1.0,
                segment_duration_sec=segment_duration,
                frame_count=frame_count,
                source_width=1920,
                source_height=1080,
                track=track,
                geometry=_render_geometry(track, 1920, 1080),
            )
        )

    command = _graph_decoder_command("ffmpeg", plans, blur_faces=True)
    graph = command[command.index("-filter_complex") + 1]

    assert command.count("-i") == 2
    assert command[command.index("-frames:v") + 1] == "120"
    assert "concat=n=2:v=1:a=0" in graph
    assert "tpad=stop_mode=clone:stop=1,trim=end_frame=120" in graph
    assert "trim=end_frame=60" in graph
    assert "tpad=stop_mode=clone:stop=60" in graph
    assert "boxblur=" not in graph


def test_filter_graph_uses_face_anchor_and_ffmpeg_blur(tmp_path):
    boxes = (
        NormalizedFaceBox(0.7, 0.2, 0.2, 0.4),
        NormalizedFaceBox(0.72, 0.2, 0.2, 0.4),
    )
    track = FaceTrack(boxes, sampled_frames=2, detected_samples=2)
    plan = ClipPlan(
        clip=ClipInput(tmp_path / "face.mp4", "after", "center", ""),
        start_sec=0.0,
        segment_duration_sec=2 / 30,
        frame_count=2,
        source_width=4096,
        source_height=2160,
        track=track,
        geometry=_render_geometry(track, 4096, 2160),
    )

    graph = _filter_graph([plan], blur_faces=True)

    assert "crop=1080:1920:x='" in graph
    assert "boxblur=" in graph
    assert "overlay=x='" in graph
    assert "concat=n=1:v=1:a=0" in graph


def test_pad_face_track_holds_last_box_for_short_clip():
    first = NormalizedFaceBox(0.1, 0.2, 0.3, 0.4)
    last = NormalizedFaceBox(0.2, 0.3, 0.3, 0.4)
    track = FaceTrack((first, last), sampled_frames=2, detected_samples=2)

    padded = _pad_face_track(track, 5)

    assert padded.boxes == (first, last, last, last, last)
    assert padded.sampled_frames == 2
    assert padded.detected_samples == 2


def test_korean_caption_is_written_as_utf8_and_added_to_ffmpeg_graph(tmp_path):
    track = FaceTrack((None,) * 60, sampled_frames=13, detected_samples=0)
    plan = ClipPlan(
        clip=ClipInput(
            tmp_path / "source.mp4",
            "process",
            "center",
            "시술 과정을 자세히 확인해 보세요",
        ),
        start_sec=0.0,
        segment_duration_sec=2.0,
        frame_count=60,
        source_width=1920,
        source_height=1080,
        track=track,
        geometry=_render_geometry(track, 1920, 1080),
    )
    output = tmp_path / "shorts.mp4"

    paths = _write_caption_files([plan], output)
    assert paths[0] is not None
    assert paths[0].read_text(encoding="utf-8") == _wrap_caption(
        plan.clip.caption, line_length=20, max_lines=2
    )

    graph = _filter_graph([plan], blur_faces=True, caption_paths=paths)
    assert "drawtext=fontfile=" in graph
    assert "textfile=" in graph
    assert "expansion=none" in graph
    assert _caption_filter(paths[0]) in graph
    assert _wrap_caption("얼굴형에 어울리는 방향으로 진행합니다") == (
        "얼굴형에 어울리는 방향으로\n진행합니다"
    )


def test_default_caption_is_two_lines_without_black_box(tmp_path):
    wrapped = _wrap_caption("가" * 80, line_length=20, max_lines=2)
    assert len(wrapped.splitlines()) == 2
    assert wrapped.endswith("…")

    caption_path = tmp_path / "caption.txt"
    caption_path.write_text(wrapped, encoding="utf-8")
    caption_filter = _caption_filter(caption_path)
    assert "y=h*0.76" in caption_filter
    assert "borderw=5" in caption_filter
    assert "box=1" not in caption_filter


def test_audio_filters_cover_keep_audio_matrix_and_do_not_overlap_tts(tmp_path):
    track = FaceTrack((None,) * 30, sampled_frames=7, detected_samples=0)
    original = ClipPlan(
        clip=ClipInput(
            tmp_path / "original.mp4",
            "before",
            "center",
            "",
            keep_audio=True,
        ),
        start_sec=0.0,
        segment_duration_sec=1.0,
        frame_count=30,
        source_width=1080,
        source_height=1920,
        track=track,
        geometry=_render_geometry(track, 1080, 1920),
        has_audio=True,
    )
    muted = ClipPlan(
        clip=ClipInput(
            tmp_path / "muted.mp4",
            "process",
            "center",
            "",
            keep_audio=False,
        ),
        start_sec=0.0,
        segment_duration_sec=1.0,
        frame_count=30,
        source_width=1080,
        source_height=1920,
        track=track,
        geometry=_render_geometry(track, 1080, 1920),
        has_audio=True,
    )
    silent = ClipPlan(
        clip=ClipInput(tmp_path / "silent.mp4", "after", "center", ""),
        start_sec=0.0,
        segment_duration_sec=1.0,
        frame_count=30,
        source_width=1080,
        source_height=1920,
        track=track,
        geometry=_render_geometry(track, 1080, 1920),
        has_audio=False,
    )

    original_chains = _audio_filter_chains([original, muted, silent], "original", None)
    original_graph = ";".join(original_chains)
    assert "[0:a]aresample=48000" in original_graph
    assert original_chains[1].startswith("anullsrc=r=48000:cl=stereo")
    assert "atrim=duration=1.000000" in original_chains[1]
    assert original_chains[2].startswith("anullsrc=r=48000:cl=stereo")
    assert "concat=n=3:v=0:a=1[audio]" in original_graph

    tts_graph = ";".join(_audio_filter_chains([original, muted, silent], "tts", 3))
    assert "[0:a]aresample=48000" in tts_graph
    assert "[3:a]atrim=start=1.000000:end=2.000000" in tts_graph
    assert "[3:a]atrim=start=2.000000:end=3.000000" in tts_graph
    assert "[3:a]atrim=start=0.000000:end=1.000000" not in tts_graph


def test_render_command_encodes_filter_graph_without_python_rawvideo_pipe(tmp_path):
    track = FaceTrack((None,) * 60, sampled_frames=13, detected_samples=0)
    plan = ClipPlan(
        clip=ClipInput(tmp_path / "source.mp4", "process", "center", ""),
        start_sec=0.0,
        segment_duration_sec=1.0,
        frame_count=60,
        source_width=1920,
        source_height=1080,
        track=track,
        geometry=_render_geometry(track, 1920, 1080),
    )

    command = _render_command("ffmpeg", [plan], True, [None], tmp_path / "shorts.mp4")

    assert "rawvideo" not in command
    assert "pipe:1" not in command
    assert command[command.index("-c:v") + 1] == "libx264"
    assert command[command.index("-frames:v") + 1] == "60"
    graph = command[command.index("-filter_complex") + 1]
    assert "tpad=stop_mode=clone:stop=60" in graph


def test_nearest_sampled_masks_holds_nearest_sample():
    first = np.zeros((2, 2), dtype=np.uint8)
    last = np.full((2, 2), 255, dtype=np.uint8)

    masks = _nearest_sampled_masks({0: first, 5: last}, 7)

    assert all(mask is first for mask in masks[:3])
    assert all(mask is last for mask in masks[3:])


def test_render_face_skin_mask_restricts_output_to_primary_face_region():
    track = FaceTrack(
        (NormalizedFaceBox(0.4, 0.3, 0.1, 0.2),),
        sampled_frames=1,
        detected_samples=1,
    )
    geometry = _render_geometry(track, 1080, 1920)
    proxy_mask = np.full((320, 180), 255, dtype=np.uint8)

    rendered = _render_face_skin_mask(proxy_mask, geometry, 0)

    assert rendered.shape == (1920, 1080)
    assert int(rendered.max()) == 255
    assert int(rendered[0, 0]) == 0
    assert int(rendered[-1, -1]) == 0


def test_render_command_uses_mask_input_and_alphamerge(tmp_path):
    track = FaceTrack(
        (NormalizedFaceBox(0.4, 0.3, 0.1, 0.2),) * 60,
        sampled_frames=13,
        detected_samples=13,
    )
    plan = ClipPlan(
        clip=ClipInput(tmp_path / "source.mp4", "process", "center", ""),
        start_sec=0.0,
        segment_duration_sec=2.0,
        frame_count=60,
        source_width=1080,
        source_height=1920,
        track=track,
        geometry=_render_geometry(track, 1080, 1920),
    )
    mask = tmp_path / "mask.mkv"

    command = _render_command(
        "ffmpeg", [plan], True, [None], tmp_path / "shorts.mp4", [mask]
    )
    graph = command[command.index("-filter_complex") + 1]

    assert str(mask) in command
    assert "[1:v]fps=30" in graph
    assert "alphamerge" in graph


def test_explicit_range_takes_precedence_over_selection(monkeypatch, tmp_path):
    class FakeCapture:
        def __init__(self, _path):
            self.values = {
                cv2.CAP_PROP_FPS: 30,
                cv2.CAP_PROP_FRAME_COUNT: 30,
                cv2.CAP_PROP_FRAME_WIDTH: 720,
                cv2.CAP_PROP_FRAME_HEIGHT: 1280,
            }

        def get(self, key):
            return self.values[key]

        def release(self):
            return None

    captured_commands = []

    def fake_track(
        _ffmpeg,
        _path,
        _start,
        _duration,
        frame_count,
        _width,
        _height,
        _detector,
    ):
        return FaceTrack((None,) * frame_count, 1, 0)

    def fake_run(command, **_kwargs):
        captured_commands.append(command)
        return SimpleNamespace(returncode=0, stderr="")

    monkeypatch.setattr(video_engine.cv2, "VideoCapture", FakeCapture)
    monkeypatch.setattr(video_engine, "YuNetFaceDetector", lambda: object())
    monkeypatch.setattr(video_engine, "_track_primary_face", fake_track)
    monkeypatch.setattr(video_engine.subprocess, "run", fake_run)

    ranged = [
        ClipInput(
            tmp_path / "range-1.mp4",
            "before",
            "end",
            "",
            start_sec=0.1,
            end_sec=0.6,
        ),
        ClipInput(
            tmp_path / "range-2.mp4",
            "after",
            "start",
            "",
            start_sec=0.2,
            end_sec=0.9,
        ),
    ]
    ranged_result = process_shorts(
        ranged,
        tmp_path / "ranged.mp4",
        blur_faces=False,
    )
    assert ranged_result.duration_sec == 1.2
    ranged_command = captured_commands[-1]
    assert [
        ranged_command[index + 1]
        for index, value in enumerate(ranged_command)
        if value == "-ss"
    ] == ["0.100000", "0.200000"]
    assert ranged_command[ranged_command.index("-frames:v") + 1] == "36"


@pytest.mark.parametrize(
    ("clip_count", "blur_faces"), [(2, False), (2, True), (8, False), (8, True)]
)
def test_process_shorts_reports_stage_progress(
    monkeypatch, tmp_path, clip_count, blur_faces
):
    class FakeCapture:
        def __init__(self, _path):
            self.values = {
                cv2.CAP_PROP_FPS: 30,
                cv2.CAP_PROP_FRAME_COUNT: 300,
                cv2.CAP_PROP_FRAME_WIDTH: 720,
                cv2.CAP_PROP_FRAME_HEIGHT: 1280,
            }

        def get(self, key):
            return self.values[key]

        def release(self):
            return None

    class FakeSegmenter:
        def close(self):
            return None

    face = NormalizedFaceBox(0.4, 0.3, 0.1, 0.2)

    def fake_track(
        _ffmpeg,
        _path,
        _start,
        _duration,
        frame_count,
        _width,
        _height,
        _detector,
    ):
        return FaceTrack((face,) * frame_count, 1, 1)

    written_masks = []

    def fake_write_mask(_ffmpeg, _plan, path, _segmenter):
        path.write_bytes(b"mask")
        written_masks.append(path)

    monkeypatch.setattr(video_engine.cv2, "VideoCapture", FakeCapture)
    monkeypatch.setattr(video_engine, "YuNetFaceDetector", lambda: object())
    monkeypatch.setattr(video_engine, "_track_primary_face", fake_track)
    monkeypatch.setattr(
        video_engine, "_write_caption_files", lambda plans, _output: [None] * len(plans)
    )
    monkeypatch.setattr(video_engine, "MediaPipeFaceSkinSegmenter", FakeSegmenter)
    monkeypatch.setattr(video_engine, "_write_face_skin_mask_video", fake_write_mask)
    monkeypatch.setattr(
        video_engine, "_render_command", lambda *_args, **_kwargs: ["ffmpeg"]
    )
    monkeypatch.setattr(
        video_engine.subprocess,
        "run",
        lambda *_args, **_kwargs: SimpleNamespace(returncode=0, stderr=""),
    )

    clips = [
        ClipInput(tmp_path / f"clip-{index}.mp4", "process", "center", "")
        for index in range(clip_count)
    ]
    reported = []
    process_shorts(
        clips,
        tmp_path / "shorts.mp4",
        blur_faces=blur_faces,
        progress=reported.append,
    )

    analysis = [round((index + 1) / clip_count * 40) for index in range(clip_count)]
    masks = [45 + round((index + 1) / clip_count * 30) for index in range(clip_count)]
    assert reported == [*analysis, 45, *masks, 80, 95, 100]
    assert reported == sorted(reported)
    assert len(written_masks) == (clip_count if blur_faces else 0)


def test_rendered_original_and_tts_audio_stay_synced(monkeypatch, tmp_path):
    ffmpeg = shutil.which("ffmpeg")
    ffprobe = shutil.which("ffprobe")
    if ffmpeg is None or ffprobe is None:
        pytest.skip("ffmpeg and ffprobe are required")

    monkeypatch.setattr(video_engine, "OUTPUT_WIDTH", 64)
    monkeypatch.setattr(video_engine, "OUTPUT_HEIGHT", 112)
    monkeypatch.setattr(video_engine, "OUTPUT_FPS", 10)

    with_audio = tmp_path / "with-audio.mp4"
    silent = tmp_path / "silent.mp4"
    tts = tmp_path / "tts.wav"
    subprocess.run(
        [
            ffmpeg,
            "-hide_banner",
            "-loglevel",
            "error",
            "-f",
            "lavfi",
            "-i",
            "color=c=red:s=64x112:r=10",
            "-f",
            "lavfi",
            "-i",
            "sine=frequency=440:sample_rate=48000",
            "-t",
            "1",
            "-c:v",
            "libx264",
            "-c:a",
            "aac",
            "-shortest",
            str(with_audio),
        ],
        check=True,
    )
    subprocess.run(
        [
            ffmpeg,
            "-hide_banner",
            "-loglevel",
            "error",
            "-f",
            "lavfi",
            "-i",
            "color=c=blue:s=64x112:r=10",
            "-t",
            "1",
            "-c:v",
            "libx264",
            str(silent),
        ],
        check=True,
    )
    subprocess.run(
        [
            ffmpeg,
            "-hide_banner",
            "-loglevel",
            "error",
            "-f",
            "lavfi",
            "-i",
            "sine=frequency=880:sample_rate=48000",
            "-t",
            "2",
            str(tts),
        ],
        check=True,
    )

    track = FaceTrack((None,) * 10, sampled_frames=3, detected_samples=0)
    plans = []
    for index, (path, has_audio) in enumerate(((with_audio, True), (silent, False))):
        clip = ClipInput(
            path,
            "before" if index == 0 else "after",
            "center",
            "",
            keep_audio=index == 0,
        )
        plans.append(
            ClipPlan(
                clip=clip,
                start_sec=0.0,
                segment_duration_sec=1.0,
                frame_count=10,
                source_width=64,
                source_height=112,
                track=track,
                geometry=_render_geometry(track, 64, 112),
                has_audio=has_audio,
            )
        )

    for audio_mode, tts_path in (("original", None), ("tts", tts)):
        output = tmp_path / f"{audio_mode}.mp4"
        command = _render_command(
            ffmpeg,
            plans,
            False,
            [None, None],
            output,
            audio_mode=audio_mode,
            tts_audio_path=tts_path,
        )
        subprocess.run(command, capture_output=True, text=True, check=True)
        completed = subprocess.run(
            [
                ffprobe,
                "-v",
                "error",
                "-show_entries",
                "format=duration:stream=codec_type",
                "-of",
                "default=noprint_wrappers=1",
                str(output),
            ],
            capture_output=True,
            text=True,
            check=True,
        )
        assert "codec_type=video" in completed.stdout
        assert "codec_type=audio" in completed.stdout
        duration_line = next(
            line
            for line in completed.stdout.splitlines()
            if line.startswith("duration=")
        )
        assert float(duration_line.split("=", 1)[1]) == pytest.approx(2.0, abs=0.1)
