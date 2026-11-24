"""ByteDance 피아노 전용 모델(piano_transcription_inference)로 typebench 합성곡을 분석해 `pN.piano.json`으로 저장한다 (앱에는 들어 있지 않은 비교 실험용).
준비: python3 -m venv venv && venv/bin/pip install piano_transcription_inference torch
      체크포인트(약 172MB, CC BY 4.0로 알려짐)는 HOME/piano_transcription_inference_data/note_F1=0.9677_pedal_F1=0.9186.pth 에 직접 내려받는다(라이브러리가 쓰는 wget이 macOS에 없다)
실행: HOME=<위 폴더의 상위> venv/bin/python run_piano.py <node_modules/.cache/typebench/export> <.../real.wav>
먼저 `vitest run --config tools/typebench/vitest.config.ts tools/typebench/export.test.ts`로 wav를 내보내고, 뒤에 compare.test.ts로 채점한다.
"""
import sys, os, json, glob, time
import librosa
from piano_transcription_inference import PianoTranscription, sample_rate
exp = sys.argv[1]
files = sorted(glob.glob(exp + '/p*.wav'), key=lambda p: int(os.path.basename(p)[1:-4]))
real = sys.argv[2]
if os.path.exists(real): files.append(real)
tr = PianoTranscription(device='cpu')
for f in files:
    t0 = time.time()
    audio, _ = librosa.load(f, sr=sample_rate, mono=True)
    out = tr.transcribe(audio, None)
    notes = [dict(startSec=float(e['onset_time']), durationSec=float(e['offset_time'] - e['onset_time']), midi=int(e['midi_note']), velocity=float(e['velocity']) / 127.0) for e in out['est_note_events']]
    name = 'real' if f == real else os.path.basename(f)[:-4]
    json.dump(notes, open(f'{exp}/{name}.piano.json', 'w'))
    print(name, len(notes), 'notes', round(time.time() - t0, 1), 's', flush=True)
