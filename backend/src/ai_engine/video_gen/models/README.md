# Shorts face-processing models

These model files are stored with the application so a clean VM deployment does not depend on a user-specific `/tmp` path or a network download at startup.

## YuNet face detector

`face_detection_yunet_2023mar.onnx` is the OpenCV Zoo YuNet face detector used by the shorts MVP.

- Upstream: https://github.com/opencv/opencv_zoo/tree/main/models/face_detection_yunet
- License: Apache-2.0 (OpenCV Zoo repository)
- File size: 232,589 bytes
- SHA-256: `8f2383e4dd3cfbb4553ea8718107fc0423210dc964f9f4280604804ed2552fa4`

## MediaPipe selfie multiclass segmenter

`selfie_multiclass_256x256.tflite` supplies the `face-skin` class used by the shorts C blur mask.

- Upstream model: https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/latest/selfie_multiclass_256x256.tflite
- Official sample reference: https://github.com/google-ai-edge/mediapipe-samples-web/blob/main/src/tasks/image-segmenter.ts
- License reference: Apache-2.0 (MediaPipe repository)
- File size: 16,371,837 bytes
- SHA-256: `c6748b1253a99067ef71f7e26ca71096cd449baefa8f101900ea23016507e0e0`

The upstream model URL does not include a separate model-specific license file. Before redistributing the model outside this project, confirm the applicable model terms with the upstream provider.
