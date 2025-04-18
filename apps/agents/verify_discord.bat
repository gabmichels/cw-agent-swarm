@echo off
cd %~dp0
chcp 65001 > nul
echo Running Discord verification...
C:\Users\gabmi\AppData\Local\Programs\Python\Python313\python.exe -u shared\tools\verify_discord.py
pause 