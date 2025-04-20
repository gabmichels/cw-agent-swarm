@echo off
echo Running Minimal Coda Test...
echo.

:: Install required packages
py -m pip install -q python-dotenv pathlib

:: Run the Python script
py "%~dp0minimal_coda_test.py" > "%~dp0coda_test_results.log" 2>&1

:: Display the results
type "%~dp0coda_test_results.log"

echo.
echo Results saved to coda_test_results.log
echo.
echo ==================================================================
echo PRESS ANY KEY TO EXIT or close this window manually
echo ==================================================================
echo.
pause > nul 