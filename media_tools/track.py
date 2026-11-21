"""Motion tracking: follow a box in a video (OpenCV CSRT) so text or a sticker can move with it."""
from pathlib import Path


def track(path, box, start=0.0, end=None, every=2):
    """box: (x, y, w, h) as fractions of the frame at `start` (seconds). Returns the box centre at every `every`-th
    frame until `end`: [{time, x, y, w, h, ok}] in fractions of the frame, `ok` False where the tracker lost it."""
    import cv2
    source = Path(path)
    if not source.is_file():
        raise FileNotFoundError(str(source))
    cap = cv2.VideoCapture(str(source)); fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    W, H = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)), int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    if not W or not H:
        raise ValueError('This file has no picture: ' + str(source))
    # track on a copy at most 960 wide: faster, and CSRT is just as steady
    k = min(1.0, 960 / max(W, H)); w2, h2 = int(W * k), int(H * k)
    cap.set(cv2.CAP_PROP_POS_MSEC, max(0.0, start) * 1000)
    ok, frame = cap.read()
    if not ok:
        raise ValueError('Could not read the video at ' + str(start) + ' s')
    frame = cv2.resize(frame, (w2, h2)) if k < 1 else frame
    x, y, bw, bh = box
    rect = (int(x * w2), int(y * h2), max(8, int(bw * w2)), max(8, int(bh * h2)))
    tracker = cv2.TrackerCSRT_create(); tracker.init(frame, rect)
    t0 = (cap.get(cv2.CAP_PROP_POS_FRAMES) - 1) / fps  # the frame just read
    points = [{'time': round(max(0.0, t0), 3), 'x': (rect[0] + rect[2] / 2) / w2, 'y': (rect[1] + rect[3] / 2) / h2, 'w': rect[2] / w2, 'h': rect[3] / h2, 'ok': True}]
    n, lost = 0, 0
    while True:
        ok, frame = cap.read()
        if not ok:
            break
        t = (cap.get(cv2.CAP_PROP_POS_FRAMES) - 1) / fps
        if end is not None and t > end + 1e-3:
            break
        frame = cv2.resize(frame, (w2, h2)) if k < 1 else frame
        found, r = tracker.update(frame); n += 1
        if not found:
            lost += 1
        if n % every == 0 or not found:
            bx, by, bw2, bh2 = r
            points.append({'time': round(t, 3), 'x': (bx + bw2 / 2) / w2, 'y': (by + bh2 / 2) / h2, 'w': bw2 / w2, 'h': bh2 / h2, 'ok': bool(found)})
    cap.release()
    return {'tool': 'opencv-csrt', 'input': str(source), 'fps': fps, 'points': points, 'lostFrames': lost,
            'note': 'Positions are fractions of the frame (box centre); ok is false where the tracker lost the object.'}
