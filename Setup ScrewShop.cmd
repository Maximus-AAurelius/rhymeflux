@echo off
cd /d "%~dp0"
if exist ".venv\Scripts\python.exe" goto install
uv venv --python 3.11 .venv
if errorlevel 1 goto fail
:install
uv pip install --python .venv\Scripts\python.exe torch==2.14.0 torchaudio==2.11.0 --index-url https://download.pytorch.org/whl/cpu
if errorlevel 1 goto fail
uv pip install --python .venv\Scripts\python.exe -r requirements.txt
if errorlevel 1 goto fail
echo Setup complete. Open Start ScrewShop.cmd.
pause
exit /b 0
:fail
echo Setup failed. Review the error above.
pause
exit /b 1
