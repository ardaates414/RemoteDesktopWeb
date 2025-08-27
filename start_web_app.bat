@echo off
echo Starting Online Remote Desktop Web Application...
echo.
echo This will start a web server that allows remote desktop access
echo through any web browser from anywhere in the world.
echo.
echo The web application will be available at: http://localhost:5000
echo.
echo To make it accessible online, you'll need to:
echo 1. Deploy this to a web server (Heroku, AWS, etc.)
echo 2. Or use ngrok for temporary public access
echo.
echo Press any key to continue...
pause >nul

echo Installing Flask dependencies...
pip install -r requirements_web.txt

echo.
echo Starting Flask web application...
python app.py

echo.
echo Web application stopped.
pause
