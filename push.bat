@echo off
echo Pushing changes to GitHub...
git add client/
git add server/
git add *.md *.txt *.csv *.sql *.json
git add .gitignore
git commit -m "Auto update: %date% %time%"
git push origin main
echo.
echo Done! Press any key to close...
pause