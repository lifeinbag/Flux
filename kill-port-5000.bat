@echo off
echo Killing processes on port 5000...
for /f "tokens=5" %%a in ('netstat -aon ^| find ":5000" ^| find "LISTENING"') do (
    echo Killing process %%a
    taskkill /f /pid %%a
)
echo Done.