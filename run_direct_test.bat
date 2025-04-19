@echo off
echo === Running Direct Discord Notification Test ===
cd %~dp0

echo Checking for required packages...
C:\Users\gabmi\AppData\Local\Programs\Python\Launcher\py.exe -c "import pkg_resources; pkg_resources.require('discord.py>=2.0.0')" 2>nul
if %errorlevel% neq 0 (
    echo Installing discord.py...
    C:\Users\gabmi\AppData\Local\Programs\Python\Launcher\py.exe -m pip install -U discord.py
)

echo.
echo Running test...
C:\Users\gabmi\AppData\Local\Programs\Python\Launcher\py.exe direct_test.py

echo.
echo Test completed.
echo.
pause 