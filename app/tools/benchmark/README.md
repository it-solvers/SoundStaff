# 정답 악보(PDF)로 악보 변환 평가하기

음원에서 만든 악보를 **정답 악보(PDF)** 와 박마다 비교해 일치율을 재는 도구다 (파이썬 표준 라이브러리만 사용).
정답 악보는 Finale 등에서 PDF로 인쇄한 **벡터 PDF**여야 한다 (오선과 음표 머리가 좌표로 들어 있어야 한다).

```
# 1) PDF에서 정답 음표를 뽑는다 (보표 구성·음자리표는 build_truth.py 위쪽 상수를 곡에 맞게 고친다)
SCORE_PDF="data/악보.pdf" TRUTH_JSON=truth_notes.json python3 tools/benchmark/build_truth.py
# 2) 내 악보(MusicXML)를 정답과 비교한다
TRUTH_JSON=truth_notes.json python3 tools/benchmark/evaluate.py output/내악보.musicxml
# 3) (선택) 피아노까지 넣은 정답으로 마디 단위 평가: 한 마디 안에 그 음높이가 실제로 있는지(옥타브 오류·틀린 음)를 본다
TRUTH_JSON=truth_notes.json TRUTH_ALL_JSON=truth_notes_all.json python3 tools/benchmark/piano_truth.py
TRUTH_ALL_JSON=truth_notes_all.json python3 tools/benchmark/measure_eval.py output/내악보.musicxml
```

- 피아노 정답은 음표 머리의 x 좌표를 마디 안에서 선형으로 늘려 리듬을 근사한 거친 값이라 박 단위가 아니라 마디 단위로만 쓴다.
- 정답 추출은 마디마다 음 길이의 합이 박자와 맞는지로 검증한다 (`problems 0`이어야 한다).
- 지표: 박마다 울리는 음 집합의 **음이름 F1**(옥타브 무시)과 **음높이 F1**(옥타브 포함), 화음 구간 수.
- 한 곡으로 맞춘 값은 그 곡에만 맞을 수 있다. 조정값을 바꿀 때는 효과가 작은 값은 그대로 두고, 다른 곡이 생기면 다시 비교한다.
- 저작권이 있는 악보·음원(`data/`)은 저장소에 올리지 않는다.
