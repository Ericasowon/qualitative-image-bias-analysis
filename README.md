# Qualitative Image Bias Analysis

질문 ID별로 생성 이미지를 비교하고, 공통 편향이 보이는 이미지를 선택해 메모가능. 저장한 메모별로 관련 이미지와 결과표를 ZIP으로 받기 가능

## 데이터 준비

별도의 아래 자료를 저장소의 최상위 폴더에 넣기

```text
final_agreement.xlsx
images/
```

두 자료와 개인 분석 메모는 `.gitignore`로 공개 저장소에서 제외

## 설치

Python 3.9 이상

```bash
python3 -m venv .venv
source .venv/bin/activate
python3 -m pip install -r requirements.txt
```

Windows에서는 `python3` 대신 `py -3`을 사용할 수 있음

## 실행

- macOS: `run.command`
- Windows: `run_windows.bat`
- Linux: `./run.sh`

또는 직접 실행

```bash
python3 app/server.py
```

브라우저에서 <http://127.0.0.1:8773>을 열기

분석 메모는 `qual_analysis_notes.json`에 저장되며 원본 엑셀은 수정되지X.
