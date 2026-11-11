@echo off
rem Runs Pocket Pair on this laptop at http://localhost:8000 so you can test edits.
rem Close this window to stop it.
cd /d "%~dp0"
start "" http://localhost:8000/
python -m http.server 8000
