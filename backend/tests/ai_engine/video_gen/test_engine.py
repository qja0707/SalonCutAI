import numpy as np

from src.ai_engine.video_gen.engine import (
    ClipInput,
    center_crop,
    ordered_clips,
    segment_start,
)


def test_segment_start_uses_two_second_window():
    assert segment_start(8.0, "start") == 0
    assert segment_start(8.0, "center") == 3
    assert segment_start(8.0, "end") == 6
    assert segment_start(1.5, "end") == 0


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


def test_center_crop_returns_vertical_canvas():
    landscape = np.zeros((720, 1280, 3), dtype=np.uint8)
    portrait = np.zeros((1280, 720, 3), dtype=np.uint8)
    assert center_crop(landscape).shape == (1920, 1080, 3)
    assert center_crop(portrait).shape == (1920, 1080, 3)
