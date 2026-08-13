from __future__ import annotations

from importlib import metadata

import cv2
import insightface
import numpy as np

from src.ai_engine.video_gen.engine import (
    MediaPipeFaceSkinSegmenter,
    YuNetFaceDetector,
)


def _installed_version(name: str) -> str | None:
    try:
        return metadata.version(name)
    except metadata.PackageNotFoundError:
        return None


def test_single_opencv_distribution_and_face_runtime_smoke():
    opencv_distributions = {
        name: version
        for name in (
            "opencv-python",
            "opencv-python-headless",
            "opencv-contrib-python",
            "opencv-contrib-python-headless",
        )
        if (version := _installed_version(name)) is not None
    }

    assert opencv_distributions == {"opencv-contrib-python-headless": "5.0.0.93"}
    assert cv2.__version__ == "5.0.0"
    assert hasattr(cv2, "FaceDetectorYN")
    assert _installed_version("insightface") is not None
    assert hasattr(insightface.app, "FaceAnalysis")

    frame = np.zeros((338, 640, 3), dtype=np.uint8)
    detector = YuNetFaceDetector()
    assert isinstance(detector.detect(frame), list)

    segmenter = MediaPipeFaceSkinSegmenter()
    try:
        mask = segmenter.segment(frame)
    finally:
        segmenter.close()

    assert mask.shape == frame.shape[:2]
    assert mask.dtype == np.uint8
