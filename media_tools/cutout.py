"""Background removal with rembg (BiRefNet and other models). Writes new PNG files with transparency."""
import os
from pathlib import Path
from .common import existing_file, model_dir

MODELS = {  # name: approximate download size
    'birefnet-general-lite': '225 MB', 'birefnet-general': '975 MB', 'birefnet-portrait': '975 MB',
    'isnet-general-use': '170 MB', 'u2net': '170 MB', 'u2net_human_seg': '170 MB', 'u2netp': '5 MB',
}
DEFAULT_MODEL = 'birefnet-general-lite'


def model_file(name):
    """Where rembg keeps the model: <home>/models/<name>/<name>.onnx (older rembg: <home>/<name>.onnx)."""
    home = model_dir('rembg')
    current, legacy = home / 'models' / name / (name + '.onnx'), home / (name + '.onnx')
    return legacy if legacy.is_file() and not current.is_file() else current


def session(name, allow_download=False):
    if name not in MODELS:
        raise ValueError('Unknown cut-out model: ' + name + '. Choose one of ' + ', '.join(MODELS))
    os.environ['U2NET_HOME'] = str(model_dir('rembg'))
    if not model_file(name).is_file() and not allow_download:
        raise FileNotFoundError(f'Cut-out model {name} is not installed (about {MODELS[name]}). Run again with --allow-download.')
    try:
        import onnxruntime
        onnxruntime.preload_dlls()  # use the CUDA and cuDNN libraries that ship with torch when present
    except Exception:
        pass
    from rembg import new_session
    return new_session(name)


def output_for(source, out_dir):
    folder = Path(out_dir) if out_dir else source.parent
    folder.mkdir(parents=True, exist_ok=True)
    target, n = folder / (source.stem + '-cutout.png'), 2
    while target.exists():  # never overwrite
        target, n = folder / f'{source.stem}-cutout-{n}.png', n + 1
    return target


def remove_backgrounds(paths, model=DEFAULT_MODEL, out_dir=None, allow_download=False, alpha_matting=False):
    from PIL import Image
    from rembg import remove
    files = [existing_file(p) for p in paths]
    active = session(model, allow_download)
    results = []
    for source in files:
        with Image.open(source) as image:
            cut = remove(image.convert('RGBA'), session=active, alpha_matting=alpha_matting)
        target = output_for(source, out_dir)
        cut.save(target, format='PNG')
        alpha = cut.getchannel('A')
        coverage = sum(1 for v in alpha.getdata() if v > 127) / (alpha.width * alpha.height)
        box = alpha.point(lambda v: 255 if v > 127 else 0).getbbox()
        results.append({'input': str(source), 'output': str(target.resolve()), 'width': cut.width, 'height': cut.height,
                        'subjectCoverage': round(coverage, 4), 'subjectBox': list(box) if box else None})
    return {'tool': 'rembg', 'model': model, 'results': results,
            'note': 'Check edges (hair, glass, shadows) on a contrasting background before using a cut-out.'}


def remove_background_video(path, out, model=DEFAULT_MODEL, allow_download=False, max_side=1280, progress=None):
    """Removes the background of every frame of a video and writes a VP9 WebM with transparency (and the sound).

    Frames stream through ffmpeg pipes (nothing is written per frame). `progress` is a JSON file updated as it goes:
    {"done": frames finished, "total": frames, "secondsPerFrame": ...}."""
    import json, os, subprocess, time
    import cv2
    import numpy as np
    from rembg import remove
    ffmpeg = os.environ.get('FFMPEG_PATH', 'ffmpeg')
    source, target = existing_file(path), Path(out)
    if target.exists():
        raise FileExistsError('Output already exists; never overwriting: ' + str(target))
    cap = cv2.VideoCapture(str(source)); fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    w0, h0, total = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)), int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT)), int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0); cap.release()
    if not w0 or not h0:
        raise ValueError('This file has no picture: ' + str(source))
    k = min(1.0, max_side / max(w0, h0)); w, h = max(2, int(w0 * k) // 2 * 2), max(2, int(h0 * k) // 2 * 2)
    active = session(model, allow_download)
    target.parent.mkdir(parents=True, exist_ok=True)
    reader = subprocess.Popen([ffmpeg, '-v', 'error', '-i', str(source), '-vf', f'scale={w}:{h}', '-f', 'rawvideo', '-pix_fmt', 'rgb24', 'pipe:1'],
                              stdout=subprocess.PIPE, creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
    writer = subprocess.Popen([ffmpeg, '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', f'{w}x{h}', '-r', f'{fps:.6f}', '-i', 'pipe:0',
                               '-i', str(source), '-map', '0:v', '-map', '1:a?', '-c:v', 'libvpx-vp9', '-pix_fmt', 'yuva420p', '-b:v', '0', '-crf', '30',
                               '-row-mt', '1', '-deadline', 'good', '-cpu-used', '4', '-c:a', 'libopus', '-b:a', '160k', '-shortest', str(target)],
                              stdin=subprocess.PIPE, creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
    done, start, size = 0, time.perf_counter(), w * h * 3
    try:
        while True:
            raw = reader.stdout.read(size)
            if len(raw) < size:
                break
            frame = np.frombuffer(raw, np.uint8).reshape(h, w, 3)
            cut = remove(frame, session=active)  # RGBA
            writer.stdin.write(np.ascontiguousarray(cut).tobytes())
            done += 1
            if progress and (done % 3 == 0 or done == 1):
                Path(progress).write_text(json.dumps({'done': done, 'total': total, 'secondsPerFrame': round((time.perf_counter() - start) / done, 3)}))
    finally:
        writer.stdin.close(); writer.wait(); reader.stdout.close(); reader.wait()
    if writer.returncode != 0 or not target.exists():
        raise RuntimeError('Writing the transparent video failed')
    if progress:
        Path(progress).write_text(json.dumps({'done': done, 'total': done, 'secondsPerFrame': round((time.perf_counter() - start) / max(1, done), 3)}))
    return {'tool': 'rembg', 'model': model, 'input': str(source), 'output': str(target.resolve()), 'frames': done, 'fps': fps, 'width': w, 'height': h,
            'seconds': round(time.perf_counter() - start, 1), 'note': 'VP9 WebM with an alpha channel; check edges (hair, motion blur) before using it.'}
