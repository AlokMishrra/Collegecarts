@echo off
echo ========================================
echo CollegeCart - GitHub Push Script
echo ========================================
echo.

echo Step 1: Checking git status...
git status
echo.

echo Step 2: Adding all files...
git add .
echo.

echo Step 3: Checking what will be committed...
git status
echo.

echo Step 4: Committing changes...
git commit -m "Fully final Collegecarts is deployed with working properly"
echo.

echo Step 5: Pushing to GitHub...
git push origin main
echo.

echo ========================================
echo Push completed!
echo ========================================
pause
