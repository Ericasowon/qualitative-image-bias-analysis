#!/bin/zsh
ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT_DIR/app" || exit 1

if ! command -v python3 >/dev/null 2>&1; then
  echo "Python 3가 필요합니다. README.md의 설치 안내를 확인하세요."
  read "?Enter를 누르면 종료합니다."
  exit 1
fi

if ! python3 -c "import openpyxl" >/dev/null 2>&1; then
  echo "필수 패키지가 설치되지 않았습니다."
  echo "다음 명령을 실행하세요: python3 -m pip install -r \"$ROOT_DIR/requirements.txt\""
  read "?Enter를 누르면 종료합니다."
  exit 1
fi

if curl -fsS "http://127.0.0.1:8773/api/status" >/dev/null 2>&1; then
  open "http://127.0.0.1:8773"
  exit 0
fi

( sleep 1; open "http://127.0.0.1:8773" ) &
exec python3 server.py
